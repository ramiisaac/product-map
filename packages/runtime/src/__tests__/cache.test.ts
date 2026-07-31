import { describe, expect, it, vi } from "vitest";

import { createCache, NO_CACHE } from "../cache";

describe("cache", () => {
  it("computes once per key and reuses the value", () => {
    const cache = createCache();
    const compute = vi.fn(() => ({ walked: true }));

    const first = cache.get("walk", "src", compute);
    const second = cache.get("walk", "src", compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("keeps identical keys in different namespaces separate", () => {
    const cache = createCache();

    expect(cache.get("a", "same", () => 1)).toBe(1);
    expect(cache.get("b", "same", () => 2)).toBe(2);
    expect(cache.size()).toBe(2);
  });

  it("caches a computed undefined rather than recomputing it", () => {
    const cache = createCache();
    const compute = vi.fn(() => undefined);

    cache.get("ns", "key", compute);
    cache.get("ns", "key", compute);

    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("clears every entry", () => {
    const cache = createCache();
    cache.get("ns", "key", () => 1);

    cache.clear();

    expect(cache.size()).toBe(0);
  });

  it("NO_CACHE recomputes every time", () => {
    const compute = vi.fn(() => 1);

    NO_CACHE.get("ns", "key", compute);
    NO_CACHE.get("ns", "key", compute);

    expect(compute).toHaveBeenCalledTimes(2);
    expect(NO_CACHE.size()).toBe(0);
  });
});
