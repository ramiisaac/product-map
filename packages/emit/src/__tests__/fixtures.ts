import type { CapabilityItem, CapabilityManifest, MapManifest, SurfaceItem, SurfaceManifest } from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";

const GENERATOR = { name: "pmap", version: "0.0.0" } as const;
const COMMIT = "abcdef0123456789abcdef0123456789abcdef01";

function envelope<T>(kind: string, stance: string, items: unknown[]): T {
  return finalizeManifest({
    schemaVersion: "product-map.v1",
    kind,
    stance,
    scope: "fixture",
    generatedFrom: { commit: COMMIT, workingTree: "clean", sources: ["package.json"] },
    generator: GENERATOR,
    items,
  } as never) as T;
}

export function surface(overrides: Partial<SurfaceItem> = {}): SurfaceItem {
  return {
    id: "surface:cli:fixture",
    surfaceType: "cli",
    name: "fixture CLI",
    entry: { kind: "command", value: "fixture" },
    purpose: "The command-line entry point.",
    audience: ["developer"],
    status: "live",
    binds: [{ capabilityId: "cap:command:fixture.scan", via: "explicit" }],
    placement: { current: "packages/cli", verdict: "correct" },
    provenance: { source: "packages/cli/package.json", evidence: ["packages/cli/package.json"], confidence: "high" },
    ...overrides,
  };
}

export function capability(overrides: Partial<CapabilityItem> = {}): CapabilityItem {
  return {
    id: "cap:command:fixture.scan",
    kind: "command",
    name: "fixture scan",
    purpose: "Scan the repository.",
    surfaceArea: "cli",
    status: "live",
    reach: "external",
    placement: { current: "packages/cli", verdict: "correct" },
    provenance: {
      source: "packages/cli/src/commands/scan.ts",
      evidence: ["packages/cli/src/commands/scan.ts"],
      confidence: "high",
    },
    ...overrides,
  };
}

export function surfaces(items: SurfaceItem[] = [surface()]): SurfaceManifest {
  return envelope<SurfaceManifest>("surface", "existing", items);
}

export function capabilities(items: CapabilityItem[] = [capability()]): CapabilityManifest {
  return envelope<CapabilityManifest>("capability", "existing", items);
}

export function map(items: MapManifest["items"]): MapManifest {
  return finalizeManifest<MapManifest>({
    schemaVersion: "product-map.v1",
    kind: "map",
    stance: "derived",
    scope: "fixture",
    generatedFrom: {
      commit: COMMIT,
      workingTree: "clean",
      sources: ["surfaces.existing.json"],
      derivedFrom: ["a".repeat(64)],
    },
    generator: GENERATOR,
    items,
  });
}
