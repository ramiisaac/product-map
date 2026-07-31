import type {
  CapabilityManifest,
  DigestOptions,
  MapEntry,
  MapManifest,
  MapRelationship,
  SurfaceManifest,
} from "@product-map/spec";

import { createDigestOptions } from "./options";
import { countBy, groupBy, pad, TRUNCATION_SUFFIX } from "./shared";

export interface DigestSurface {
  id: string;
  type: string;
  path: string;
  status: string;
  bindCount: number;
}

export interface DigestCapabilityGroup {
  kind: string;
  count: number;
  names: string[];
  paths: string[];
}

export interface DigestGap {
  relationship: MapRelationship;
  id: string;
}

export interface DigestData {
  scope: string;
  generator: string;
  commit: string | null;
  workingTree: string;
  surfaceCount: number;
  capabilityCount: number;
  relationshipCounts: Record<string, number>;
  surfaces: DigestSurface[];
  capabilities: DigestCapabilityGroup[];
  gaps: DigestGap[];
}

export interface DigestInput {
  surfaces: SurfaceManifest;
  capabilities: CapabilityManifest;
  map: MapManifest | null;
}

const GAP_RELATIONSHIPS: readonly MapRelationship[] = ["surface-unbound", "bound-conflict", "capability-unbound"];

function distinctPaths(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort();
}

/**
 * A capability nothing outside the repository can consume is unexposed by
 * construction, not by neglect, so it is not a gap — reporting it would fill
 * the one section an agent reads with entries that have no action attached.
 */
function isGap(entry: MapEntry, capabilities: CapabilityManifest): boolean {
  if (!GAP_RELATIONSHIPS.includes(entry.relationship)) return false;
  if (entry.relationship !== "capability-unbound") return true;
  const capability = capabilities.items.find((item) => item.id === entry.capabilityId);
  return capability !== undefined && capability.reach !== "internal";
}

function toGap(entry: MapEntry): DigestGap {
  return { relationship: entry.relationship, id: entry.surfaceId ?? entry.capabilityId ?? "?" };
}

export function buildDigest(input: DigestInput): DigestData {
  const { surfaces, capabilities, map } = input;
  const byKind = groupBy(capabilities.items, (item) => item.kind);
  return {
    scope: surfaces.scope,
    generator: `${surfaces.generator.name} ${surfaces.generator.version}`,
    commit: surfaces.generatedFrom.commit,
    workingTree: surfaces.generatedFrom.workingTree,
    surfaceCount: surfaces.items.length,
    capabilityCount: capabilities.items.length,
    relationshipCounts: map === null ? {} : countBy(map.items, (entry) => entry.relationship),
    surfaces: surfaces.items.map((item) => ({
      id: item.id,
      type: item.surfaceType,
      path: item.placement.current,
      status: item.status,
      bindCount: item.binds.length,
    })),
    capabilities: [...byKind].map(([kind, items]) => ({
      kind,
      count: items.length,
      names: items.map((item) => item.name),
      paths: distinctPaths(items.map((item) => item.placement.current)),
    })),
    gaps: map === null ? [] : map.items.filter((entry) => isGap(entry, capabilities)).map(toGap),
  };
}

function list(names: readonly string[], limit: number): string {
  const shown = names.slice(0, limit).join(", ");
  return names.length > limit ? `${shown}${TRUNCATION_SUFFIX} (${names.length})` : `${shown} (${names.length})`;
}

/**
 * The agent-facing rendering. It leads with paths because an agent entering an
 * unfamiliar repository needs to navigate, not to search, and it is budgeted
 * because the manifests it summarises are deliberately too verbose to read.
 */
export function renderDigest(data: DigestData, overrides: Partial<DigestOptions> = {}): string {
  const options = createDigestOptions(overrides);
  const commit = data.commit ?? "no-git";
  const relationships = Object.entries(data.relationshipCounts)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([relationship, count]) => `${count} ${relationship}`)
    .join(" · ");

  const lines = [
    `# ${data.scope} — product map (${data.generator} @ ${commit.slice(0, options.commitDisplayLength)}, ${data.workingTree})`,
    `${data.surfaceCount} surfaces · ${data.capabilityCount} capabilities${relationships === "" ? "" : ` · ${relationships}`}`,
    "",
    "SURFACES",
    ...pad(
      data.surfaces.map((surface) => [
        `  ${surface.id}`,
        surface.path,
        surface.status,
        surface.bindCount === 0 ? "UNBOUND" : `-> ${surface.bindCount} bound`,
      ]),
    ),
    "",
    "CAPABILITIES",
    ...pad(
      data.capabilities.map((group) => [
        `  ${group.kind}`,
        list(group.names, options.maxListedNames),
        list(group.paths, options.maxListedNames),
      ]),
    ),
  ];

  if (data.gaps.length > 0) {
    lines.push("", "GAPS");
    for (const gap of data.gaps) lines.push(`  ${gap.relationship}  ${gap.id}`);
  }
  lines.push("");
  return applyBudget(lines, options);
}

/**
 * Chars-per-token is a deliberate approximation: a real tokenizer would be a
 * dependency and a determinism risk for a committed artifact, and the budget
 * only needs to be roughly right to keep a digest from crowding out the work.
 */
function applyBudget(lines: readonly string[], options: DigestOptions): string {
  const budget = options.maxTokens * options.charsPerToken;
  const kept: string[] = [];
  let used = 0;
  for (const [index, line] of lines.entries()) {
    const cost = line.length + 1;
    if (used + cost > budget) {
      kept.push(
        `${TRUNCATION_SUFFIX} (${lines.length - index} more lines, over the ${options.maxTokens}-token budget)`,
      );
      break;
    }
    kept.push(line);
    used += cost;
  }
  return kept.join("\n");
}
