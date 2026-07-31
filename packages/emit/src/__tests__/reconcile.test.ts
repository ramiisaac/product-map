import type { DiffManifest } from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { renderReconciliationPlan } from "..";
import { capabilities, map, surface, surfaces } from "./fixtures";

function diff(items: DiffManifest["items"]): DiffManifest {
  return finalizeManifest<DiffManifest>({
    schemaVersion: "product-map.v1",
    kind: "diff",
    stance: "derived",
    scope: "fixture",
    generatedFrom: {
      commit: "abcdef0123456789abcdef0123456789abcdef01",
      workingTree: "clean",
      sources: ["surfaces.existing.json", "surfaces.planned.json"],
      derivedFrom: ["a".repeat(64), "b".repeat(64)],
    },
    generator: { name: "pmap", version: "0.0.0" },
    items,
  });
}

function planFor(items: DiffManifest["items"]): string {
  return renderReconciliationPlan(
    surfaces([surface()]),
    capabilities(),
    map([{ relationship: "bound", surfaceId: "surface:cli:fixture", capabilityId: "cap:command:fixture.scan" }]),
    diff(items),
  );
}

describe("reconciliation plan dispositions", () => {
  it("schedules a surface whose only difference is its entry as a change", () => {
    const plan = planFor([
      {
        id: "surface:cli:fixture",
        change: "changed",
        fieldChanges: [
          {
            path: "/entry",
            from: { kind: "command", value: "fixture" },
            to: { kind: "command", value: "fixture scan" },
          },
        ],
      },
    ]);
    expect(plan).toContain("CHANGE existing surface: `surface:cli:fixture`");
  });

  it("schedules a surface whose only difference is copy as a change", () => {
    const plan = planFor([
      {
        id: "surface:cli:fixture",
        change: "changed",
        fieldChanges: [{ path: "/purpose", from: "The command-line entry point.", to: "The CLI." }],
      },
    ]);
    expect(plan).toContain("CHANGE existing surface: `surface:cli:fixture`");
  });

  it("dispositions a renamed surface's toId as a change, since the surface exists under a new id", () => {
    const plan = planFor([
      {
        fromId: "surface:cli:legacy",
        toId: "surface:cli:fixture",
        change: "renamed",
        fieldChanges: [{ path: "/name", from: "legacy CLI", to: "fixture CLI" }],
      },
    ]);
    expect(plan).toContain("CHANGE existing surface: `surface:cli:fixture`");
  });

  it("keeps a surface with no diff entry", () => {
    expect(planFor([])).toContain("keep/verify existing surface: `surface:cli:fixture`");
  });
});
