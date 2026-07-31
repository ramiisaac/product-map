import type {
  CapabilityManifest,
  DiffManifest,
  MapEntry,
  MapManifest,
  MapRelationship,
  SurfaceManifest,
} from "@product-map/spec";

import type { RenderOptions } from "./options";
import { createRenderOptions } from "./options";

function group(entries: readonly MapEntry[], relationship: MapRelationship): MapEntry[] {
  return entries.filter((e) => e.relationship === relationship);
}

function ref(entry: MapEntry): string {
  return [entry.surfaceId, entry.capabilityId]
    .filter(Boolean)
    .map((id) => `\`${id}\``)
    .join(" ↔ ");
}

/**
 * The reconciliation plan: what to build, in what order, with every wave item
 * citing the map/diff entries that justify it. Waves order backend gaps first
 * (surfaces cannot ship on missing capabilities), then surface work, then
 * packaging moves, then exposure decisions. Reviewer-authored doctrine/shape
 * conflicts and automatically detected unknowns are never scheduled — they go
 * to the owner.
 */
export function renderReconciliationPlan(
  plannedSurfaces: SurfaceManifest,
  existingCapabilities: CapabilityManifest,
  map: MapManifest,
  surfacesDiff: DiffManifest | null,
  overrides: Partial<RenderOptions> = {},
): string {
  const options = createRenderOptions(overrides);
  const parts: string[] = [
    `<!-- generated from maps/planned-surfaces-vs-existing-capabilities.json@${map.contentHash} — do not edit -->`,
    "",
    `# ${map.scope} — reconciliation plan`,
    "",
    `Planned surfaces: ${plannedSurfaces.items.length} (generator: ${plannedSurfaces.generator.name}) · Existing capabilities: ${existingCapabilities.items.length} · Repo commit: \`${existingCapabilities.generatedFrom.commit?.slice(0, options.commitDisplayLength) ?? "n/a"}\``,
    "",
    "Waves are ordered by dependency: capabilities before the surfaces that need them, packaging after behavior. Every item cites the map/diff evidence that justifies it. Reviewer-authored doctrine/shape conflicts and detected unknowns are NOT scheduled — they need an owner decision first.",
    "",
  ];

  const backendMissing = group(map.items, "surface-unbound").filter((e) => e.capabilityId !== undefined);
  parts.push(`## Wave 1 — build missing capabilities (${backendMissing.length})`, "");
  if (backendMissing.length === 0)
    parts.push("None — every planned surface binding resolves to an existing capability.", "");
  for (const entry of backendMissing) {
    parts.push(
      `- Build \`${entry.capabilityId ?? "?"}\` — required by ${entry.surfaceId !== undefined ? `\`${entry.surfaceId}\`` : "a planned surface"}.${entry.note !== undefined ? ` ${entry.note}` : ""} [map: backend-missing]`,
    );
  }
  if (backendMissing.length > 0) parts.push("");

  const supported = group(map.items, "bound");
  const partiallySupported = group(map.items, "bound-proposed");
  const plannedById = new Map(plannedSurfaces.items.map((s) => [s.id, s]));
  const addedIds = new Set(
    (surfacesDiff?.items ?? []).filter((e) => e.change === "added" && e.id !== undefined).map((e) => e.id as string),
  );
  const changedIds = new Set(
    (surfacesDiff?.items ?? []).flatMap((e) => {
      if (e.change === "changed" && e.id !== undefined) return [e.id];
      if (e.change === "renamed" && e.toId !== undefined) return [e.toId];
      return [];
    }),
  );
  parts.push(`## Wave 2 — build and change surfaces (${plannedSurfaces.items.length} planned)`, "");
  for (const surface of plannedSurfaces.items) {
    const bindsSupported = supported.filter((e) => e.surfaceId === surface.id).length;
    const bindsPartial = partiallySupported.filter((e) => e.surfaceId === surface.id).length;
    const bindsMissing = backendMissing.filter((e) => e.surfaceId === surface.id).length;
    const disposition = addedIds.has(surface.id)
      ? "NEW surface"
      : changedIds.has(surface.id)
        ? "CHANGE existing surface"
        : "keep/verify existing surface";
    const blocking = bindsMissing > 0 ? ` — blocked on Wave 1 (${bindsMissing} missing capabilities)` : "";
    parts.push(
      `- ${disposition}: \`${surface.id}\` (${surface.surfaceType}, ${surface.views?.length ?? 0} views) — ${bindsSupported} supported / ${bindsPartial} partial / ${bindsMissing} missing bindings${blocking} [diff: ${addedIds.has(surface.id) ? "added" : changedIds.has(surface.id) ? "changed" : "unchanged"}]`,
    );
  }
  parts.push("");

  const packaging = [...plannedSurfaces.items, ...existingCapabilities.items].filter(
    (item) => item.placement.verdict === "misplaced",
  );
  parts.push(`## Wave 3 — packaging moves (${packaging.length})`, "");
  if (packaging.length === 0) parts.push("None detected.", "");
  for (const item of packaging) {
    parts.push(
      `- Move \`${item.id}\` out of \`${item.placement.current}\` into \`${item.placement.canonical ?? "?"}\` [placement: misplaced]`,
    );
  }
  if (packaging.length > 0) parts.push("");

  const unreferenced = group(map.items, "capability-unbound");
  const externallyReachable = new Set(
    existingCapabilities.items.filter((c) => c.reach !== "internal").map((c) => c.id),
  );
  const designMissing = unreferenced.filter(
    (e) => e.capabilityId !== undefined && externallyReachable.has(e.capabilityId),
  );
  parts.push(`## Wave 4 — exposure decisions (${designMissing.length} capabilities the design ignores)`, "");
  parts.push(
    "Existing capabilities no planned surface references. For each: surface it (docs/UI/marketing), deliberately keep it internal, or deprecate it. These are decisions, not automatic work items.",
    "",
  );
  for (const entry of designMissing.slice(0, options.maxReconciliationItems)) {
    parts.push(`- \`${entry.capabilityId ?? "?"}\` [map: design-missing]`);
  }
  if (designMissing.length > options.maxReconciliationItems)
    parts.push(`- … and ${designMissing.length - options.maxReconciliationItems} more (see the map)`);
  parts.push("");

  const needsOwner = [
    ...group(map.items, "bound-conflict"),
    ...group(map.items, "surface-unbound").filter((e) => e.capabilityId === undefined),
  ];
  const lowConfidence = plannedSurfaces.items.filter((s) => s.provenance.confidence === "low");
  parts.push(`## Not scheduled — needs owner decision (${needsOwner.length + lowConfidence.length})`, "");
  if (needsOwner.length === 0 && lowConfidence.length === 0) parts.push("Nothing blocked on the owner.", "");
  for (const entry of needsOwner) {
    parts.push(`- ${ref(entry)} — ${entry.relationship}${entry.note !== undefined ? `: ${entry.note}` : ""}`);
  }
  for (const surface of lowConfidence) {
    parts.push(
      `- \`${surface.id}\` — design-side confidence is LOW (${plannedById.get(surface.id)?.provenance.source ?? ""}); confirm intent before building.`,
    );
  }
  parts.push("");

  parts.push("## Done means", "");
  parts.push(
    "Re-run `pmap all` after each wave: Wave 1 is done when this map has zero backend-missing entries; Wave 2 when the surfaces diff between planned and existing is empty for the scheduled ids; Wave 3 when no misplaced/packaging-gap findings remain. The freshness gate keeps the numbers honest.",
    "",
  );
  return parts.join("\n");
}
