import { describe, expect, it } from "vitest";

import { computeContentHash } from "../hash";
import { finalizeManifest, validateManifest } from "../manifest";
import type { SurfaceManifest } from "../manifest";
import { minimalCapabilityManifest, minimalSurfaceManifest } from "./fixtures";

describe("validateManifest — accept", () => {
  it("accepts a minimal valid surface manifest", () => {
    const result = validateManifest(minimalSurfaceManifest());
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("accepts a minimal valid capability manifest", () => {
    const result = validateManifest(minimalCapabilityManifest());
    expect(result.ok).toBe(true);
  });

  it("accepts a planned manifest with null commit (authored outside the repo)", () => {
    const manifest = minimalSurfaceManifest();
    const planned = finalizeManifest<SurfaceManifest>({
      ...manifest,
      stance: "planned",
      generatedFrom: { commit: null, workingTree: "not-applicable", sources: ["claude-design:project-x"] },
      generator: { name: "claude-design", version: "hosted" },
    });
    expect(validateManifest(planned).ok).toBe(true);
  });
});

describe("validateManifest — reject", () => {
  it("rejects a bad id grammar", () => {
    const manifest = minimalSurfaceManifest();
    const item = manifest.items[0]!;
    item.id = "surface:cli:Not_A_Slug";
    const result = validateManifest(finalizeManifest<SurfaceManifest>(manifest));
    expect(result.ok).toBe(false);
  });

  it("rejects id/type segment mismatch", () => {
    const manifest = minimalSurfaceManifest();
    const item = manifest.items[0]!;
    item.id = "surface:docs:fixture";
    const result = validateManifest(finalizeManifest<SurfaceManifest>(manifest));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("surfaceType"))).toBe(true);
  });

  it("rejects duplicate ids", () => {
    const manifest = minimalSurfaceManifest();
    manifest.items.push(structuredClone(manifest.items[0]!));
    const result = validateManifest(finalizeManifest<SurfaceManifest>(manifest));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("duplicate"))).toBe(true);
  });

  it("rejects a wrong contentHash", () => {
    const manifest = minimalSurfaceManifest();
    manifest.contentHash = "0".repeat(64);
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "contentHash")).toBe(true);
  });

  it("rejects unsorted items", () => {
    const manifest = minimalSurfaceManifest();
    const second = structuredClone(manifest.items[0]!);
    second.id = "surface:cli:aaa-first";
    const unsorted = finalizeManifest<SurfaceManifest>({ ...manifest, items: [...manifest.items, second] });
    // deliberately break the ordering after finalize, then re-stamp the hash
    unsorted.items.reverse();
    unsorted.contentHash = computeContentHash(unsorted.items);
    const result = validateManifest(unsorted);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("sorted"))).toBe(true);
  });

  it("rejects a bad enum value", () => {
    const manifest = minimalSurfaceManifest() as unknown as { items: { status: string }[] };
    manifest.items[0]!.status = "shipped";
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown extra fields (strict envelopes)", () => {
    const manifest = { ...minimalSurfaceManifest(), extra: true };
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
  });

  it("rejects surface/capability manifests with stance derived", () => {
    const manifest = finalizeManifest<SurfaceManifest>({
      ...minimalSurfaceManifest(),
      stance: "derived",
      generatedFrom: {
        commit: "0123456789abcdef",
        workingTree: "clean",
        sources: [],
        derivedFrom: ["a".repeat(64)],
      },
    });
    const result = validateManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "stance")).toBe(true);
  });
});
