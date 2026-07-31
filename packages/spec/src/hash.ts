import { createHash } from "node:crypto";

import { canonicalStringify } from "./canonical";

/**
 * contentHash = sha256 (hex) over the canonical serialization of the `items`
 * array ONLY. Envelope metadata edits (generator version bumps, source-list
 * changes) do not churn the hash; item changes always do.
 */
export function computeContentHash(items: readonly unknown[]): string {
  return createHash("sha256").update(canonicalStringify(items), "utf8").digest("hex");
}
