import { validateManifest } from "@product-map/spec";
import type { CapabilityManifest, SurfaceManifest } from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { buildFleetManifest, createDeriveContext } from "..";

const deriveContext = createDeriveContext({ name: "pmap", version: "0.0.0" });

function surfaces(scope: string): SurfaceManifest {
  return finalizeManifest<SurfaceManifest>({
    schemaVersion: "product-map.v1",
    kind: "surface",
    stance: "existing",
    scope,
    generatedFrom: { commit: "a".repeat(40), workingTree: "clean", sources: ["package.json"] },
    generator: { name: "pmap", version: "0.0.0" },
    items: [
      {
        id: "surface:cli:tool",
        surfaceType: "cli",
        name: "tool CLI",
        entry: { kind: "bin", value: "tool" },
        purpose: "Command-line entrypoint.",
        audience: ["developer"],
        status: "live",
        binds: [],
        placement: { current: ".", verdict: "misplaced", canonical: "packages/cli" },
        provenance: { source: "package.json", evidence: ["package.json"], confidence: "high" },
      },
    ],
  });
}

function capabilities(scope: string): CapabilityManifest {
  return finalizeManifest<CapabilityManifest>({
    schemaVersion: "product-map.v1",
    kind: "capability",
    stance: "existing",
    scope,
    generatedFrom: { commit: "a".repeat(40), workingTree: "clean", sources: ["package.json"] },
    generator: { name: "pmap", version: "0.0.0" },
    items: [
      {
        id: "cap:command:tool.run",
        kind: "command",
        name: "tool run",
        surfaceArea: "cli",
        status: "live",
        reach: "external",
        placement: { current: ".", verdict: "correct" },
        provenance: { source: "src", evidence: ["src"], confidence: "medium" },
      },
    ],
  });
}

const mapped = { path: "../alpha", surfaces: surfaces("alpha"), capabilities: capabilities("alpha"), hasPlanned: true };

describe("fleet manifests", () => {
  it("produces a valid derived manifest carrying every input hash", () => {
    const manifest = buildFleetManifest("estate", [mapped], deriveContext);

    expect(validateManifest(manifest).issues).toEqual([]);
    expect(manifest.stance).toBe("derived");
    expect(manifest.generatedFrom.derivedFrom).toEqual(
      [mapped.surfaces.contentHash, mapped.capabilities.contentHash].sort(),
    );
    // a fleet spans repositories, so there is no single commit to claim
    expect(manifest.generatedFrom.commit).toBeNull();
  });

  it("counts by type and reports misplacement without reading item detail", () => {
    const entry = buildFleetManifest("estate", [mapped], deriveContext).items[0];

    expect(entry).toMatchObject({
      id: "repo:alpha",
      repo: "alpha",
      path: "../alpha",
      state: "mapped",
      surfaceCount: 1,
      capabilityCount: 1,
      surfacesByType: { cli: 1 },
      capabilitiesByKind: { command: 1 },
      misplacedCount: 1,
      hasPlanned: true,
    });
  });

  it("records an unmapped or broken repository as a row rather than dropping it", () => {
    const manifest = buildFleetManifest(
      "estate",
      [
        mapped,
        { path: "../beta", surfaces: null, capabilities: null, hasPlanned: false },
        {
          path: "../gamma",
          surfaces: null,
          capabilities: null,
          hasPlanned: false,
          error: "surfaces invalid (2 issues)",
        },
      ],
      deriveContext,
    );

    expect(manifest.items.map((item) => item.state)).toEqual(["mapped", "not-mapped", "invalid"]);
    expect(manifest.items[2]?.note).toContain("surfaces invalid");
    expect(validateManifest(manifest).ok).toBe(true);
  });

  it("rejects a fleet that names the same repository twice", () => {
    const manifest = buildFleetManifest("estate", [mapped, mapped], deriveContext);

    expect(validateManifest(manifest).issues.map((issue) => issue.message)).toContain('duplicate id "repo:alpha"');
  });
});
