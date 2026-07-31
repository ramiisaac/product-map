import type {
  AdapterIssue,
  CapabilityManifest,
  Generator,
  MapManifest,
  SkippedItem,
  SurfaceManifest,
} from "@product-map/spec";
import { loadRepoContext } from "@product-map/discovery";
import { mapManifests } from "@product-map/derive";
import { ADAPTERS, extractRepo } from "@product-map/extract";

import { deriveContextFor } from "./options";
import type { ResolvedOptions } from "./options";

export interface Inventory {
  surfaces: SurfaceManifest;
  capabilities: CapabilityManifest;
  map: MapManifest;
  adaptersAvailable: string[];
  adaptersRun: string[];
  adaptersExcluded: string[];
  skipped: SkippedItem[];
  localIssues: string[];
  adapterIssues: AdapterIssue[];
}

export interface InventoryInput {
  repoRoot: string;
  generator: Generator;
  options: ResolvedOptions;
  allowRepoCode: boolean;
}

/**
 * A live, in-memory inventory for the read-only commands. They extract rather
 * than read committed manifests so they work in a repository that has never
 * adopted product-map — which is exactly the repository someone points `show`
 * or `digest` at first.
 */
export async function loadInventory(input: InventoryInput): Promise<Inventory> {
  const ctx = loadRepoContext(input.repoRoot, input.options.discovery);
  const result = await extractRepo(ctx, {
    generator: input.generator,
    allowRepoCode: input.allowRepoCode,
    config: input.options.config,
    ...(input.options.config.localExtractor === undefined
      ? {}
      : { localExtractor: input.options.config.localExtractor }),
  });
  return {
    surfaces: result.surfaces,
    capabilities: result.capabilities,
    map: mapManifests(result.surfaces, result.capabilities, deriveContextFor(input.generator, input.options)),
    adaptersAvailable: ADAPTERS.map((adapter) => adapter.name),
    adaptersRun: result.adaptersRun,
    adaptersExcluded: [...(input.options.config.adapters?.exclude ?? [])],
    skipped: result.skipped,
    localIssues: result.localIssues,
    adapterIssues: result.adapterIssues,
  };
}
