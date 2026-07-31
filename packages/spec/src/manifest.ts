import { z } from "zod";

import { canonicalize, canonicalStringify } from "./canonical";
import { DiffEntrySchema, FleetEntrySchema, MapEntrySchema } from "./entries";
import { computeContentHash } from "./hash";
import { CapabilityItemSchema, SurfaceItemSchema } from "./items";
import { SCHEMA_VERSION, STANCES, WORKING_TREE_STATES } from "./vocab";

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Manifest kinds that are always computed from other manifests. */
const DERIVED_KINDS = new Set<string>(["map", "diff", "fleet"]);

export const GeneratedFromSchema = z.strictObject({
  /** Commit SHA the manifest was generated from. Null for planned manifests authored outside the repo. */
  commit: z.string().min(7).nullable(),
  workingTree: z.enum(WORKING_TREE_STATES),
  /** Files/registries/design-project locators this manifest was derived from. */
  sources: z.array(z.string()),
  /** For derived manifests: contentHashes of the input manifests. */
  derivedFrom: z.array(z.string().regex(SHA256_HEX)).optional(),
});

export const GeneratorSchema = z.strictObject({
  /** "pmap" | "claude-design" | "manual" | future generators. */
  name: z.string().min(1),
  version: z.string().min(1),
});
export type Generator = z.infer<typeof GeneratorSchema>;

function envelope<Kind extends string, Items extends z.ZodTypeAny>(kind: Kind, items: Items) {
  return z.strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    kind: z.literal(kind),
    stance: z.enum(STANCES),
    /** What this manifest describes: a repository name, or the fleet name when kind is `fleet`. */
    scope: z.string().min(1),
    generatedFrom: GeneratedFromSchema,
    generator: GeneratorSchema,
    contentHash: z.string().regex(SHA256_HEX),
    items: z.array(items),
    /** Namespaced repo-specific extensions. Not covered by contentHash (envelope metadata). */
    ext: z.record(z.string(), z.unknown()).optional(),
  });
}

export const SurfaceManifestSchema = envelope("surface", SurfaceItemSchema);
export const CapabilityManifestSchema = envelope("capability", CapabilityItemSchema);
export const MapManifestSchema = envelope("map", MapEntrySchema);
export const DiffManifestSchema = envelope("diff", DiffEntrySchema);
export const FleetManifestSchema = envelope("fleet", FleetEntrySchema);

export const ManifestSchema = z.discriminatedUnion("kind", [
  SurfaceManifestSchema,
  CapabilityManifestSchema,
  MapManifestSchema,
  DiffManifestSchema,
  FleetManifestSchema,
]);

export type SurfaceManifest = z.infer<typeof SurfaceManifestSchema>;
export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;
export type MapManifest = z.infer<typeof MapManifestSchema>;
export type DiffManifest = z.infer<typeof DiffManifestSchema>;
export type FleetManifest = z.infer<typeof FleetManifestSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

function sortKeyOf(item: unknown): string {
  if (item !== null && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["id", "surfaceId", "capabilityId", "fromId"]) {
      const value = record[key];
      if (typeof value === "string") return `${key}:${value}`;
    }
  }
  return canonicalStringify(item);
}

/**
 * Full manifest validation: schema shape, item-id uniqueness (surface and
 * capability manifests), stable item ordering, stance/kind coherence, and
 * contentHash integrity. Everything `pmap validate` enforces lives here so
 * hand-authored and Claude-Design-authored manifests hit the same bar.
 */
export function validateManifest(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const parsed = ManifestSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ path: issue.path.join("."), message: issue.message });
    }
    return { ok: false, issues };
  }
  const manifest = parsed.data;

  if (DERIVED_KINDS.has(manifest.kind) && manifest.stance !== "derived") {
    issues.push({ path: "stance", message: `${manifest.kind} manifests must use stance "derived"` });
  }
  if ((manifest.kind === "surface" || manifest.kind === "capability") && manifest.stance === "derived") {
    issues.push({ path: "stance", message: `${manifest.kind} manifests must use stance "existing" or "planned"` });
  }
  if (manifest.stance === "derived" && manifest.generatedFrom.derivedFrom === undefined) {
    issues.push({ path: "generatedFrom.derivedFrom", message: "derived manifests must record derivedFrom hashes" });
  }

  if (manifest.kind === "surface" || manifest.kind === "capability" || manifest.kind === "fleet") {
    const seen = new Set<string>();
    for (const [index, item] of manifest.items.entries()) {
      if (seen.has(item.id)) {
        issues.push({ path: `items.${index}.id`, message: `duplicate id "${item.id}"` });
      }
      seen.add(item.id);
    }
  }

  const keys = manifest.items.map(sortKeyOf);
  for (let i = 1; i < keys.length; i += 1) {
    const current = keys[i];
    const previous = keys[i - 1];
    if (current !== undefined && previous !== undefined && current < previous) {
      issues.push({ path: `items.${i}`, message: "items must be sorted by id (stable order)" });
      break;
    }
  }

  const expected = computeContentHash(manifest.items);
  if (manifest.contentHash !== expected) {
    issues.push({
      path: "contentHash",
      message: `contentHash mismatch: expected ${expected}, found ${manifest.contentHash}`,
    });
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Sort items, canonicalize, and stamp the contentHash. This is a stamping
 * operation, not a validation one: it makes the envelope internally consistent
 * (sorted items, matching hash) but does not check schema shape, id grammar,
 * or stance/kind coherence. Run `validateManifest` when those must hold — the
 * CLI does after extraction and on every load.
 */
export function finalizeManifest<T extends { items: unknown[]; contentHash?: string }>(
  manifest: Omit<T, "contentHash"> & { contentHash?: string },
): T {
  const items = [...manifest.items].sort((a, b) => {
    const ka = sortKeyOf(a);
    const kb = sortKeyOf(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const finalized = canonicalize({ ...manifest, items, contentHash: computeContentHash(items) });
  return finalized as T;
}

/** Canonical on-disk form of a manifest. */
export function serializeManifest(manifest: Manifest): string {
  return canonicalStringify(manifest);
}
