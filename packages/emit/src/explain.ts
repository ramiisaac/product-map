import type { CapabilityManifest, MapManifest, Reach, SurfaceManifest } from "@product-map/spec";

export interface ExplainBind {
  capabilityId: string;
  via: string;
  note?: string;
}

export interface ExplainRelation {
  relationship: string;
  counterpartId: string | null;
  note?: string;
}

export interface ExplainData {
  id: string;
  kind: "surface" | "capability";
  name: string;
  type: string;
  status: string;
  reach?: Reach;
  purpose: string;
  placement: { current: string; canonical?: string; verdict: string };
  provenance: { source: string; confidence: string; evidence: string[] };
  binds: ExplainBind[];
  boundBy: string[];
  relations: ExplainRelation[];
}

export interface ExplainInput {
  id: string;
  surfaces: SurfaceManifest;
  capabilities: CapabilityManifest;
  map: MapManifest | null;
}

function relationsFor(map: MapManifest | null, id: string): ExplainRelation[] {
  if (map === null) return [];
  return map.items
    .filter((entry) => entry.surfaceId === id || entry.capabilityId === id)
    .map((entry) => ({
      relationship: entry.relationship,
      counterpartId: (entry.surfaceId === id ? entry.capabilityId : entry.surfaceId) ?? null,
      ...(entry.note === undefined ? {} : { note: entry.note }),
    }));
}

export function buildExplanation(input: ExplainInput): ExplainData | null {
  const surface = input.surfaces.items.find((item) => item.id === input.id);
  if (surface !== undefined) {
    return {
      id: surface.id,
      kind: "surface",
      name: surface.name,
      type: surface.surfaceType,
      status: surface.status,
      purpose: surface.purpose,
      placement: {
        current: surface.placement.current,
        ...(surface.placement.canonical === undefined ? {} : { canonical: surface.placement.canonical }),
        verdict: surface.placement.verdict,
      },
      provenance: {
        source: surface.provenance.source,
        confidence: surface.provenance.confidence,
        evidence: [...surface.provenance.evidence],
      },
      binds: surface.binds.map((bind) => ({
        capabilityId: bind.capabilityId,
        via: bind.via,
        ...(bind.note === undefined ? {} : { note: bind.note }),
      })),
      boundBy: [],
      relations: relationsFor(input.map, surface.id),
    };
  }

  const capability = input.capabilities.items.find((item) => item.id === input.id);
  if (capability === undefined) return null;
  return {
    id: capability.id,
    kind: "capability",
    name: capability.name,
    type: capability.kind,
    status: capability.status,
    reach: capability.reach,
    purpose: capability.purpose ?? "",
    placement: {
      current: capability.placement.current,
      ...(capability.placement.canonical === undefined ? {} : { canonical: capability.placement.canonical }),
      verdict: capability.placement.verdict,
    },
    provenance: {
      source: capability.provenance.source,
      confidence: capability.provenance.confidence,
      evidence: [...capability.provenance.evidence],
    },
    binds: [],
    boundBy: input.surfaces.items
      .filter((surface) => surface.binds.some((bind) => bind.capabilityId === capability.id))
      .map((surface) => surface.id),
    relations: relationsFor(input.map, capability.id),
  };
}

export function renderExplanation(data: ExplainData): string {
  const lines = [
    `${data.id}`,
    `  ${data.kind} · ${data.type} · ${data.status}${data.reach === undefined ? "" : ` · reach ${data.reach}`}`,
    `  name        ${data.name}`,
  ];
  if (data.purpose !== "") lines.push(`  purpose     ${data.purpose}`);
  lines.push(
    `  lives in    ${data.placement.current}${data.placement.verdict === "misplaced" ? ` (MISPLACED — canonical ${data.placement.canonical ?? "?"})` : ""}`,
    "",
    "WHY IT EXISTS",
    `  emitted by  ${data.provenance.source}`,
    `  confidence  ${data.provenance.confidence}`,
    `  evidence    ${data.provenance.evidence.length === 0 ? "none recorded" : data.provenance.evidence.join("\n              ")}`,
  );

  if (data.binds.length > 0) {
    lines.push("", `BINDS (${data.binds.length})`);
    for (const bind of data.binds) {
      lines.push(`  ${bind.capabilityId}  via ${bind.via}${bind.note === undefined ? "" : ` — ${bind.note}`}`);
    }
  }
  if (data.boundBy.length > 0) {
    lines.push("", `FRONTED BY (${data.boundBy.length})`);
    for (const id of data.boundBy) lines.push(`  ${id}`);
  }
  if (data.relations.length > 0) {
    lines.push("", `MAP ENTRIES (${data.relations.length})`);
    for (const relation of data.relations) {
      const counterpart = relation.counterpartId === null ? "" : ` ↔ ${relation.counterpartId}`;
      lines.push(`  ${relation.relationship}${counterpart}${relation.note === undefined ? "" : ` — ${relation.note}`}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
