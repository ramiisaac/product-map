/**
 * Canonical JSON serialization for product-map.v1.
 *
 * Rules:
 * - object keys sorted lexicographically (recursively)
 * - 2-space indentation, LF line endings, single trailing newline
 * - no undefined values (dropped, matching JSON.stringify semantics)
 * - numbers must be finite; NaN/Infinity are serialization errors
 *
 * The same input value always produces byte-identical output, which is what
 * makes contentHash comparison and the CI freshness gate (regenerate and
 * byte-compare) sound.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const sorted: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      sorted[key] = sortValue(val);
    }
    return sorted;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("canonical JSON cannot represent non-finite numbers");
  }
  return value;
}

/** Return a deep copy of `value` with all object keys sorted. */
export function canonicalize<T>(value: T): T {
  return sortValue(value) as T;
}

/** Serialize `value` to the canonical string form (sorted keys, 2-space indent, trailing LF). */
export function canonicalStringify(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}
