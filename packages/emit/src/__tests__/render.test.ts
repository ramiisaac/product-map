import { describe, expect, it } from "vitest";

import { renderGaps } from "../render";
import { capabilities, capability, map, surface, surfaces } from "./fixtures";

describe("renderGaps", () => {
  it("separates orphan capabilities that are confirmed consumable from ones whose reach is undetermined", () => {
    const gaps = renderGaps(
      surfaces([surface({ binds: [] })]),
      capabilities([
        capability({ id: "cap:command:shipped", reach: "external" }),
        capability({ id: "cap:route:guess", kind: "route", reach: "unknown" }),
        capability({ id: "cap:service:plumbing", kind: "service", reach: "internal" }),
      ]),
      map([
        { capabilityId: "cap:command:shipped", relationship: "capability-unbound" },
        { capabilityId: "cap:route:guess", relationship: "capability-unbound" },
        { capabilityId: "cap:service:plumbing", relationship: "capability-unbound" },
      ]),
      "maps/map.existing.json",
    );

    const section = gaps.slice(gaps.indexOf("## 3."), gaps.indexOf("## 4."));
    const external = section.indexOf("### Confirmed externally consumable");
    const undetermined = section.indexOf("### Reach undetermined");

    expect(external).toBeGreaterThan(-1);
    expect(undetermined).toBeGreaterThan(external);
    expect(section.slice(external, undetermined)).toContain("cap:command:shipped");
    expect(section.slice(external, undetermined)).not.toContain("cap:route:guess");
    expect(section.slice(undetermined)).toContain("cap:route:guess");
    expect(section).not.toContain("cap:service:plumbing");
    expect(section).toContain("1 internal capability is");
  });
});
