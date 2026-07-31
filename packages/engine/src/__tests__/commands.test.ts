import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { Adapter, ExtractOptions, RepoContext, SurfaceManifest } from "@product-map/spec";
import { finalizeManifest, serializeManifest } from "@product-map/spec";
import { describe, expect, it, vi } from "vitest";

import { runCommand } from "../commands";
import { CliError } from "../errors";
import type { CommandContext } from "../commands";
import { MANIFESTS, productMapDir } from "../layout";
import { EMPTY_OPTIONS } from "../options";
import { createMemoryLogger } from "@product-map/runtime";
import { Writer } from "../writer";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;
const repoRootDir = resolve(import.meta.dirname, "../../../..");
const assets = {
  promptsDir: join(repoRootDir, "packages", "pmap", "prompts"),
  schemasDir: join(repoRootDir, "packages", "spec", "schemas"),
};

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-app-"));
  write(join(root, "package.json"), JSON.stringify({ name: "fixture", private: true, bin: { fixture: "./cli.js" } }));
  write(join(root, "src", "commands", "scan.ts"), "export const scan = true;\n");
  return root;
}

function pm(root: string, slot: keyof typeof MANIFESTS): string {
  return join(productMapDir(root), MANIFESTS[slot].rel);
}

/** Run a command in-process, committing the staged writer on success (mirrors cli.ts). */
async function run(root: string, command: Parameters<typeof runCommand>[0], overrides: Partial<CommandContext> = {}) {
  const writer = new Writer({ dryRun: false });
  await runCommand(command, {
    repoRoot: root,
    writer,
    generator: toolGenerator,
    assets,
    options: EMPTY_OPTIONS,
    logger: createMemoryLogger(),
    output: () => {},
    format: "text",
    maxTokens: undefined,
    scan: false,
    allowRepoCode: true,
    allowPartialLocal: false,
    args: [],
    out: undefined,
    ...overrides,
  });
  writer.commit();
  return writer;
}

