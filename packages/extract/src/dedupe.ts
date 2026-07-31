import type { AdapterEntry, CollisionResolution, Confidence, SkippedItem } from "@product-map/spec";

export type { AdapterEntry, CollisionResolution, Confidence, SkippedItem };

export const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

type Dedupable = { id: string; provenance: { confidence: Confidence } };

/**
 * Collapse id collisions across adapters to one item per id.
 *
 * Precedence, in order:
 *   1. The repo-local extractor ("local") always wins — it is the repo's
 *      authoritative voice.
 *   2. Otherwise, higher provenance confidence wins.
 *   3. Only at EQUAL confidence does richness (a longer serialization) break
 *      the tie — bins and cli-commands both describe the CLI surface, and the
 *      fuller description should win between equals. Richness must never
 *      override higher confidence, which is why it is gated behind the
 *      equal-rank check rather than OR'd with it.
 *
 * Losers are recorded in `skipped`, never dropped silently, each carrying how
 * its collision was settled so doctor can tell the routine case (two adapters
 * describing one item) from the surprising one without re-reading the reason.
 */
function resolution(winner: string, loser: string, equalConfidence: boolean): CollisionResolution {
  if (winner === loser) return winner === "local" ? "local-duplicate" : "same-adapter";
  if (winner === "local") return "local-authority";
  return equalConfidence ? "richness" : "confidence";
}

export function dedupe<T extends Dedupable>(entries: Array<AdapterEntry<T>>, skipped: SkippedItem[]): T[] {
  const byId = new Map<string, AdapterEntry<T>>();
  for (const entry of entries) {
    const existing = byId.get(entry.item.id);
    if (existing === undefined) {
      byId.set(entry.item.id, entry);
      continue;
    }
    const newRank = CONFIDENCE_RANK[entry.item.provenance.confidence];
    const oldRank = CONFIDENCE_RANK[existing.item.provenance.confidence];
    const keepNew =
      entry.adapter === "local" ||
      (existing.adapter !== "local" &&
        (newRank > oldRank ||
          (newRank === oldRank && JSON.stringify(entry.item).length > JSON.stringify(existing.item).length)));
    const winner = keepNew ? entry : existing;
    const loser = keepNew ? existing : entry;
    const resolvedBy = resolution(winner.adapter, loser.adapter, newRank === oldRank);
    if (keepNew) {
      skipped.push({
        adapter: loser.adapter,
        id: loser.item.id,
        reason: `superseded by ${winner.adapter}`,
        collision: { winner: winner.adapter, resolvedBy },
      });
      byId.set(entry.item.id, entry);
    } else {
      skipped.push({
        adapter: loser.adapter,
        id: loser.item.id,
        reason: `duplicate of ${winner.adapter}`,
        collision: { winner: winner.adapter, resolvedBy },
      });
    }
  }
  return [...byId.values()].map((e) => e.item);
}
