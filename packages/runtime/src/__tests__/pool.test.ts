import { describe, expect, it } from "vitest";

import { pool } from "../pool";

describe("pool", () => {
  it("returns results in input order regardless of completion order", async () => {
    const delays = [40, 0, 20, 10];

    const results = await pool(
      delays,
      async (delay, index) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return index;
      },
      { concurrency: 4 },
    );

    expect(results).toEqual([0, 1, 2, 3]);
  });

  it("never exceeds the configured concurrency", async () => {
    const concurrency = 2;
    let inFlight = 0;
    let peak = 0;

    await pool(
      Array.from({ length: 10 }, (_unused, index) => index),
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      },
      { concurrency },
    );

    expect(peak).toBeLessThanOrEqual(concurrency);
  });

  it("handles an empty input without spawning workers", async () => {
    expect(await pool([], async () => 1)).toEqual([]);
  });

  it("propagates a worker failure", async () => {
    await expect(
      pool([1, 2], async (value) => {
        if (value === 2) throw new Error("worker failed");
        return value;
      }),
    ).rejects.toThrow("worker failed");
  });
});
