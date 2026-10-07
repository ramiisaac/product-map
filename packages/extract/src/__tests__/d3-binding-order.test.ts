import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Adapter, Bind, CapabilityItem, RepoConfig, SurfaceItem } from "@product-map/spec";
import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { extractRepo } from "..";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

const DASHBOARD_ID = "surface:dashboard:web";
const ROUTE_ID = "cap:route:web.orders";
const CLI_ID = "surface:cli:tool-render";
const COMMAND_ID = "cap:command:tool.render";

function emptyRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-binding-order-"));
  writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "fixture", private: true })}\n`);
  return root;
}

function dashboard(binds: Bind[]): SurfaceItem {
  return {
    id: DASHBOARD_ID,
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

function cliBin(): SurfaceItem {
  return {
    id: CLI_ID,
    surfaceType: "cli",
    name: "tool-render",
    entry: { kind: "bin", value: "tool-render" },
    purpose: "A dedicated bin for the render command.",
    audience: ["developer"],
    status: "live",
    binds: [],
    placement: { current: "packages/tool", verdict: "correct" },
    provenance: { source: "packages/tool/package.json", evidence: ["packages/tool/package.json"], confidence: "high" },
  };
}

function command(): CapabilityItem {
  return {
    id: COMMAND_ID,
    kind: "command",
    name: "render",
    surfaceArea: "cli",
    status: "live",
    reach: "external",
    placement: { current: "packages/tool-core", verdict: "correct" },
    provenance: {
      source: "packages/tool-core/src/commands/render.ts",
      evidence: ["packages/tool-core/src/commands/render.ts"],
      confidence: "high",
    },
  };
}

function syntheticAdapter(surfaces: SurfaceItem[], capabilities: CapabilityItem[]): Adapter {
  return {
    name: "synthetic",
    detect: () => true,
    extract: () => structuredClone({ surfaces, capabilities, sources: [] }),
  };
}

async function extract(adapter: Adapter, config: RepoConfig) {
  const options = { generator: toolGenerator, allowRepoCode: false, config };
  return extractRepo(loadRepoContext(emptyRepo()), options, [adapter]);
}

function bindsOf(result: Awaited<ReturnType<typeof extract>>, surfaceId: string): Bind[] {
  const surface = result.surfaces.items.find((item) => item.id === surfaceId);
  if (surface === undefined) throw new Error(`surface ${surfaceId} was not extracted`);
  return surface.binds;
}

const inferredRouteBind: Bind = { capabilityId: ROUTE_ID, via: "inferred-high", note: "adapter inference" };
const absentRoute: RepoConfig = { overrides: { [ROUTE_ID]: { status: "absent" } } };

describe("containment binding reads final status", () => {
  it("binds a live route module inside an app surface's directory", async () => {
    const result = await extract(syntheticAdapter([dashboard([])], [route()]), {});

    expect(bindsOf(result, DASHBOARD_ID)).toEqual([
      { capabilityId: ROUTE_ID, via: "inferred-high", note: "route handler inside this app" },
    ]);
  });

  it("gives a route module overridden to absent no containment bind", async () => {
    const result = await extract(syntheticAdapter([dashboard([])], [route()]), absentRoute);

    expect(bindsOf(result, DASHBOARD_ID)).toEqual([]);
    expect(result.capabilities.items.find((item) => item.id === ROUTE_ID)?.status).toBe("absent");
  });

  it("does not bind a per-command bin to its command once that command is absent", async () => {
    const adapter = syntheticAdapter([cliBin()], [command()]);
    const live = await extract(adapter, {});
    const absent = await extract(adapter, { overrides: { [COMMAND_ID]: { status: "absent" } } });

    expect(bindsOf(live, CLI_ID)).toEqual([
      { capabilityId: COMMAND_ID, via: "inferred-high", note: "dedicated bin for this command" },
    ]);
    expect(bindsOf(absent, CLI_ID)).toEqual([]);
  });
});

describe("adapter binds are pruned against final status", () => {
  it("prunes an adapter inferred-high bind whose capability is overridden to absent", async () => {
    const result = await extract(syntheticAdapter([dashboard([inferredRouteBind])], [route()]), absentRoute);

    expect(bindsOf(result, DASHBOARD_ID)).toEqual([]);
  });

  it("keeps an adapter inferred-high bind whose capability is overridden to a status other than absent", async () => {
    const result = await extract(syntheticAdapter([dashboard([inferredRouteBind])], [route()]), {
      overrides: { [ROUTE_ID]: { status: "deprecated" } },
    });

    expect(bindsOf(result, DASHBOARD_ID)).toEqual([inferredRouteBind]);
  });

  it("never prunes an explicit bind, so a deliberate binding to an absent capability survives", async () => {
    const bind: Bind = { capabilityId: ROUTE_ID, via: "explicit", note: "wired by hand" };
    const result = await extract(syntheticAdapter([dashboard([bind])], [route()]), absentRoute);

    expect(bindsOf(result, DASHBOARD_ID)).toEqual([bind]);
  });

  it("keeps a declared bind as explicit when an adapter inferred the same bind to an absent capability", async () => {
    const result = await extract(syntheticAdapter([dashboard([inferredRouteBind])], [route()]), {
      ...absentRoute,
      binds: [{ surface: DASHBOARD_ID, capability: ROUTE_ID }],
    });

    expect(bindsOf(result, DASHBOARD_ID)).toEqual([
      { capabilityId: ROUTE_ID, via: "explicit", note: "declared in product-map.config.mjs" },
    ]);
    expect(result.skipped.filter((item) => item.adapter === "config")).toEqual([]);
  });
});
