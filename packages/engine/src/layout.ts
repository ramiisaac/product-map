import { join } from "node:path";

import type { ManifestKind, Stance } from "@product-map/spec";

/** Canonical per-repo data directory. `pmap` never writes outside it. */
export function productMapDir(repoRoot: string): string {
  return join(repoRoot, "docs", "reference", "product-map");
}

/** Human-readable renderings live here; never a source of truth. */
export const GENERATED_DIR = "generated";

/**
 * A canonical manifest slot: the path a manifest lives at, plus the kind and
 * stance a file in that slot MUST declare. Loaders validate against this, so a
 * structurally valid manifest placed in the wrong slot (a capability manifest
 * saved as surfaces.existing.json) fails at load instead of crashing a later
 * stage that assumed the slot's type.
 */
export interface ManifestRole {
  rel: string;
  kind: ManifestKind;
  stance: Stance;
}

export const MANIFESTS = {
  surfacesExisting: { rel: "surfaces.existing.json", kind: "surface", stance: "existing" },
  capabilitiesExisting: { rel: "capabilities.existing.json", kind: "capability", stance: "existing" },
  surfacesPlanned: { rel: "surfaces.planned.json", kind: "surface", stance: "planned" },
  capabilitiesPlanned: { rel: "capabilities.planned.json", kind: "capability", stance: "planned" },
  mapExisting: { rel: "maps/map.existing.json", kind: "map", stance: "derived" },
  mapPlannedVsExisting: { rel: "maps/planned-surfaces-vs-existing-capabilities.json", kind: "map", stance: "derived" },
  mapExistingVsPlanned: { rel: "maps/existing-surfaces-vs-planned-capabilities.json", kind: "map", stance: "derived" },
  mapPlanned: { rel: "maps/map.planned.json", kind: "map", stance: "derived" },
  surfacesDiff: { rel: "diffs/surfaces.diff.json", kind: "diff", stance: "derived" },
  capabilitiesDiff: { rel: "diffs/capabilities.diff.json", kind: "diff", stance: "derived" },
} as const satisfies Record<string, ManifestRole>;

export type ManifestSlot = keyof typeof MANIFESTS;

/** Vendored asset sources read by `pmap init` and `pmap bundle`. */
export interface AssetPaths {
  promptsDir: string;
  schemasDir: string;
}
