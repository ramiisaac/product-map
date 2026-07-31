import type {
  CapabilityItem,
  CapabilityManifest,
  DeclaredRename,
  DiffEntry,
  DiffManifest,
  SurfaceItem,
  SurfaceManifest,
} from "@product-map/spec";
import { canonicalStringify, finalizeManifest } from "@product-map/spec";

import type { DeriveContext } from "./context";

type ItemManifest = SurfaceManifest | CapabilityManifest;

/**
 * Identity and extraction bookkeeping: the id keys the diff and provenance
 * describes how the item was found, not what it is. Everything else must
 * appear in a field list, which the exhaustiveness assertions below enforce.
 */
type ExcludedDiffField = "id" | "provenance";

const SURFACE_DIFF_FIELDS = [
  "surfaceType",
  "name",
  "entry",
  "purpose",
  "audience",
  "status",
  "views",
  "components",
  "dataNeeds",
  "actions",
  "states",
  "interactions",
  "outboundLinks",
  "binds",
  "placement",
  "ext",
] as const satisfies ReadonlyArray<keyof SurfaceItem>;

const CAPABILITY_DIFF_FIELDS = [
  "kind",
  "name",
  "purpose",
  "surfaceArea",
  "shape",
  "auth",
  "status",
  "reach",
  "inputs",
  "outputs",
  "sideEffects",
  "errors",
  "telemetry",
  "owners",
  "doctrine",
  "placement",
  "ext",
] as const satisfies ReadonlyArray<keyof CapabilityItem>;

type AssertCovered<T extends never> = T;

/**
 * Both are `never` by construction: every item field must be listed above or
 * named in `ExcludedDiffField`, so adding a schema field without deciding its
 * diff treatment fails to compile here instead of silently never diffing.
 */
export type UncoveredSurfaceDiffField = AssertCovered<
  Exclude<keyof SurfaceItem, (typeof SURFACE_DIFF_FIELDS)[number] | ExcludedDiffField>
>;
export type UncoveredCapabilityDiffField = AssertCovered<
  Exclude<keyof CapabilityItem, (typeof CAPABILITY_DIFF_FIELDS)[number] | ExcludedDiffField>
>;

type ItemRecord = Record<string, unknown>;

function fieldChangesBetween(
  from: ItemRecord,
  to: ItemRecord,
  kind: ItemManifest["kind"],
): NonNullable<DiffEntry["fieldChanges"]> {
  const fields = kind === "surface" ? SURFACE_DIFF_FIELDS : CAPABILITY_DIFF_FIELDS;
  const fieldChanges: NonNullable<DiffEntry["fieldChanges"]> = [];
  for (const field of fields) {
    const a = from[field];
    const b = to[field];
    if (canonicalStringify({ value: a }) !== canonicalStringify({ value: b })) {
      fieldChanges.push({
        path: `/${field}`,
        ...(a !== undefined ? { from: a } : {}),
        ...(b !== undefined ? { to: b } : {}),
      });
    }
  }
  return fieldChanges;
}

export type RenameRejectionReason = "kind-mismatch" | "unmatched";

export interface RenameRejection {
  rename: DeclaredRename;
  reason: RenameRejectionReason;
}

function idKind(id: string): "surface" | "capability" | null {
  if (id.startsWith("surface:")) return "surface";
  if (id.startsWith("cap:")) return "capability";
  return null;
}

interface ResolvedRename {
  rename: DeclaredRename;
  fromItem: ItemRecord;
  toItem: ItemRecord;
}

/**
 * Which declared renames a diff of this kind is responsible for. Routing is by
 * `fromId` so a capability rename is simply absent from the surface pass rather
 * than reported there as unmatched; an id in neither grammar lands on the
 * surface pass, where the kind check then rejects it loudly.
 */
function renamesForKind(
  renames: readonly DeclaredRename[] | undefined,
  kind: ItemManifest["kind"],
): readonly DeclaredRename[] {
  return (renames ?? []).filter(
    (rename) => (idKind(rename.fromId) === "capability" ? "capability" : "surface") === kind,
  );
}

