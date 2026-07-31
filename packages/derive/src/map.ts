import type {
  CapabilityManifest,
  CapabilityStatus,
  MapEntry,
  MapManifest,
  SurfaceManifest,
  SurfaceStatus,
} from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";

import type { DeriveContext } from "./context";

function tokens(value: string, minTokenLength: number): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= minTokenLength),
  );
}

const CANDIDATE_REASON = "token similarity (not a binding)";

/**
 * The two sides of a binding can disagree in more than one way, and the note
 * carries which one rather than the relationship: a shipped surface over a
 * removed capability and a shipped surface over an unbuilt one are both a
 * surface promising something its backing does not deliver.
 */
function conflictNote(surface: SurfaceStatus, capability: CapabilityStatus): string | null {
  if ((surface === "live" || surface === "partial") && (capability === "absent" || capability === "deprecated")) {
    return `surface is ${surface} but the capability behind it is ${capability}`;
  }
  if (surface === "live" && capability === "planned") {
    return "surface is live but the capability behind it is only planned";
  }
  return null;
}

function roundScore(score: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(score * factor) / factor;
}

function similarity(a: string, b: string, minTokenLength: number): number {
  const ta = tokens(a, minTokenLength);
  const tb = tokens(b, minTokenLength);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.max(ta.size, tb.size);
}

/**
 * Cross-kind join. Explicit/inferred binds become supported entries; surfaces
 * with no binds get scored candidates but are NEVER silently bound; unbound
 * capabilities are reported as design-missing or orphan-capability depending
 * on the surfaces' stance.
 */
export function mapManifests(
  surfaces: SurfaceManifest,
  capabilities: CapabilityManifest,
  context: DeriveContext,
): MapManifest {
  if (surfaces.scope !== capabilities.scope) {
    throw new Error(
      `map requires manifests from the same scope (got different scopes: ${surfaces.scope} vs ${capabilities.scope})`,
    );
  }
  const entries: MapEntry[] = [];
  const capabilitiesById = new Map(capabilities.items.map((capability) => [capability.id, capability]));
  const referenced = new Set<string>();

  for (const surface of surfaces.items) {
    if (surface.binds.length === 0) {
      const candidates = capabilities.items
        .map((cap) => ({
          id: cap.id,
          score: similarity(`${surface.id} ${surface.name}`, `${cap.id} ${cap.name}`, context.mapping.minTokenLength),
        }))
        .filter((c) => c.score >= context.mapping.candidateThreshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, context.mapping.maxCandidates)
        .map((c) => ({
          ...c,
          score: roundScore(c.score, context.mapping.scoreDecimalPlaces),
          reason: CANDIDATE_REASON,
        }));
      entries.push({
        surfaceId: surface.id,
        relationship: "surface-unbound",
        ...(candidates.length > 0 ? { candidates } : {}),
        note: "No declared capability bindings; candidates are proposals only.",
      });
      continue;
    }
    for (const bind of surface.binds) {
      const capability = capabilitiesById.get(bind.capabilityId);
      // Same relationship as a surface that declared nothing, distinguished by
      // the entry carrying a capabilityId: this one named a capability that is
      // absent. In a planned-vs-existing map that is the build queue.
      if (capability === undefined) {
        entries.push({
          surfaceId: surface.id,
          capabilityId: bind.capabilityId,
          relationship: "surface-unbound",
          note: `bound capability does not exist in ${capabilities.stance} capabilities`,
        });
        continue;
      }
      referenced.add(bind.capabilityId);
      const conflict = conflictNote(surface.status, capability.status);
      const relationship =
        bind.via === "candidate-only" ? "bound-proposed" : conflict === null ? "bound" : "bound-conflict";
      const note = conflict ?? bind.note;
      entries.push({
        surfaceId: surface.id,
        capabilityId: bind.capabilityId,
        relationship,
        ...(note !== undefined ? { note } : {}),
      });
    }
  }

  for (const cap of capabilities.items) {
    if (referenced.has(cap.id)) continue;
    entries.push({
      capabilityId: cap.id,
      relationship: "capability-unbound",
      note:
        cap.reach === "internal"
          ? "Not referenced by any surface, and not externally consumable."
          : "Not referenced by any surface binding.",
    });
  }

  return finalizeManifest<MapManifest>({
    schemaVersion: "product-map.v1",
    kind: "map",
    stance: "derived",
    scope: surfaces.scope,
    generatedFrom: {
      commit: surfaces.generatedFrom.commit ?? capabilities.generatedFrom.commit,
      workingTree: capabilities.generatedFrom.workingTree,
      sources: [`surfaces.${surfaces.stance}.json`, `capabilities.${capabilities.stance}.json`],
      derivedFrom: [surfaces.contentHash, capabilities.contentHash],
    },
    generator: context.generator,
    items: entries,
  });
}
