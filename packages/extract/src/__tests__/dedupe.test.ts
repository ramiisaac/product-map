import { describe, expect, it } from "vitest";

import type { Confidence, SkippedItem } from "..";
import { dedupe } from "..";

interface Item {
  id: string;
  provenance: { confidence: Confidence };
  filler?: string;
}

function entry(adapter: string, confidence: Confidence, filler = ""): { adapter: string; item: Item } {
  return { adapter, item: { id: "surface:cli:x", provenance: { confidence }, ...(filler ? { filler } : {}) } };
}

describe("dedupe precedence", () => {
  it("keeps the higher-confidence item even when a lower-confidence collision is richer", () => {
    const skipped: SkippedItem[] = [];
    // high-confidence short item first, then a medium-confidence LONGER collision
    const [kept] = dedupe([entry("bins", "high"), entry("cli-commands", "medium", "x".repeat(500))], skipped);

    expect(kept?.provenance.confidence).toBe("high");
    expect(skipped).toContainEqual({
      adapter: "cli-commands",
      id: "surface:cli:x",
      reason: "duplicate of bins",
      collision: { winner: "bins", resolvedBy: "confidence" },
    });
  });

  it("breaks ties by richness only at equal confidence", () => {
    const skipped: SkippedItem[] = [];
    const [kept] = dedupe([entry("bins", "medium"), entry("cli-commands", "medium", "x".repeat(500))], skipped);

    expect(kept?.filler).toBe("x".repeat(500));
  });

  it("promotes a strictly higher-confidence later item", () => {
    const skipped: SkippedItem[] = [];
    const [kept] = dedupe([entry("cli-commands", "medium"), entry("bins", "high")], skipped);

    expect(kept?.provenance.confidence).toBe("high");
  });

  it("lets the local extractor win regardless of confidence or richness", () => {
    const skipped: SkippedItem[] = [];
    const [kept] = dedupe([entry("bins", "high", "x".repeat(500)), entry("local", "low")], skipped);

    expect(kept?.provenance.confidence).toBe("low");
  });

  it("never lets a generic adapter displace the local extractor", () => {
    const skipped: SkippedItem[] = [];
    const [kept] = dedupe([entry("local", "low"), entry("bins", "high", "x".repeat(500))], skipped);

    expect(kept?.provenance.confidence).toBe("low");
  });
});

describe("recorded collision resolution", () => {
  it("marks an equal-confidence tie as settled by richness", () => {
    const skipped: SkippedItem[] = [];
    dedupe([entry("bins", "high"), entry("cli-commands", "high", "x".repeat(500))], skipped);

    expect(skipped[0]?.collision).toEqual({ winner: "cli-commands", resolvedBy: "richness" });
  });

  it("marks a generic adapter losing to the local extractor as local authority", () => {
    const skipped: SkippedItem[] = [];
    dedupe([entry("bins", "high"), entry("local", "low")], skipped);

    expect(skipped[0]?.collision).toEqual({ winner: "local", resolvedBy: "local-authority" });
  });

  it("distinguishes one adapter emitting the same id twice from two adapters overlapping", () => {
    const skipped: SkippedItem[] = [];
    dedupe([entry("bins", "high"), entry("bins", "high", "x")], skipped);

    expect(skipped[0]?.collision).toEqual({ winner: "bins", resolvedBy: "same-adapter" });
  });

  it("distinguishes the local extractor colliding with itself", () => {
    const skipped: SkippedItem[] = [];
    dedupe([entry("local", "high"), entry("local", "high", "x")], skipped);

    expect(skipped[0]).toEqual({
      adapter: "local",
      id: "surface:cli:x",
      reason: "superseded by local",
      collision: { winner: "local", resolvedBy: "local-duplicate" },
    });
  });
});
