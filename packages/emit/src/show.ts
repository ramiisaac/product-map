import type { CapabilityManifest, MapManifest, SurfaceManifest } from "@product-map/spec";

import type { RenderOptions } from "./options";
import { createRenderOptions, truncate } from "./options";
import { countBy, groupBy, pad } from "./shared";

export interface ShowSurfaceRow {
  id: string;
  type: string;
  name: string;
  status: string;
  path: string;
  binds: number;
}

export interface ShowCapabilityRow {
  kind: string;
  count: number;
  statuses: string[];
  paths: string[];
}

export interface ShowData {
  scope: string;
  commit: string | null;
  workingTree: string;
  surfaces: ShowSurfaceRow[];
  capabilities: ShowCapabilityRow[];
  relationshipCounts: Record<string, number>;
}

export interface ShowInput {
  surfaces: SurfaceManifest;
  capabilities: CapabilityManifest;
  map: MapManifest | null;
}

export function buildShow(input: ShowInput): ShowData {
  const byKind = groupBy(input.capabilities.items, (item) => item.kind);
  return {
    scope: input.surfaces.scope,
    commit: input.surfaces.generatedFrom.commit,
    workingTree: input.surfaces.generatedFrom.workingTree,
    surfaces: input.surfaces.items.map((item) => ({
      id: item.id,
      type: item.surfaceType,
      name: item.name,
      status: item.status,
      path: item.placement.current,
      binds: item.binds.length,
    })),
    capabilities: [...byKind].map(([kind, items]) => ({
      kind,
      count: items.length,
      statuses: [...new Set(items.map((item) => item.status))].sort(),
      paths: [...new Set(items.map((item) => item.placement.current))].sort(),
    })),
    relationshipCounts: input.map === null ? {} : countBy(input.map.items, (entry) => entry.relationship),
  };
}

export function renderShow(data: ShowData, overrides: Partial<RenderOptions> = {}): string {
  const options = createRenderOptions(overrides);
  const commit = data.commit ?? "no-git";
  const lines = [
    `${data.scope} @ ${commit.slice(0, options.commitDisplayLength)} (${data.workingTree})`,
    "",
    `SURFACES (${data.surfaces.length})`,
    ...pad([
      ["  ID", "TYPE", "STATUS", "LIVES IN", "BOUND", "NAME"],
      ...data.surfaces.map((surface) => [
        `  ${surface.id}`,
        surface.type,
        surface.status,
        surface.path,
        String(surface.binds),
        truncate(surface.name, options.descriptionLimit),
      ]),
    ]),
    "",
    `CAPABILITIES (${data.capabilities.reduce((total, group) => total + group.count, 0)})`,
    ...pad([
      ["  KIND", "COUNT", "STATUS", "LIVES IN"],
      ...data.capabilities.map((group) => [
        `  ${group.kind}`,
        String(group.count),
        group.statuses.join(", "),
        truncate(group.paths.join(", "), options.descriptionLimit),
      ]),
    ]),
  ];

  const relationships = Object.entries(data.relationshipCounts).sort(([a], [b]) => (a < b ? -1 : 1));
  if (relationships.length > 0) {
    lines.push("", "MAP", ...pad(relationships.map(([relationship, count]) => [`  ${relationship}`, String(count)])));
  }
  lines.push("");
  return lines.join("\n");
}
