import { basename } from "node:path";

import type { FleetEntry, FleetManifest, FleetRepoInput } from "@product-map/spec";
import { finalizeManifest, slugify } from "@product-map/spec";

import type { DeriveContext } from "./context";

export type { FleetRepoInput };

function countBy<T extends string>(values: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

/**
 * Cross-repository roll-up, as a derived manifest.
 *
 * Every other operation in this toolchain produces canonical JSON that
 * Markdown is rendered from, so a fleet view that emitted only prose could not
 * be validated, hashed, diffed, or freshness-checked like the rest. This is
 * the same envelope: one entry per repository, `derivedFrom` carrying the
 * contentHash of every manifest that fed it.
 *
 * A repository that is unmapped or broken is a row with a state, never an
 * omission and never a reason to abandon the run.
 */
export function buildFleetManifest(name: string, repos: FleetRepoInput[], context: DeriveContext): FleetManifest {
  const derivedFrom = new Set<string>();
  const items: FleetEntry[] = repos.map((input) => {
    const repoName = input.surfaces?.scope ?? basename(input.path) ?? input.path;
    const base = {
      id: `repo:${slugify(repoName)}`,
      repo: repoName,
      path: input.path,
      hasPlanned: input.hasPlanned,
    };

    if (input.error !== undefined) {
      return {
        ...base,
        commit: null,
        workingTree: "not-applicable" as const,
        state: "invalid" as const,
        surfaceCount: 0,
        capabilityCount: 0,
        surfacesByType: {},
        capabilitiesByKind: {},
        misplacedCount: 0,
        note: input.error,
      };
    }
    if (input.surfaces === null || input.capabilities === null) {
      return {
        ...base,
        commit: null,
        workingTree: "not-applicable" as const,
        state: "not-mapped" as const,
        surfaceCount: 0,
        capabilityCount: 0,
        surfacesByType: {},
        capabilitiesByKind: {},
        misplacedCount: 0,
        note: "no committed product map; run `pmap all` in this repository",
      };
    }

    derivedFrom.add(input.surfaces.contentHash);
    derivedFrom.add(input.capabilities.contentHash);
    return {
      ...base,
      commit: input.surfaces.generatedFrom.commit,
      workingTree: input.surfaces.generatedFrom.workingTree,
      state: input.scanned === true ? ("scanned" as const) : ("mapped" as const),
      surfaceCount: input.surfaces.items.length,
      capabilityCount: input.capabilities.items.length,
      surfacesByType: countBy(input.surfaces.items.map((item) => item.surfaceType)),
      capabilitiesByKind: countBy(input.capabilities.items.map((item) => item.kind)),
      misplacedCount: [...input.surfaces.items, ...input.capabilities.items].filter(
        (item) => item.placement.verdict === "misplaced",
      ).length,
    };
  });

  return finalizeManifest<FleetManifest>({
    schemaVersion: "product-map.v1",
    kind: "fleet",
    stance: "derived",
    scope: name,
    generatedFrom: {
      // A fleet spans repositories, so there is no single commit to record;
      // each entry carries the commit of the map it was read from.
      commit: null,
      workingTree: "not-applicable",
      sources: repos.map((input) => input.path).sort(),
      derivedFrom: [...derivedFrom].sort(),
    },
    generator: context.generator,
    items,
  });
}