function resolveRenames(
  fromById: ReadonlyMap<string, ItemRecord>,
  toById: ReadonlyMap<string, ItemRecord>,
  kind: ItemManifest["kind"],
  renames: readonly DeclaredRename[] | undefined,
): readonly ResolvedRename[] {
  const resolved: ResolvedRename[] = [];
  for (const rename of renamesForKind(renames, kind)) {
    if (idKind(rename.fromId) !== kind || idKind(rename.toId) !== kind) continue;
    const fromItem = fromById.get(rename.fromId);
    const toItem = toById.get(rename.toId);
    if (fromItem === undefined || toItem === undefined) continue;
    if (toById.has(rename.fromId) || fromById.has(rename.toId)) continue;
    resolved.push({ rename, fromItem, toItem });
  }
  return resolved;
}

/**
 * Declared renames this diff could not honor. Pure, so the engine can report
 * them through its logger without the derivation layer knowing about streams.
 */
export function rejectedRenames(
  from: ItemManifest,
  to: ItemManifest,
  renames: readonly DeclaredRename[] | undefined,
): readonly RenameRejection[] {
  const fromById = new Map(from.items.map((item) => [item.id, item as ItemRecord]));
  const toById = new Map(to.items.map((item) => [item.id, item as ItemRecord]));
  const applied = new Set(resolveRenames(fromById, toById, from.kind, renames).map((entry) => entry.rename));
  return renamesForKind(renames, from.kind)
    .filter((rename) => !applied.has(rename))
    .map((rename) => ({
      rename,
      reason:
        idKind(rename.fromId) !== from.kind || idKind(rename.toId) !== from.kind
          ? ("kind-mismatch" as const)
          : ("unmatched" as const),
    }));
}

/**
 * Same-kind, cross-stance diff keyed by id. Rename lineage is never inferred:
 * an id present on one side only is added/removed unless the config declares
 * the pair, and a declared pair that does not line up falls back to
 * added/removed rather than asserting a lineage the manifests contradict.
 */
export function diffManifests(from: ItemManifest, to: ItemManifest, context: DeriveContext): DiffManifest {
  if (from.kind !== to.kind) {
    throw new Error(`diff requires same-kind manifests (got ${from.kind} vs ${to.kind})`);
  }
  if (from.scope !== to.scope) {
    throw new Error(`diff requires manifests from the same scope (got different scopes: ${from.scope} vs ${to.scope})`);
  }
  const entries: DiffEntry[] = [];
  const fromById = new Map(from.items.map((i) => [i.id, i as ItemRecord]));
  const toById = new Map(to.items.map((i) => [i.id, i as ItemRecord]));

  const renames = resolveRenames(fromById, toById, from.kind, context.renames);
  const renamedFrom = new Set(renames.map((entry) => entry.rename.fromId));
  const renamedTo = new Set(renames.map((entry) => entry.rename.toId));

  for (const [id] of toById) {
    if (!fromById.has(id) && !renamedTo.has(id))
      entries.push({ id, change: "added", note: `present only in ${to.stance}` });
  }
  for (const [id] of fromById) {
    if (!toById.has(id) && !renamedFrom.has(id))
      entries.push({ id, change: "removed", note: `present only in ${from.stance}` });
  }
  for (const { rename, fromItem, toItem } of renames) {
    entries.push({
      fromId: rename.fromId,
      toId: rename.toId,
      change: "renamed",
      fieldChanges: fieldChangesBetween(fromItem, toItem, from.kind),
      ...(rename.note !== undefined ? { note: rename.note } : {}),
    });
  }
  for (const [id, fromItem] of fromById) {
    const toItem = toById.get(id);
    if (toItem === undefined) continue;
    const fieldChanges = fieldChangesBetween(fromItem, toItem, from.kind);
    if (fieldChanges.length === 0) continue;
    entries.push({ id, change: "changed", fieldChanges });
  }

  return finalizeManifest<DiffManifest>({
    schemaVersion: "product-map.v1",
    kind: "diff",
    stance: "derived",
    scope: from.scope,
    generatedFrom: {
      commit: to.generatedFrom.commit ?? from.generatedFrom.commit,
      workingTree: to.generatedFrom.workingTree,
      sources: [`${from.kind}s.${from.stance}.json`, `${to.kind}s.${to.stance}.json`],
      derivedFrom: [from.contentHash, to.contentHash],
    },
    generator: context.generator,
    items: entries,
  });
}
