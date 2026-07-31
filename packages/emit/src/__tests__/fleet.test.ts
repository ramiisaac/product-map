import type { FleetManifest } from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { renderFleet } from "../render";

function fleetManifest(): FleetManifest {
  return finalizeManifest<FleetManifest>({
    schemaVersion: "product-map.v1",
    kind: "fleet",
    stance: "derived",
    scope: "estate",
    generatedFrom: {
      commit: null,
      workingTree: "not-applicable",
      sources: ["../alpha"],
      derivedFrom: ["a".repeat(64)],
    },
    generator: { name: "pmap", version: "0.0.0" },
    items: [
      {
        id: "repo:alpha",
        repo: "alpha",
        path: "../alpha",
        commit: "a".repeat(40),
        workingTree: "clean",
        state: "mapped",
        surfaceCount: 1,
        capabilityCount: 1,
        surfacesByType: { cli: 1 },
        capabilitiesByKind: { command: 1 },
        misplacedCount: 1,
        hasPlanned: true,
      },
    ],
  });
}

describe("renderFleet", () => {
  it("renders only what the manifest says", () => {
    const manifest = fleetManifest();

    const markdown = renderFleet(manifest, "fleet.json");

    expect(markdown).toContain(`fleet.json@${manifest.contentHash}`);
    expect(markdown).toContain("| alpha |");
    expect(markdown).toContain("**1**");
    expect(markdown).toContain("1 of 1 repositories");
  });
});
