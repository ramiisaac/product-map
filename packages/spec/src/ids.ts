import { CAPABILITY_KINDS, SURFACE_TYPES } from "./vocab";
import type { CapabilityKind, SurfaceType } from "./vocab";

/**
 * product-map.v1 id grammar.
 *
 * Surface ids:    surface:<surfaceType>:<slug>
 * Capability ids: cap:<capabilityKind>:<slug>
 *
 * Slugs are lowercase, start alphanumeric, and may contain `.` and `-` as
 * separators (e.g. `cli.scan`, `fleet-overview`). Ids are stable across
 * renames: a rename keeps the id and changes `name`; a new id is a
 * remove+add unless the diff records `renamed`.
 */

const SLUG = "[a-z0-9][a-z0-9.-]*";

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/^@[a-z0-9-]+\//, "")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return slug === "" ? "unnamed" : slug;
}

export const SURFACE_ID_PATTERN = new RegExp(`^surface:(${SURFACE_TYPES.join("|")}):${SLUG}$`);

export const CAPABILITY_ID_PATTERN = new RegExp(`^cap:(${CAPABILITY_KINDS.join("|")}):${SLUG}$`);

/** Fleet entry ids: one repository per entry, `repo:<slug>`. */
export const REPO_ID_PATTERN = new RegExp(`^repo:${SLUG}$`);

export function isSurfaceId(id: string): boolean {
  return SURFACE_ID_PATTERN.test(id);
}

export function isCapabilityId(id: string): boolean {
  return CAPABILITY_ID_PATTERN.test(id);
}

export function surfaceId(surfaceType: SurfaceType, slug: string): string {
  const id = `surface:${surfaceType}:${slug}`;
  if (!isSurfaceId(id)) {
    throw new Error(`invalid surface id: ${id}`);
  }
  return id;
}

export function capabilityId(kind: CapabilityKind, slug: string): string {
  const id = `cap:${kind}:${slug}`;
  if (!isCapabilityId(id)) {
    throw new Error(`invalid capability id: ${id}`);
  }
  return id;
}

/** The `<surfaceType>` segment of a surface id, or null when malformed. */
export function surfaceTypeOfId(id: string): SurfaceType | null {
  const match = SURFACE_ID_PATTERN.exec(id);
  return match ? (match[1] as SurfaceType) : null;
}

/** The `<capabilityKind>` segment of a capability id, or null when malformed. */
export function capabilityKindOfId(id: string): CapabilityKind | null {
  const match = CAPABILITY_ID_PATTERN.exec(id);
  return match ? (match[1] as CapabilityKind) : null;
}
