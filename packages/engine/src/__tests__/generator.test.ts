import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { SurfaceManifest } from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { diffManifests, createDeriveContext } from "@product-map/derive";
import { extractRepo } from "@product-map/extract";
import { mapManifests } from "@product-map/derive";
import { loadRepoContext } from "@product-map/discovery";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

const deriveContext = createDeriveContext({ name: "pmap", version: "0.0.0" });

const packageVersion = (
  JSON.parse(readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8")) as { version: string }
).version;

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-generator-"));
  mkdirSync(join(root, "apps", "cli"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", private: true }));
  writeFileSync(
    join(root, "apps", "cli", "package.json"),
    JSON.stringify({ name: "@fixture/cli", bin: { fixture: "index.js" } }),
  );
  return root;
}

describe("generator identity", () => {
  it("stamps the installed package version on every derived artifact", async () => {
    const result = await extractRepo(loadRepoContext(fixtureRepo()), { generator: toolGenerator });
    const planned = finalizeManifest<SurfaceManifest>({ ...result.surfaces, stance: "planned" });

    expect(result.surfaces.generator.version).toBe(packageVersion);
    expect(result.capabilities.generator.version).toBe(packageVersion);
    expect(mapManifests(result.surfaces, result.capabilities, deriveContext).generator.version).toBe(packageVersion);
    expect(diffManifests(result.surfaces, planned, deriveContext).generator.version).toBe(packageVersion);
  });
});
