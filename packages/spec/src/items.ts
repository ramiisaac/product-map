import { z } from "zod";

import { CAPABILITY_ID_PATTERN, SURFACE_ID_PATTERN, capabilityKindOfId, surfaceTypeOfId } from "./ids";
import {
  BIND_VIAS,
  CAPABILITY_KINDS,
  CAPABILITY_STATUSES,
  CONFIDENCES,
  ENTRY_KINDS,
  PLACEMENT_VERDICTS,
  REACHES,
  SURFACE_AREAS,
  SURFACE_STATUSES,
  SURFACE_TYPES,
} from "./vocab";

export const ProvenanceSchema = z.strictObject({
  /** Where this item's description came from (file path, registry, design bundle, prompt output). */
  source: z.string().min(1),
  /** Exact evidence paths/locators. May be empty for planned items authored outside the repo. */
  evidence: z.array(z.string()),
  /** high = registry/manifest-derived; medium = filesystem-pattern-derived; low = docs/claims-derived. */
  confidence: z.enum(CONFIDENCES),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const PlacementSchema = z.strictObject({
  /** Where the item currently lives (package/app path). */
  current: z.string().min(1),
  /** Where it should live, when the verdict is `misplaced`. */
  canonical: z.string().min(1).optional(),
  verdict: z.enum(PLACEMENT_VERDICTS),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const BindSchema = z.strictObject({
  capabilityId: z.string().regex(CAPABILITY_ID_PATTERN),
  /** How the binding was established. `candidate-only` bindings are proposals, never assertions. */
  via: z.enum(BIND_VIAS),
  note: z.string().optional(),
});
export type Bind = z.infer<typeof BindSchema>;

export const EntrySchema = z.strictObject({
  kind: z.enum(ENTRY_KINDS),
  /** The concrete locator: a route path, command name, bin name, template id, tool name, ... */
  value: z.string().min(1),
});
export type Entry = z.infer<typeof EntrySchema>;

const ViewSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().optional(),
  states: z.array(z.string()).optional(),
});

const DataNeedSchema = z.strictObject({
  id: z.string().min(1),
  description: z.string().min(1),
  boundCapability: z.string().regex(CAPABILITY_ID_PATTERN).optional(),
});

const ActionSchema = z.strictObject({
  id: z.string().min(1),
  description: z.string().min(1),
  boundCapability: z.string().regex(CAPABILITY_ID_PATTERN).optional(),
});

export const SurfaceItemSchema = z
  .strictObject({
    id: z.string().regex(SURFACE_ID_PATTERN),
    surfaceType: z.enum(SURFACE_TYPES),
    name: z.string().min(1),
    entry: EntrySchema,
    purpose: z.string().min(1),
    audience: z.array(z.string()),
    status: z.enum(SURFACE_STATUSES),
    views: z.array(ViewSchema).optional(),
    components: z.array(z.string()).optional(),
    dataNeeds: z.array(DataNeedSchema).optional(),
    actions: z.array(ActionSchema).optional(),
    states: z.array(z.string()).optional(),
    interactions: z.array(z.string()).optional(),
    /** Ids of other surfaces this one links out to. */
    outboundLinks: z.array(z.string().regex(SURFACE_ID_PATTERN)).optional(),
    /** Bindings to capabilities. Empty is a legal, first-class state (an unbound surface). */
    binds: z.array(BindSchema),
    placement: PlacementSchema,
    provenance: ProvenanceSchema,
    /** Namespaced repo-specific extensions (like OpenAPI x- fields). Core tools pass this through untouched. */
    ext: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((item, ctx) => {
    if (surfaceTypeOfId(item.id) !== item.surfaceType) {
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: `id type segment must match surfaceType "${item.surfaceType}"`,
      });
    }
  });
export type SurfaceItem = z.infer<typeof SurfaceItemSchema>;

export const CapabilityItemSchema = z
  .strictObject({
    id: z.string().regex(CAPABILITY_ID_PATTERN),
    kind: z.enum(CAPABILITY_KINDS),
    name: z.string().min(1),
    /** What the capability does. Optional: an extractor that cannot know omits it rather than inventing one. */
    purpose: z.string().min(1).optional(),
    surfaceArea: z.enum(SURFACE_AREAS),
    /** JSON Schema of the capability's shape where derivable (zod, OpenAPI, protobuf). */
    shape: z.unknown().optional(),
    auth: z
      .strictObject({
        required: z.boolean(),
        scheme: z.string().optional(),
        scopes: z.array(z.string()).optional(),
      })
      .optional(),
    status: z.enum(CAPABILITY_STATUSES),
    /** Whether anything outside the repository can consume this directly. Orthogonal to `status`. */
    reach: z.enum(REACHES),
    inputs: z.array(z.unknown()).optional(),
    outputs: z.array(z.unknown()).optional(),
    sideEffects: z.array(z.string()).optional(),
    errors: z.array(z.string()).optional(),
    telemetry: z.array(z.string()).optional(),
    owners: z.array(z.string()).optional(),
    /** Architectural rules this capability is bound by. Not a description — that is `purpose`. */
    doctrine: z.array(z.string()).optional(),
    placement: PlacementSchema,
    provenance: ProvenanceSchema,
    /** Namespaced repo-specific extensions (like OpenAPI x- fields). Core tools pass this through untouched. */
    ext: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((item, ctx) => {
    if (capabilityKindOfId(item.id) !== item.kind) {
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: `id kind segment must match kind "${item.kind}"`,
      });
    }
  });
export type CapabilityItem = z.infer<typeof CapabilityItemSchema>;
