import { z } from "zod";

import { CAPABILITY_ID_PATTERN, REPO_ID_PATTERN, SURFACE_ID_PATTERN } from "./ids";
import {
  CAPABILITY_KINDS,
  DIFF_CHANGES,
  FLEET_STATES,
  MAP_RELATIONSHIPS,
  SURFACE_TYPES,
  WORKING_TREE_STATES,
} from "./vocab";

const AnyItemId = z.union([z.string().regex(SURFACE_ID_PATTERN), z.string().regex(CAPABILITY_ID_PATTERN)]);

const CandidateSchema = z.strictObject({
  id: AnyItemId,
  /** Similarity score in [0, 1]. Candidates are proposals; the mapper never binds from them silently. */
  score: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export const MapEntrySchema = z
  .strictObject({
    surfaceId: z.string().regex(SURFACE_ID_PATTERN).optional(),
    capabilityId: z.string().regex(CAPABILITY_ID_PATTERN).optional(),
    relationship: z.enum(MAP_RELATIONSHIPS),
    candidates: z.array(CandidateSchema).optional(),
    note: z.string().optional(),
    ext: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.surfaceId === undefined && entry.capabilityId === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "a map entry must reference at least one of surfaceId / capabilityId",
      });
    }
  });
export type MapEntry = z.infer<typeof MapEntrySchema>;

const FieldChangeSchema = z.strictObject({
  /** JSON pointer into the item (e.g. "/entry/value", "/status"). */
  path: z.string().min(1),
  from: z.unknown().optional(),
  to: z.unknown().optional(),
});

export const DiffEntrySchema = z
  .strictObject({
    /** Same-id change. Mutually exclusive with fromId/toId. */
    id: AnyItemId.optional(),
    /** Rename/split/merge lineage. */
    fromId: AnyItemId.optional(),
    toId: AnyItemId.optional(),
    change: z.enum(DIFF_CHANGES),
    fieldChanges: z.array(FieldChangeSchema).optional(),
    note: z.string().optional(),
    ext: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((entry, ctx) => {
    const hasId = entry.id !== undefined;
    const hasPair = entry.fromId !== undefined || entry.toId !== undefined;
    if (hasId === hasPair) {
      ctx.addIssue({
        code: "custom",
        message: "a diff entry uses exactly one of: `id`, or `fromId`/`toId`",
      });
    }
    if (entry.change === "renamed" && (entry.fromId === undefined || entry.toId === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "`renamed` requires both fromId and toId",
      });
    }
  });
export type DiffEntry = z.infer<typeof DiffEntrySchema>;

/**
 * One repository in a fleet manifest: the shape of its committed product map,
 * not its contents. Counts are recorded per surfaceType and capabilityKind so
 * the rendered matrix is a projection of data rather than of prose, and the
 * repository's own contentHashes go in the envelope's `derivedFrom`.
 */
export const FleetEntrySchema = z.strictObject({
  id: z.string().regex(REPO_ID_PATTERN),
  /** The `repo` field of that repository's own manifests. */
  repo: z.string().min(1),
  /** Path the fleet run read, as given on the command line or in the roster. */
  path: z.string().min(1),
  commit: z.string().min(7).nullable(),
  workingTree: z.enum(WORKING_TREE_STATES),
  /** `mapped` when both existing manifests parsed; otherwise the reason the row is empty. */
  state: z.enum(FLEET_STATES),
  surfaceCount: z.number().int().min(0),
  capabilityCount: z.number().int().min(0),
  /** Count per surfaceType, sparse: types with no items are absent, never zero. */
  surfacesByType: z.partialRecord(z.enum(SURFACE_TYPES), z.number().int().min(1)),
  capabilitiesByKind: z.partialRecord(z.enum(CAPABILITY_KINDS), z.number().int().min(1)),
  /** Items whose placement verdict is `misplaced`, across both manifests. */
  misplacedCount: z.number().int().min(0),
  /** Whether the repository has ingested a planned stance yet. */
  hasPlanned: z.boolean(),
  note: z.string().optional(),
  ext: z.record(z.string(), z.unknown()).optional(),
});
export type FleetEntry = z.infer<typeof FleetEntrySchema>;
