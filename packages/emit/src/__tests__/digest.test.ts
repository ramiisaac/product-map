import { describe, expect, it } from "vitest";

import { buildDigest, renderDigest } from "../digest";
import { capabilities, capability, map, surface, surfaces } from "./fixtures";

function inventory() {
  return {
    surfaces: surfaces([surface(), surface({ id: "surface:mcp:fixture", surfaceType: "mcp", binds: [] })]),
    capabilities: capabilities([capability(), capability({ id: "cap:route:fixture.docs", kind: "route" })]),
    map: map([
      { surfaceId: "surface:cli:fixture", capabilityId: "cap:command:fixture.scan", relationship: "bound" },
      { surfaceId: "surface:mcp:fixture", relationship: "surface-unbound" },
      { capabilityId: "cap:route:fixture.docs", relationship: "capability-unbound" },
    ]),
  };
}

describe("buildDigest", () => {
  it("reads the recorded commit rather than anything live", () => {
    const data = buildDigest(inventory());

    expect(data.commit).toBe("abcdef0123456789abcdef0123456789abcdef01");
    expect(data.scope).toBe("fixture");
    expect(data.surfaceCount).toBe(2);
    expect(data.capabilityCount).toBe(2);
  });

  it("reports only the relationships that represent a gap", () => {
    const data = buildDigest(inventory());

    expect(data.gaps).toEqual([
      { relationship: "capability-unbound", id: "cap:route:fixture.docs" },
      { relationship: "surface-unbound", id: "surface:mcp:fixture" },
    ]);
    expect(data.relationshipCounts).toEqual({ bound: 1, "surface-unbound": 1, "capability-unbound": 1 });
  });

  it("omits an unreferenced capability nothing outside the repo could consume", () => {
    const base = inventory();
    const data = buildDigest({
      ...base,
      capabilities: capabilities([
        capability(),
        capability({ id: "cap:service:fixture.internal", kind: "service", reach: "internal" }),
      ]),
      map: map([
        { surfaceId: "surface:cli:fixture", capabilityId: "cap:command:fixture.scan", relationship: "bound" },
        { capabilityId: "cap:service:fixture.internal", relationship: "capability-unbound" },
      ]),
    });

    expect(data.gaps).toEqual([]);
  });

  it("groups capabilities by kind with their distinct paths", () => {
    const data = buildDigest(inventory());

    expect(data.capabilities.map((group) => group.kind)).toEqual(["command", "route"]);
    expect(data.capabilities[0]?.paths).toEqual(["packages/cli"]);
  });
});

describe("renderDigest", () => {
  it("leads with paths and marks a surface that fronts nothing", () => {
    const text = renderDigest(buildDigest(inventory()));

    expect(text).toContain("surface:cli:fixture");
    expect(text).toContain("packages/cli");
    expect(text).toContain("UNBOUND");
    expect(text).toContain("GAPS");
  });

  it("truncates to the token budget and says it did", () => {
    const text = renderDigest(buildDigest(inventory()), { maxTokens: 10 });

    expect(text).toContain("over the 10-token budget");
    expect(text.length).toBeLessThan(renderDigest(buildDigest(inventory())).length);
  });

  it("is deterministic, so it can be a committed artifact", () => {
    expect(renderDigest(buildDigest(inventory()))).toBe(renderDigest(buildDigest(inventory())));
  });
});
