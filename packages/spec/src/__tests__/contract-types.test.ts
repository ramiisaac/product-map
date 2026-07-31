import { describe, expect, it } from "vitest";

import type { RepoConfig } from "../contract";

/**
 * The assertion is the type annotation: `overrides` used to be typed as an
 * intersection, which collapsed `status` to the values the surface and
 * capability enums share, so a consumer could not write a status that is legal
 * at runtime. This fixture fails `tsc`, not vitest, when that regresses.
 */
const config: RepoConfig = {
  overrides: {
    "cap:command:scan": { status: "deprecated" },
    "cap:package:core": { status: "preview", reach: "internal" },
    "surface:cli:pmap": { status: "stale" },
    "surface:docs:guide": { status: "prototype" },
  },
};

describe("RepoConfig overrides", () => {
  it("accepts every status either item kind allows", () => {
    expect(Object.keys(config.overrides ?? {})).toHaveLength(4);
  });
});
