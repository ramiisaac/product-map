import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CapabilityManifest, SurfaceManifest } from "@product-map/spec";
import { finalizeManifest, validateManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { diffManifests, createDeriveContext } from "@product-map/derive";
import { extractRepo } from "@product-map/extract";
import { mapManifests } from "@product-map/derive";
import { loadRepoContext } from "@product-map/discovery";
import { Writer } from "../writer";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

const deriveContext = createDeriveContext({ name: "pmap", version: "0.0.0" });

function scaffoldFixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-fixture-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", private: true }));
  mkdirSync(join(root, "apps", "cli", "src", "commands"), { recursive: true });
  writeFileSync(
    join(root, "apps", "cli", "package.json"),
    JSON.stringify({ name: "@fixture/cli", bin: { fixture: "./dist/index.js" }, dependencies: { commander: "^12" } }),
  );
  writeFileSync(join(root, "apps", "cli", "src", "commands", "scan.ts"), "export const scan = 1;\n");
  writeFileSync(join(root, "apps", "cli", "src", "commands", "fix.ts"), "export const fix = 1;\n");
  writeFileSync(join(root, "action.yml"), "name: Fixture Action\nruns:\n  using: node20\n");
  return root;
}

describe("extract", () => {
  it("extracts CLI surfaces bound to their commands, plus the action", async () => {
    const root = scaffoldFixtureRepo();
    const ctx = loadRepoContext(root);
    const result = await extractRepo(ctx, { generator: toolGenerator });

    expect(validateManifest(result.surfaces).ok).toBe(true);
    expect(validateManifest(result.capabilities).ok).toBe(true);

    const cli = result.surfaces.items.find((s) => s.id === "surface:cli:fixture");
    expect(cli).toBeDefined();
    expect(cli!.binds.map((b) => b.capabilityId).sort()).toEqual([
      "cap:command:fixture.fix",
      "cap:command:fixture.scan",
      "cap:package:cli",
    ]);
    expect(result.surfaces.items.some((s) => s.surfaceType === "github-action")).toBe(true);
    expect(result.surfaces.generatedFrom.commit).toBeNull();
    expect(result.surfaces.generatedFrom.workingTree).toBe("not-applicable");
  });

  it("is deterministic across runs", async () => {
    const root = scaffoldFixtureRepo();
    const a = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const b = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    expect(a.surfaces.contentHash).toBe(b.surfaces.contentHash);
    expect(a.capabilities.contentHash).toBe(b.capabilities.contentHash);
  });
});

describe("map", () => {
  it("classifies supported, orphan, and unbound; never silently binds", async () => {
    const root = scaffoldFixtureRepo();
    const { surfaces, capabilities } = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const map = mapManifests(surfaces, capabilities, deriveContext);
    expect(validateManifest(map).ok).toBe(true);
    const rels = map.items.map((e) => e.relationship);
    expect(rels).toContain("bound");
    expect(rels).toContain("surface-unbound"); // the github-action surface has no binds
    const unbound = map.items.filter((e) => e.relationship === "surface-unbound");
    for (const entry of unbound) {
      expect(entry.capabilityId).toBeUndefined(); // candidates only, no binding asserted
    }
  });

  it("distinguishes a surface that declared nothing from one that named an absent capability", async () => {
    const root = scaffoldFixtureRepo();
    const { surfaces, capabilities } = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const planned = finalizeManifest<SurfaceManifest>({
      ...surfaces,
      stance: "planned",
      items: [
        {
          ...surfaces.items.find((s) => s.id === "surface:cli:fixture")!,
          binds: [{ capabilityId: "cap:command:fixture.does-not-exist", via: "explicit" }],
        },
      ],
    });
    const map = mapManifests(planned, capabilities, deriveContext);
    // The relationship is the same; the presence of a capabilityId is what
    // separates "named something absent" from "declared nothing at all".
    const named = map.items.filter((e) => e.relationship === "surface-unbound" && e.capabilityId !== undefined);
    expect(named.map((e) => e.capabilityId)).toEqual(["cap:command:fixture.does-not-exist"]);
    expect(map.items.some((e) => e.relationship === "capability-unbound")).toBe(true);
  });
});

describe("diff", () => {
  it("reports removed ids and field-level status changes", async () => {
    const root = scaffoldFixtureRepo();
    const { surfaces } = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const planned = finalizeManifest<SurfaceManifest>({
      ...surfaces,
      stance: "planned",
      items: surfaces.items.filter((s) => s.surfaceType === "cli").map((s) => ({ ...s, status: "planned" as const })),
    });
    const diff = diffManifests(surfaces, planned, deriveContext);
    expect(validateManifest(diff).ok).toBe(true);
    expect(diff.items.some((e) => e.change === "removed")).toBe(true); // action absent from planned
    const statusChange = diff.items.find((e) => e.change === "changed");
    expect(statusChange?.fieldChanges?.[0]?.path).toBe("/status");
  });

  it("refuses cross-kind diffs", async () => {
    const root = scaffoldFixtureRepo();
    const { surfaces, capabilities } = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    expect(() =>
      diffManifests(surfaces, capabilities as unknown as CapabilityManifest & SurfaceManifest, deriveContext),
    ).toThrow();
  });
});

