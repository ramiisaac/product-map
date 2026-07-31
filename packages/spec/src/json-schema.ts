/**
 * The emitted JSON Schemas are the READER contract: `pmap init` vendors them
 * into consuming repos, where they outlive the tool version that wrote them.
 * If they enumerated the closed vocabularies, every v1.x vocabulary addition
 * would produce manifests that previously-vendored schemas reject — making
 * "additions are backward compatible within v1" true for writers only.
 *
 * So the additive vocabularies are relaxed to the value grammar plus a
 * description listing the values known at emit time, and the id patterns are
 * relaxed to the id grammar (the type-segment-equals-field rule is enforced
 * semantically by `validateManifest`, not by the pattern). The Zod schemas,
 * which are the writer contract inside this tool version, stay strict.
 *
 * The structural vocabularies — manifest kinds, stances, working-tree states,
 * and the schema version — stay closed: changing one of those is v2 by
 * definition, so a reader is right to reject an unknown value.
 */

import { CAPABILITY_ID_PATTERN, SURFACE_ID_PATTERN } from "./ids";
import {
  BIND_VIAS,
  CAPABILITY_KINDS,
  CAPABILITY_STATUSES,
  CONFIDENCES,
  DIFF_CHANGES,
  ENTRY_KINDS,
  FLEET_STATES,
  MAP_RELATIONSHIPS,
  PLACEMENT_VERDICTS,
  REACHES,
  SCHEMA_VERSION,
  SURFACE_AREAS,
  SURFACE_STATUSES,
  SURFACE_TYPES,
} from "./vocab";

export const SURFACE_ID_GRAMMAR = "^surface:[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9.-]*$";
export const CAPABILITY_ID_GRAMMAR = "^cap:[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9.-]*$";
export const VOCABULARY_VALUE_GRAMMAR = "^[a-z0-9][a-z0-9-]*$";

const ID_GRAMMARS = new Map<string, string>([
  [SURFACE_ID_PATTERN.source, SURFACE_ID_GRAMMAR],
  [CAPABILITY_ID_PATTERN.source, CAPABILITY_ID_GRAMMAR],
]);

export const ADDITIVE_VOCABULARIES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["surfaceType", SURFACE_TYPES],
  ["capabilityKind", CAPABILITY_KINDS],
  ["entryKind", ENTRY_KINDS],
  ["surfaceArea", SURFACE_AREAS],
  ["surfaceStatus", SURFACE_STATUSES],
  ["capabilityStatus", CAPABILITY_STATUSES],
  ["confidence", CONFIDENCES],
  ["reach", REACHES],
  ["placementVerdict", PLACEMENT_VERDICTS],
  ["bindVia", BIND_VIAS],
  ["mapRelationship", MAP_RELATIONSHIPS],
  ["diffChange", DIFF_CHANGES],
  ["fleetState", FLEET_STATES],
];

function matchesVocabulary(values: unknown[], vocabulary: readonly string[]): boolean {
  if (values.length !== vocabulary.length) {
    return false;
  }
  return values.every((value) => typeof value === "string" && vocabulary.includes(value));
}

function relaxNode(node: Record<string, unknown>): Record<string, unknown> {
  const pattern = node["pattern"];
  if (typeof pattern === "string") {
    const grammar = ID_GRAMMARS.get(pattern);
    if (grammar !== undefined) {
      return { ...node, pattern: grammar };
    }
  }

  const values = node["enum"];
  if (!Array.isArray(values)) {
    return node;
  }
  const vocabulary = ADDITIVE_VOCABULARIES.find(([, members]) => matchesVocabulary(values, members));
  if (vocabulary === undefined) {
    return node;
  }

  const relaxed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key !== "enum") {
      relaxed[key] = value;
    }
  }
  const note = `${SCHEMA_VERSION} ${vocabulary[0]}; known values: ${vocabulary[1].join(", ")}`;
  const existing = relaxed["description"];
  relaxed["type"] = "string";
  relaxed["pattern"] = VOCABULARY_VALUE_GRAMMAR;
  relaxed["description"] = typeof existing === "string" ? `${existing} ${note}` : note;
  return relaxed;
}

export function relaxForReaders(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((entry: unknown) => relaxForReaders(entry));
  }
  if (node === null || typeof node !== "object") {
    return node;
  }
  const walked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    walked[key] = relaxForReaders(value);
  }
  return relaxNode(walked);
}
