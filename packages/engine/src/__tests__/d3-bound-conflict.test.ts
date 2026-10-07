import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Adapter, Bind, CapabilityItem, RepoConfig, SurfaceItem } from "@product-map/spec";
import { createDeriveContext, mapManifests } from "@product-map/derive";
import { loadRepoContext } from "@product-map/discovery";
import { extractRepo } from "@product-map/extract";
import { describe, expect, it } from "vitest";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

const SURFACE_ID = "surface:dashboard:web";
const ROUTE_ID = "cap:route:web.orders";

function emptyRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-bound-conflict-"));
  writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "fixture", private: true })}\n`);
  return root;
}

function dashboard(binds: Bind[]): SurfaceItem {
  return {
    id: SURFACE_ID,
    surfaceType: "dashboard",
    name: "web",
    entry: { kind: "route", value: "/" },
    purpose: "The signed-in web app.",
    audience: ["user"],
    status: "live",
    binds,
    placement: { current: "apps/web", verdict: "correct" },
    provenance: { source: "apps/web/package.json", evidence: ["apps/web/package.json"], confidence: "high" },
  };
}

function route(): CapabilityItem {
  return {
    id: ROUTE_ID,
    kind: "route",
    name: "/api/orders",
    surfaceArea: "api",
    status: "live",
    reach: "unknown",
    placement: { current: "apps/web/app/api/orders", verdict: "correct" },
    provenance: {
      source: "apps/web/app/api/orders/route.ts",
      evidence: ["apps/web/app/api/orders/route.ts"],
      confidence: "high",
    },
  };
}

function syntheticAdapter(surfaces: SurfaceItem[]): Adapter {
  return {
    name: "synthetic",
    detect: () => true,
    extract: () => structuredClone({ surfaces, capabilities: [route()], sources: [] }),
  };
}

async function mapFor(adapter: Adapter, config: RepoConfig) {
  const options = { generator: toolGenerator, allowRepoCode: false, config };
  const result = await extractRepo(loadRepoContext(emptyRepo()), options, [adapter]);
  return mapManifests(result.surfaces, result.capabilities, createDeriveContext(toolGenerator)).items;
}

const absentRoute: RepoConfig = { overrides: { [ROUTE_ID]: { status: "absent" } } };

describe("binding order against post-override status, through the map", () => {
  it("reports no bound-conflict for a route module overridden to absent inside a live app", async () => {
    const entries = await mapFor(syntheticAdapter([dashboard([])]), absentRoute);

    expect(entries.filter((entry) => entry.relationship === "bound-conflict")).toEqual([]);
    expect(entries).toContainEqual(
      expect.objectContaining({ capabilityId: ROUTE_ID, relationship: "capability-unbound" }),
    );
  });

  it("reports a bound-conflict for a declared bind that an adapter also inferred to an absent capability", async () => {
    const inferred: Bind = { capabilityId: ROUTE_ID, via: "inferred-high", note: "adapter inference" };
    const entries = await mapFor(syntheticAdapter([dashboard([inferred])]), {
      ...absentRoute,
      binds: [{ surface: SURFACE_ID, capability: ROUTE_ID }],
    });

    expect(entries).toContainEqual({
      surfaceId: SURFACE_ID,
      capabilityId: ROUTE_ID,
      relationship: "bound-conflict",
      note: "surface is live but the capability behind it is absent",
    });
  });

  it("prunes the inferred bind when no declaration asks for it, leaving the surface unbound", async () => {
    const inferred: Bind = { capabilityId: ROUTE_ID, via: "inferred-high", note: "adapter inference" };
    const entries = await mapFor(syntheticAdapter([dashboard([inferred])]), absentRoute);

    expect(entries.filter((entry) => entry.relationship === "bound-conflict")).toEqual([]);
    expect(entries).toContainEqual(expect.objectContaining({ surfaceId: SURFACE_ID, relationship: "surface-unbound" }));
  });
});