describe("app layer (in-process)", () => {
  it("all stages a full artifact set and reads it back through the overlay before commit", async () => {
    const root = fixtureRepo();
    const writer = new Writer({ dryRun: false });

    await runCommand("all", {
      repoRoot: root,
      writer,
      generator: toolGenerator,
      assets,
      options: EMPTY_OPTIONS,
      logger: createMemoryLogger(),
      output: () => {},
      format: "text",
      maxTokens: undefined,
      scan: false,
      allowRepoCode: true,
      allowPartialLocal: false,
      args: [],
      out: undefined,
    });

    expect(writer.read(pm(root, "surfacesExisting"))).not.toBeNull();
    expect(writer.writes.some((w) => w.path === pm(root, "mapExisting") && w.action === "create")).toBe(true);
    expect(existsSync(pm(root, "surfacesExisting"))).toBe(false); // staged only
  });

  it("extract then map then diff then render each succeed against committed inputs", async () => {
    const root = fixtureRepo();
    await run(root, "extract");
    expect(existsSync(pm(root, "surfacesExisting"))).toBe(true);
    await run(root, "map");
    expect(existsSync(pm(root, "mapExisting"))).toBe(true);
    await run(root, "diff");
    await run(root, "render");
    expect(existsSync(join(productMapDir(root), "generated", "README.generated.md"))).toBe(true);
  });

  it("warns on stderr when an adapter throws, and still writes the manifests", async () => {
    const root = fixtureRepo();
    const logger = createMemoryLogger();
    vi.resetModules();
    vi.doMock("@product-map/extract", async () => {
      const actual = await vi.importActual<typeof import("@product-map/extract")>("@product-map/extract");
      const boom: Adapter = {
        name: "boom",
        detect: () => true,
        extract: () => {
          throw new Error("this layout confused me");
        },
      };
      return {
        ...actual,
        extractRepo: (ctx: RepoContext, options: ExtractOptions) =>
          actual.extractRepo(ctx, options, [...actual.ADAPTERS, boom]),
      };
    });
    try {
      const { runCommand: freshRunCommand } = await import("../commands");
      const { Writer: FreshWriter } = await import("../writer");
      const writer = new FreshWriter({ dryRun: false });
      await freshRunCommand("all", {
        repoRoot: root,
        writer,
        generator: toolGenerator,
        assets,
        options: EMPTY_OPTIONS,
        logger,
        output: () => {},
        format: "text",
        maxTokens: undefined,
        scan: false,
        allowRepoCode: true,
        allowPartialLocal: false,
        args: [],
        out: undefined,
      });
      writer.commit();
    } finally {
      vi.doUnmock("@product-map/extract");
      vi.resetModules();
    }

    expect(logger.lines.some((line) => line.includes("adapter-failure: boom: this layout confused me"))).toBe(true);
    expect(existsSync(pm(root, "surfacesExisting"))).toBe(true);
  });

  it("validate passes on a freshly generated repo and check-fresh reports no drift", async () => {
    const root = fixtureRepo();
    await run(root, "all");
    await expect(run(root, "validate")).resolves.toBeDefined();
    await expect(run(root, "check-fresh")).resolves.toBeDefined();
  });

  it("check-fresh throws drift when a source changes after generation", async () => {
    const root = fixtureRepo();
    await run(root, "all");
    write(join(root, "src", "commands", "deploy.ts"), "export const deploy = true;\n");

    await expect(run(root, "check-fresh")).rejects.toBeInstanceOf(CliError);
  });

  it("check-fresh reports no drift when only the running generator version is newer", async () => {
    const root = fixtureRepo();
    await run(root, "all");

    await expect(run(root, "check-fresh", { generator: { name: "pmap", version: "9.9.9" } })).resolves.toBeDefined();
  });

  it("check-fresh still reports drift on a semantic change under a newer generator version", async () => {
    const root = fixtureRepo();
    await run(root, "all");
    write(join(root, "src", "commands", "deploy.ts"), "export const deploy = true;\n");

    await expect(run(root, "check-fresh", { generator: { name: "pmap", version: "9.9.9" } })).rejects.toBeInstanceOf(
      CliError,
    );
  });

  it("ingest stages a planned manifest, and bounces a structurally broken one", async () => {
    const root = fixtureRepo();
    await run(root, "all");
    const existing = JSON.parse(readFileSync(pm(root, "surfacesExisting"), "utf8")) as SurfaceManifest;
    const planned = finalizeManifest<SurfaceManifest>({
      ...existing,
      stance: "planned",
      generatedFrom: { commit: null, workingTree: "not-applicable", sources: ["design"] },
      generator: { name: "manual", version: "1.0.0" },
    });
    const good = join(root, "planned.json");
    write(good, serializeManifest(planned));
    await run(root, "ingest", { args: [good] });
    expect(existsSync(pm(root, "surfacesPlanned"))).toBe(true);

    const bad = join(root, "bad.json");
    write(bad, JSON.stringify({ stance: "planned", items: "not-an-array" }));
    await expect(run(root, "ingest", { args: [bad] })).rejects.toBeInstanceOf(CliError);
  });

  it("throws CliError — not a raw process exit — on a bad command input", async () => {
    const root = fixtureRepo();
    await expect(run(root, "ingest", { args: [] })).rejects.toBeInstanceOf(CliError);
  });

  it("rejects a valid manifest placed in the wrong slot", async () => {
    const root = fixtureRepo();
    await run(root, "all");
    write(pm(root, "surfacesExisting"), readFileSync(pm(root, "capabilitiesExisting"), "utf8"));

    await expect(run(root, "validate")).rejects.toThrow(/must be a existing surface/);
  });

  it("rejects non-canonical bytes and unexpected JSON files", async () => {
    const root = fixtureRepo();
    await run(root, "all");
    write(pm(root, "surfacesExisting"), JSON.stringify(JSON.parse(readFileSync(pm(root, "surfacesExisting"), "utf8"))));
    await expect(run(root, "validate")).rejects.toThrow(/not canonical/);
  });

  it("fails extract closed on a broken local extractor, unless partial output is allowed", async () => {
    const root = fixtureRepo();
    write(
      join(productMapDir(root), "extract.local.mjs"),
      "console.log(JSON.stringify({ surfaces: [], capabilities: [{ id: 'cap:query:bad', kind: 'command' }], sources: [] }));\n",
    );
    await expect(run(root, "extract")).rejects.toBeInstanceOf(CliError);
    await expect(run(root, "extract", { allowPartialLocal: true })).resolves.toBeDefined();
  });

  it("map surfaces a scope mismatch as a CliError rather than an uncaught throw", async () => {
    const root = fixtureRepo();
    await run(root, "extract");
    const caps = JSON.parse(readFileSync(pm(root, "capabilitiesExisting"), "utf8"));
    caps.scope = "other";
    write(pm(root, "capabilitiesExisting"), `${JSON.stringify(caps)}\n`);

    await expect(run(root, "map")).rejects.toThrow();
  });

  it("fleet rolls two committed repos into a fleet manifest", async () => {
    const a = fixtureRepo();
    const b = fixtureRepo();
    await run(a, "all");
    await run(b, "all");
    const out = mkdtempSync(join(tmpdir(), "pmap-fleet-"));

    await run(a, "fleet", { args: [a, b], out });

    expect(existsSync(join(out, "fleet.json"))).toBe(true);
    expect(existsSync(join(out, "fleet.generated.md"))).toBe(true);
  });

  it("applies a configured surface rename and stays silent about the capability pass", async () => {
    const root = fixtureRepo();
    await run(root, "all");
    const existing = JSON.parse(readFileSync(pm(root, "surfacesExisting"), "utf8")) as SurfaceManifest;
    const original = existing.items[0]!;
    const renamed = finalizeManifest<SurfaceManifest>({
      ...existing,
      stance: "planned",
      generatedFrom: { commit: null, workingTree: "not-applicable", sources: ["design"] },
      generator: { name: "manual", version: "1.0.0" },
      items: [{ ...original, id: `${original.id}-next` }],
    });
    write(pm(root, "surfacesPlanned"), serializeManifest(renamed));
    const logger = createMemoryLogger();
    const options = {
      ...EMPTY_OPTIONS,
      config: { renames: [{ fromId: original.id, toId: `${original.id}-next` }] },
    };

    await run(root, "diff", { logger, options });

    const diff = JSON.parse(readFileSync(pm(root, "surfacesDiff"), "utf8")) as { items: { change: string }[] };
    expect(diff.items.map((entry) => entry.change)).toContain("renamed");
    expect(logger.lines.some((line) => line.includes("declared rename"))).toBe(false);
    await expect(run(root, "validate")).resolves.toBeDefined();
  });

  it("warns and falls back when a configured rename does not line up", async () => {
    const root = fixtureRepo();
    await run(root, "all");
    const existing = JSON.parse(readFileSync(pm(root, "surfacesExisting"), "utf8")) as SurfaceManifest;
    const planned = finalizeManifest<SurfaceManifest>({
      ...existing,
      stance: "planned",
      generatedFrom: { commit: null, workingTree: "not-applicable", sources: ["design"] },
      generator: { name: "manual", version: "1.0.0" },
    });
    write(pm(root, "surfacesPlanned"), serializeManifest(planned));
    const logger = createMemoryLogger();
    const options = {
      ...EMPTY_OPTIONS,
      config: { renames: [{ fromId: "surface:cli:ghost", toId: "surface:cli:phantom" }] },
    };

    await run(root, "diff", { logger, options });

    expect(logger.lines.some((line) => line.includes("declared rename surface:cli:ghost"))).toBe(true);
  });

  it("init vendors prompts and schemas into the repo", async () => {
    const root = fixtureRepo();
    await run(root, "init");
    expect(existsSync(join(productMapDir(root), "schemas", "surface-manifest.schema.json"))).toBe(true);
  });
});
