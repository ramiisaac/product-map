import type { CapabilityManifest, SurfaceManifest } from "../manifest";
import { finalizeManifest } from "../manifest";

export function minimalSurfaceManifest(): SurfaceManifest {
  return finalizeManifest<SurfaceManifest>({
    schemaVersion: "product-map.v1",
    kind: "surface",
    stance: "existing",
    scope: "fixture-repo",
    generatedFrom: { commit: "0123456789abcdef", workingTree: "clean", sources: ["apps/cli/src"] },
    generator: { name: "manual", version: "0.0.1" },
    items: [
      {
        id: "surface:cli:fixture",
        surfaceType: "cli",
        name: "Fixture CLI",
        entry: { kind: "bin", value: "fixture" },
        purpose: "A minimal valid surface item for tests.",
        audience: ["developer"],
        status: "live",
        binds: [{ capabilityId: "cap:command:scan", via: "explicit" }],
        placement: { current: "apps/cli", verdict: "correct" },
        provenance: { source: "apps/cli/package.json", evidence: ["apps/cli/package.json"], confidence: "high" },
      },
    ],
  });
}

export function minimalCapabilityManifest(): CapabilityManifest {
  return finalizeManifest<CapabilityManifest>({
    schemaVersion: "product-map.v1",
    kind: "capability",
    stance: "existing",
    scope: "fixture-repo",
    generatedFrom: { commit: "0123456789abcdef", workingTree: "clean", sources: ["apps/cli/src/commands"] },
    generator: { name: "manual", version: "0.0.1" },
    items: [
      {
        id: "cap:command:scan",
        kind: "command",
        name: "scan",
        surfaceArea: "cli",
        status: "live",
        reach: "external",
        placement: { current: "apps/cli", verdict: "correct" },
        provenance: {
          source: "apps/cli/src/commands/scan.ts",
          evidence: ["apps/cli/src/commands/scan.ts"],
          confidence: "high",
        },
      },
    ],
  });
}
