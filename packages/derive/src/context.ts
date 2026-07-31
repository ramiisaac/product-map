import type { DeriveContext, Generator, MappingOptions } from "@product-map/spec";

export type { DeriveContext, Generator, MappingOptions };

export const DEFAULT_MAPPING_OPTIONS: MappingOptions = {
  candidateThreshold: 0.5,
  maxCandidates: 3,
  scoreDecimalPlaces: 2,
  minTokenLength: 3,
};

export function createMappingOptions(overrides: Partial<MappingOptions> = {}): MappingOptions {
  return { ...DEFAULT_MAPPING_OPTIONS, ...overrides };
}

export function createDeriveContext(generator: Generator, mapping: Partial<MappingOptions> = {}): DeriveContext {
  return { generator, mapping: createMappingOptions(mapping) };
}
