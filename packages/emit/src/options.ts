import type { DigestOptions, RenderOptions } from "@product-map/spec";

export type { DigestOptions, RenderOptions };

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  descriptionLimit: 160,
  collapseThreshold: 15,
  commitDisplayLength: 12,
  shortCommitDisplayLength: 8,
  maxListedItems: 10,
  maxListedBinds: 12,
  maxListedViews: 15,
  maxEvidencePaths: 3,
  maxReconciliationItems: 40,
};

export const DEFAULT_DIGEST_OPTIONS: DigestOptions = {
  maxTokens: 1200,
  charsPerToken: 4,
  maxListedNames: 6,
  commitDisplayLength: 8,
};

export function createRenderOptions(overrides: Partial<RenderOptions> = {}): RenderOptions {
  return { ...DEFAULT_RENDER_OPTIONS, ...overrides };
}

export function createDigestOptions(overrides: Partial<DigestOptions> = {}): DigestOptions {
  return { ...DEFAULT_DIGEST_OPTIONS, ...overrides };
}

const ELLIPSIS = "...";

export function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - ELLIPSIS.length)}${ELLIPSIS}` : value;
}
