import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SurfaceManifest } from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { diffManifests, createDeriveContext } from "@product-map/derive";
import { extractRepo } from "@product-map/extract";
import { mapManifests } from "@product-map/derive";
import { loadRepoContext } from "@product-map/discovery";

// A deliberately fictional version: the invariant is that the INJECTED
// generator identity propagates unchanged into every artifact — check-fresh's
// generator preservation depends on injectability. Asserting against any
// package.json here made the test vacuously green while every version was
// 0.0.0 and broke on the first real version PR, when the packages diverged.
const toolGenerator = { name: "pmap", version: "7.7.7-test" } as const;

const deriveContext = createDeriveContext(toolGenerator);

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
  it("stamps the injected generator identity on every derived artifact", async () => {
    const result = await extractRepo(loadRepoContext(fixtureRepo()), { generator: toolGenerator });
    const planned = finalizeManifest<SurfaceManifest>({ ...result.surfaces, stance: "planned" });

    expect(result.surfaces.generator.version).toBe(toolGenerator.version);
    expect(result.capabilities.generator.version).toBe(toolGenerator.version);
    expect(mapManifests(result.surfaces, result.capabilities, deriveContext).generator.version).toBe(
      toolGenerator.version,
    );
    expect(diffManifests(result.surfaces, planned, deriveContext).generator.version).toBe(toolGenerator.version);
  });
});
