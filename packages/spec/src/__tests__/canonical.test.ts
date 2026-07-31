import { describe, expect, it } from "vitest";

import { canonicalStringify } from "../canonical";
import { computeContentHash } from "../hash";

describe("canonical serialization", () => {
  it("is independent of key insertion order", () => {
    const a = { b: 1, a: { d: [1, 2], c: "x" } };
    const b = { a: { c: "x", d: [1, 2] }, b: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("is byte-stable across repeated runs", () => {
    const value = { z: null, m: [{ y: 2, x: 1 }], a: true };
    const first = canonicalStringify(value);
    for (let i = 0; i < 50; i += 1) {
      expect(canonicalStringify(value)).toBe(first);
    }
  });

  it("ends with exactly one trailing newline and uses LF", () => {
    const out = canonicalStringify({ a: 1 });
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
    expect(out.includes("\r")).toBe(false);
  });

  it("drops undefined values like JSON.stringify", () => {
    expect(canonicalStringify({ a: 1, b: undefined })).toBe(canonicalStringify({ a: 1 }));
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalStringify({ a: Number.NaN })).toThrow();
    expect(() => canonicalStringify({ a: Number.POSITIVE_INFINITY })).toThrow();
  });

  it("preserves array order (arrays are ordered data, not sets)", () => {
    expect(canonicalStringify([2, 1])).not.toBe(canonicalStringify([1, 2]));
  });
});

describe("content hash", () => {
  it("same items in different key order hash identically", () => {
    const itemsA = [{ id: "cap:command:scan", name: "scan" }];
    const itemsB = [{ name: "scan", id: "cap:command:scan" }];
    expect(computeContentHash(itemsA)).toBe(computeContentHash(itemsB));
  });

  it("any item change churns the hash", () => {
    const base = [{ id: "cap:command:scan", name: "scan" }];
    const changed = [{ id: "cap:command:scan", name: "scan2" }];
    expect(computeContentHash(base)).not.toBe(computeContentHash(changed));
  });

  it("is a 64-char lowercase hex digest", () => {
    expect(computeContentHash([])).toMatch(/^[0-9a-f]{64}$/);
  });
});
