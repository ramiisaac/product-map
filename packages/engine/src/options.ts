import type { DigestOptions, MappingOptions, RenderOptions, RepoConfig, RepoContextOptions } from "@product-map/spec";
import { createMappingOptions } from "@product-map/derive";
import type { DeriveContext, Generator } from "@product-map/derive";
import { createDigestOptions, createRenderOptions } from "@product-map/emit";
import { loadRepoConfig } from "@product-map/extract";

export const DEFAULT_CONCURRENCY = 4;

export interface OutputToggles {
  markdown: boolean;
  digest: boolean;
}

const DEFAULT_OUTPUTS: OutputToggles = { markdown: true, digest: true };

/**
 * The composed form of `product-map.config.mjs`. Lower layers take options and
 * never read the config file themselves, so this is the one place where a
 * user's declarations become the defaults every stage runs with.
 */
export interface ResolvedOptions {
  config: RepoConfig;
  mapping: MappingOptions;
  render: RenderOptions;
  digest: DigestOptions;
  discovery: RepoContextOptions;
  outputs: OutputToggles;
  concurrency: number;
}

export interface ResolveOptionsInput {
  repoRoot: string;
  allowRepoCode: boolean;
  configPath?: string | undefined;
}

export async function resolveOptions(input: ResolveOptionsInput): Promise<ResolvedOptions> {
  const config =
    input.configPath !== undefined || input.allowRepoCode ? await loadRepoConfig(input.repoRoot, input.configPath) : {};
  return {
    config,
    mapping: createMappingOptions(config.mapping),
    render: createRenderOptions(config.render),
    digest: createDigestOptions(config.digest),
    discovery: config.discovery ?? {},
    outputs: { ...DEFAULT_OUTPUTS, ...config.outputs },
    concurrency: config.concurrency ?? DEFAULT_CONCURRENCY,
  };
}

export function deriveContextFor(generator: Generator, options: ResolvedOptions): DeriveContext {
  return {
    generator,
    mapping: options.mapping,
    ...(options.config.renames !== undefined ? { renames: options.config.renames } : {}),
  };
}

export const EMPTY_OPTIONS: ResolvedOptions = {
  config: {},
  mapping: createMappingOptions(),
  render: createRenderOptions(),
  digest: createDigestOptions(),
  discovery: {},
  outputs: DEFAULT_OUTPUTS,
  concurrency: DEFAULT_CONCURRENCY,
};
