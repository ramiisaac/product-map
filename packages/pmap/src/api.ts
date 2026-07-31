import type {
  CapabilityManifest,
  DeriveContext,
  DiffManifest,
  ExtractOptions,
  ExtractResult,
  FleetManifest,
  FleetRepoInput,
  Generator,
  MapManifest,
  MappingOptions,
  RepoContext,
  RepoContextOptions,
  SurfaceManifest,
} from "@product-map/spec";
import { createDeriveContext as createDeriveContextImpl } from "@product-map/derive";
import { buildFleetManifest as buildFleetManifestImpl } from "@product-map/derive";
import { diffManifests as diffManifestsImpl } from "@product-map/derive";
import { mapManifests as mapManifestsImpl } from "@product-map/derive";
import { loadRepoContext as loadRepoContextImpl } from "@product-map/discovery";
import { extractRepo as extractRepoImpl } from "@product-map/extract";

export type { ExtractOptions, FleetRepoInput, RepoContextOptions };

export function loadRepoContext(root: string, options?: RepoContextOptions): RepoContext {
  return loadRepoContextImpl(root, options);
}

export function extractRepo(ctx: RepoContext, options: ExtractOptions): Promise<ExtractResult> {
  return extractRepoImpl(ctx, options);
}

export function createDeriveContext(generator: Generator, mapping?: Partial<MappingOptions>): DeriveContext {
  return createDeriveContextImpl(generator, mapping);
}

export function mapManifests(
  surfaces: SurfaceManifest,
  capabilities: CapabilityManifest,
  context: DeriveContext,
): MapManifest {
  return mapManifestsImpl(surfaces, capabilities, context);
}

export function diffManifests(
  from: SurfaceManifest | CapabilityManifest,
  to: SurfaceManifest | CapabilityManifest,
  context: DeriveContext,
): DiffManifest {
  return diffManifestsImpl(from, to, context);
}

export function buildFleetManifest(name: string, repos: FleetRepoInput[], context: DeriveContext): FleetManifest {
  return buildFleetManifestImpl(name, repos, context);
}
