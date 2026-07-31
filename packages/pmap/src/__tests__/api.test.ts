import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildFleetManifest,
  createDeriveContext,
  diffManifests,
  extractRepo,
  loadRepoContext,
  mapManifests,
  validateManifest,
  GENERATOR,
} from "../index";

function write(root: string, rel: string, content = "export {};\n"): void {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-api-"));
  write(root, "package.json", JSON.stringify({ name: "fixture", bin: { fixture: "./cli.js" } }));
  write(root, "src/commands/scan.ts");
  return root;
}

const deriveContext = createDeriveContext(GENERATOR);

describe("public API", () => {
  it("exposes the tool identity", () => {
    expect(typeof GENERATOR.version).toBe("string");
    expect(GENERATOR.name).toBe("pmap");
  });

  it("extracts a repository through the published entry point", async () => {
    const ctx = loadRepoContext(fixtureRepo());

    const result = await extractRepo(ctx, { generator: GENERATOR });

    expect(validateManifest(result.surfaces).ok).toBe(true);
    expect(validateManifest(result.capabilities).ok).toBe(true);
    expect(result.adaptersRun).toContain("bins");
  });

  it("honours repo-context options", () => {
    const ctx = loadRepoContext(fixtureRepo(), { listDepth: 1 });

    expect(ctx.repoName).toMatch(/^pmap-api-/);
    expect(ctx.packages.length).toBeGreaterThan(0);
  });

  it("derives a map and a diff from extracted manifests", async () => {
    const ctx = loadRepoContext(fixtureRepo());
    const { surfaces, capabilities } = await extractRepo(ctx, { generator: GENERATOR });

    const map = mapManifests(surfaces, capabilities, deriveContext);
    const diff = diffManifests(surfaces, surfaces, deriveContext);

    expect(validateManifest(map).ok).toBe(true);
    expect(validateManifest(diff).ok).toBe(true);
    expect(diff.items).toEqual([]);
  });

  it("honours mapping options passed through the public factory", async () => {
    const ctx = loadRepoContext(fixtureRepo());
    const { surfaces, capabilities } = await extractRepo(ctx, { generator: GENERATOR });

    const strict = createDeriveContext(GENERATOR, { candidateThreshold: 1, maxCandidates: 0 });
    const map = mapManifests(surfaces, capabilities, strict);

    expect(map.items.every((entry) => entry.candidates === undefined)).toBe(true);
  });

  it("builds a fleet manifest from extracted repositories", async () => {
    const ctx = loadRepoContext(fixtureRepo());
    const { surfaces, capabilities } = await extractRepo(ctx, { generator: GENERATOR });

    const fleet = buildFleetManifest(
      "estate",
      [{ path: "../fixture", surfaces, capabilities, hasPlanned: false }],
      deriveContext,
    );

    expect(validateManifest(fleet).ok).toBe(true);
    expect(fleet.items[0]?.state).toBe("mapped");
  });
});
