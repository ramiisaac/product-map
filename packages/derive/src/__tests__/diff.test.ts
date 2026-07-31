import type { CapabilityManifest, DeclaredRename, DeriveContext, SurfaceManifest } from "@product-map/spec";
import { canonicalStringify, finalizeManifest, validateManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { diffManifests, createDeriveContext, rejectedRenames } from "..";

const deriveContext = createDeriveContext({ name: "pmap", version: "0.0.0" });

function surfaceManifest(): SurfaceManifest {
  return finalizeManifest<SurfaceManifest>({
    schemaVersion: "product-map.v1",
    kind: "surface",
    stance: "existing",
    scope: "fixture",
    generatedFrom: { commit: "0123456789abcdef", workingTree: "clean", sources: ["apps/web"] },
    generator: { name: "manual", version: "1.0.0" },
    items: [
      {
        id: "surface:dashboard:fixture",
        surfaceType: "dashboard",
        name: "Fixture",
        entry: { kind: "route", value: "/" },
        purpose: "Show the fixture.",
        audience: ["developer"],
        status: "live",
        views: [{ id: "home", name: "Home", states: ["ready"] }],
        components: ["Header"],
        dataNeeds: [{ id: "records", description: "Fixture records", boundCapability: "cap:query:records" }],
        actions: [{ id: "refresh", description: "Refresh records", boundCapability: "cap:query:records" }],
        states: ["ready"],
        interactions: ["refresh"],
        outboundLinks: ["surface:docs:fixture"],
        binds: [{ capabilityId: "cap:query:records", via: "explicit" }],
        placement: { current: "apps/web", verdict: "correct" },
        provenance: { source: "apps/web", evidence: ["apps/web/page.tsx"], confidence: "high" },
        ext: { "fixture.owner": "team-a" },
      },
    ],
  });
}

function capabilityManifest(): CapabilityManifest {
  return finalizeManifest<CapabilityManifest>({
    schemaVersion: "product-map.v1",
    kind: "capability",
    stance: "existing",
    scope: "fixture",
    generatedFrom: { commit: "0123456789abcdef", workingTree: "clean", sources: ["packages/api"] },
    generator: { name: "manual", version: "1.0.0" },
    items: [
      {
        id: "cap:query:records",
        kind: "query",
        name: "records",
        surfaceArea: "api",
        shape: { type: "array" },
        auth: { required: true, scheme: "bearer", scopes: ["read"] },
        status: "live",
        reach: "external",
        inputs: [{ name: "limit", type: "number" }],
        outputs: [{ name: "records", type: "array" }],
        sideEffects: [],
        errors: ["unauthorized"],
        telemetry: ["records.read"],
        owners: ["team-a"],
        doctrine: ["Reads do not mutate."],
        placement: { current: "packages/api", verdict: "correct" },
        provenance: { source: "packages/api", evidence: ["packages/api/records.ts"], confidence: "high" },
        ext: { "fixture.tier": "core" },
      },
    ],
  });
}

function plannedSurface(change: (item: SurfaceManifest["items"][number]) => void): SurfaceManifest {
  const manifest = structuredClone(surfaceManifest());
  manifest.stance = "planned";
  change(manifest.items[0]!);
  return finalizeManifest<SurfaceManifest>(manifest);
}

function plannedCapability(change: (item: CapabilityManifest["items"][number]) => void): CapabilityManifest {
  const manifest = structuredClone(capabilityManifest());
  manifest.stance = "planned";
  change(manifest.items[0]!);
  return finalizeManifest<CapabilityManifest>(manifest);
}

describe("semantic diff coverage", () => {
  it.each([
    [
      "/interactions",
      (item: SurfaceManifest["items"][number]) => {
        item.interactions = ["refresh", "filter"];
      },
    ],
    [
      "/outboundLinks",
      (item: SurfaceManifest["items"][number]) => {
        item.outboundLinks = ["surface:docs:other"];
      },
    ],
    [
      "/components",
      (item: SurfaceManifest["items"][number]) => {
        item.components = ["Header", "Table"];
      },
    ],
    [
      "/dataNeeds",
      (item: SurfaceManifest["items"][number]) => {
        item.dataNeeds = [{ id: "summary", description: "Summary" }];
      },
    ],
    [
      "/ext",
      (item: SurfaceManifest["items"][number]) => {
        item.ext = { "fixture.owner": "team-b" };
      },
    ],
  ])("reports surface field %s", (path, change) => {
    const diff = diffManifests(surfaceManifest(), plannedSurface(change), deriveContext);
    expect(diff.items[0]?.fieldChanges?.map((field) => field.path)).toContain(path);
  });

  it.each([
    [
      "/shape",
      (item: CapabilityManifest["items"][number]) => {
        item.shape = { type: "object" };
      },
    ],
    [
      "/auth",
      (item: CapabilityManifest["items"][number]) => {
        item.auth = { required: false };
      },
    ],
    [
      "/inputs",
      (item: CapabilityManifest["items"][number]) => {
        item.inputs = [];
      },
    ],
    [
      "/outputs",
      (item: CapabilityManifest["items"][number]) => {
        item.outputs = [];
      },
    ],
    [
      "/doctrine",
      (item: CapabilityManifest["items"][number]) => {
        item.doctrine = ["Reads may cache."];
      },
    ],
    [
      "/telemetry",
      (item: CapabilityManifest["items"][number]) => {
        item.telemetry = ["records.cached"];
      },
    ],
    [
      "/ext",
      (item: CapabilityManifest["items"][number]) => {
        item.ext = { "fixture.tier": "edge" };
      },
    ],
  ])("reports capability field %s", (path, change) => {
    const diff = diffManifests(capabilityManifest(), plannedCapability(change), deriveContext);
    expect(diff.items[0]?.fieldChanges?.map((field) => field.path)).toContain(path);
  });
});

describe("semantic diff classification", () => {
  it.each([
    [
      "/purpose",
      (item: SurfaceManifest["items"][number]) => {
        item.purpose = "Explain the fixture.";
      },
    ],
    [
      "/entry",
      (item: SurfaceManifest["items"][number]) => {
        item.entry = { kind: "route", value: "/records" };
      },
    ],
    [
      "/states",
      (item: SurfaceManifest["items"][number]) => {
        item.states = ["loading", "ready"];
      },
    ],
    [
      "/binds",
      (item: SurfaceManifest["items"][number]) => {
        item.binds = [];
      },
    ],
  ])("reports a same-id difference in %s as changed", (path, change) => {
    const entry = diffManifests(surfaceManifest(), plannedSurface(change), deriveContext).items[0];
    expect(entry?.change).toBe("changed");
    expect(entry?.fieldChanges?.map((field) => field.path)).toEqual([path]);
  });

  it("reports every differing field on one changed entry", () => {
    const planned = plannedCapability((item) => {
      item.name = "record list";
      item.shape = { type: "object" };
    });
    const entry = diffManifests(capabilityManifest(), planned, deriveContext).items[0];
    expect(entry?.change).toBe("changed");
    expect(entry?.fieldChanges?.map((field) => field.path)).toEqual(["/name", "/shape"]);
  });

  it("reports a capability reach transition", () => {
    const planned = plannedCapability((item) => {
      item.reach = "internal";
    });
    const diff = diffManifests(capabilityManifest(), planned, deriveContext);
    expect(diff.items[0]?.change).toBe("changed");
    expect(diff.items[0]?.fieldChanges?.map((field) => field.path)).toContain("/reach");
  });

  it("rejects manifests from different repositories", () => {
    const planned = plannedSurface(() => undefined);
    planned.scope = "other";
    expect(() => diffManifests(surfaceManifest(), planned, deriveContext)).toThrow(/different scopes/);
  });
});

function renamedSurface(id: string, change: (item: SurfaceManifest["items"][number]) => void = () => undefined) {
  return plannedSurface((item) => {
    item.id = id;
    change(item);
  });
}

function contextWith(renames: readonly DeclaredRename[]): DeriveContext {
  return { ...deriveContext, renames };
}

describe("declared renames", () => {
  const rename: DeclaredRename = { fromId: "surface:dashboard:fixture", toId: "surface:dashboard:overview" };

  it("collapses the added/removed pair into one renamed entry with fieldChanges", () => {
    const to = renamedSurface("surface:dashboard:overview", (item) => {
      item.name = "Overview";
    });
    const diff = diffManifests(surfaceManifest(), to, contextWith([rename]));
    expect(diff.items).toHaveLength(1);
    expect(diff.items[0]).toMatchObject({
      fromId: "surface:dashboard:fixture",
      toId: "surface:dashboard:overview",
      change: "renamed",
    });
    expect(diff.items[0]?.fieldChanges?.map((field) => field.path)).toEqual(["/name"]);
    expect(validateManifest(diff).ok).toBe(true);
  });

  it("carries the declared note", () => {
    const to = renamedSurface("surface:dashboard:overview");
    const diff = diffManifests(surfaceManifest(), to, contextWith([{ ...rename, note: "renamed in design review" }]));
    expect(diff.items[0]?.note).toBe("renamed in design review");
    expect(validateManifest(diff).ok).toBe(true);
  });

  it("falls back to added/removed when the declared toId is absent", () => {
    const to = renamedSurface("surface:dashboard:other");
    const diff = diffManifests(surfaceManifest(), to, contextWith([rename]));
    expect(diff.items.map((entry) => entry.change).sort()).toEqual(["added", "removed"]);
    expect(rejectedRenames(surfaceManifest(), to, [rename])).toEqual([{ rename, reason: "unmatched" }]);
  });

  it("falls back to added/removed when the declared fromId survives into the to-manifest", () => {
    const to = finalizeManifest<SurfaceManifest>({
      ...structuredClone(surfaceManifest()),
      stance: "planned",
      items: [...structuredClone(surfaceManifest()).items, renamedSurface("surface:dashboard:overview").items[0]!],
    });
    const diff = diffManifests(surfaceManifest(), to, contextWith([rename]));
    expect(diff.items.map((entry) => entry.change)).toEqual(["added"]);
    expect(rejectedRenames(surfaceManifest(), to, [rename])).toEqual([{ rename, reason: "unmatched" }]);
  });

  it("falls back to added/removed when the two ids name different kinds", () => {
    const mismatched: DeclaredRename = { fromId: "surface:dashboard:fixture", toId: "cap:query:records" };
    const to = renamedSurface("surface:dashboard:overview");
    const diff = diffManifests(surfaceManifest(), to, contextWith([mismatched]));
    expect(diff.items.map((entry) => entry.change).sort()).toEqual(["added", "removed"]);
    expect(rejectedRenames(surfaceManifest(), to, [mismatched])).toEqual([
      { rename: mismatched, reason: "kind-mismatch" },
    ]);
  });

  it("leaves a capability rename to the capability diff", () => {
    const capRename: DeclaredRename = { fromId: "cap:query:records", toId: "cap:query:record-list" };
    const to = renamedSurface("surface:dashboard:overview");
    expect(rejectedRenames(surfaceManifest(), to, [capRename])).toEqual([]);
    expect(
      diffManifests(surfaceManifest(), to, contextWith([capRename]))
        .items.map((entry) => entry.change)
        .sort(),
    ).toEqual(["added", "removed"]);
  });

  it("renames capabilities too", () => {
    const capRename: DeclaredRename = { fromId: "cap:query:records", toId: "cap:query:record-list" };
    const to = plannedCapability((item) => {
      item.id = "cap:query:record-list";
      item.reach = "internal";
    });
    const diff = diffManifests(capabilityManifest(), to, contextWith([capRename]));
    expect(diff.items).toHaveLength(1);
    expect(diff.items[0]?.change).toBe("renamed");
    expect(diff.items[0]?.fieldChanges?.map((field) => field.path)).toEqual(["/reach"]);
  });

  it("is deterministic across repeated runs", () => {
    const to = renamedSurface("surface:dashboard:overview", (item) => {
      item.name = "Overview";
    });
    const context = contextWith([rename]);
    expect(canonicalStringify(diffManifests(surfaceManifest(), to, context))).toBe(
      canonicalStringify(diffManifests(surfaceManifest(), to, context)),
    );
  });
});