describe("writer dry-run", () => {
  it("writes nothing in dry-run mode but reports planned writes", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-writer-"));
    const writer = new Writer({ dryRun: true });
    const target = join(root, "sub", "file.json");
    const planned = writer.write(target, "content\n");
    expect(planned.action).toBe("create");
    expect(existsSync(target)).toBe(false);
    expect(writer.summary()).toContain("DRY RUN");
  });

  it("classifies create/update/unchanged and writes the final state on commit", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-writer-"));
    const writer = new Writer({ dryRun: false });
    const target = join(root, "file.json");
    expect(writer.write(target, "a\n").action).toBe("create");
    expect(writer.write(target, "a\n").action).toBe("unchanged");
    expect(writer.write(target, "b\n").action).toBe("update");
    expect(existsSync(target)).toBe(false); // staged until commit
    writer.commit();
    expect(readFileSync(target, "utf8")).toBe("b\n");
  });
});

describe("local extractor", () => {
  it("merges repo-local items (local wins) and passes ext through", async () => {
    const root = scaffoldFixtureRepo();
    mkdirSync(join(root, "docs", "reference", "product-map"), { recursive: true });
    const script = `
const out = {
  sources: ["registry.json"],
  surfaces: [{
    id: "surface:cli:fixture",
    surfaceType: "cli",
    name: "Fixture CLI (curated)",
    entry: { kind: "bin", value: "fixture" },
    purpose: "Curated by the repo's own extractor.",
    audience: ["developer"],
    status: "live",
    binds: [{ capabilityId: "cap:command:fixture.scan", via: "explicit" }],
    placement: { current: "apps/cli", verdict: "correct" },
    provenance: { source: "registry.json", evidence: ["registry.json"], confidence: "high" },
    ext: { "fixture.tier": "gold" },
  }],
  capabilities: [{
    id: "cap:mcp-tool:fixture.magic",
    kind: "mcp-tool",
    name: "magic",
    surfaceArea: "mcp",
    status: "live",
    reach: "external",
    placement: { current: "packages/magic", verdict: "correct" },
    provenance: { source: "registry.json", evidence: [], confidence: "high" },
    ext: { "fixture.owner": "core-team" },
  },
  { id: "cap:command:broken", kind: "route", name: "x", surfaceArea: "cli", status: "live",
    placement: { current: "a", verdict: "correct" },
    provenance: { source: "a", evidence: [], confidence: "high" } }],
};
console.log(JSON.stringify(out));
`;
    writeFileSync(join(root, "docs", "reference", "product-map", "extract.local.mjs"), script);
    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(result.adaptersRun).toContain("local");
    const cli = result.surfaces.items.find((s) => s.id === "surface:cli:fixture");
    expect(cli!.name).toBe("Fixture CLI (curated)"); // local supersedes the bins/cli-commands adapters
    expect(cli!.ext).toEqual({ "fixture.tier": "gold" });
    expect(result.capabilities.items.some((c) => c.id === "cap:mcp-tool:fixture.magic")).toBe(true);
    expect(result.localIssues.some((i) => i.includes("capability[1] invalid"))).toBe(true); // kind/id mismatch dropped loudly
    expect(validateManifest(result.surfaces).ok).toBe(true);
    expect(validateManifest(result.capabilities).ok).toBe(true);
  });
});

describe("reconciliation plan", () => {
  it("orders waves and cites map/diff evidence", async () => {
    const { renderReconciliationPlan } = await import("@product-map/emit");
    const root = scaffoldFixtureRepo();
    const { surfaces, capabilities } = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const cliSurface = surfaces.items.find((s) => s.id === "surface:cli:fixture")!;
    const planned = finalizeManifest<SurfaceManifest>({
      ...surfaces,
      stance: "planned",
      generatedFrom: { commit: null, workingTree: "not-applicable", sources: ["design"] },
      items: [
        {
          ...cliSurface,
          binds: [...cliSurface.binds, { capabilityId: "cap:command:fixture.export", via: "explicit" as const }],
        },
        {
          ...cliSurface,
          id: "surface:docs:site",
          surfaceType: "docs" as const,
          name: "Docs site",
          binds: [],
          provenance: { ...cliSurface.provenance, confidence: "low" as const },
        },
      ],
    });
    const map = mapManifests(planned, capabilities, deriveContext);
    const diff = diffManifests(surfaces, planned, deriveContext);
    const plan = renderReconciliationPlan(planned, capabilities, map, diff);

    expect(plan).toContain("Wave 1 — build missing capabilities (1)");
    expect(plan).toContain("cap:command:fixture.export");
    expect(plan).toContain("NEW surface: `surface:docs:site`");
    expect(plan).toContain("blocked on Wave 1");
    expect(plan).toContain("design-side confidence is LOW");
    expect(plan).toContain("[map: backend-missing]");
  });
});
