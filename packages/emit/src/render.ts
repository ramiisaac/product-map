import type {
  CapabilityItem,
  CapabilityManifest,
  FleetManifest,
  Manifest,
  MapEntry,
  MapManifest,
  SurfaceItem,
  SurfaceManifest,
} from "@product-map/spec";

import type { RenderOptions } from "./options";
import { createRenderOptions, truncate } from "./options";
import { groupBy } from "./shared";

function header(manifest: Manifest, file: string, title: string, options: RenderOptions): string {
  return [
    `<!-- generated from ${file}@${manifest.contentHash} — do not edit -->`,
    "",
    `# ${manifest.scope} — ${title}`,
    "",
    `Stance: **${manifest.stance}** · Commit: \`${manifest.generatedFrom.commit?.slice(0, options.commitDisplayLength) ?? "n/a"}\` (${manifest.generatedFrom.workingTree}) · Generator: ${manifest.generator.name}@${manifest.generator.version} · Items: ${manifest.items.length}`,
    "",
  ].join("\n");
}

function esc(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function statusBadge(status: string): string {
  return `**${status}**`;
}

export function renderSurfaces(
  manifest: SurfaceManifest,
  file: string,
  overrides: Partial<RenderOptions> = {},
): string {
  const options = createRenderOptions(overrides);
  const parts = [header(manifest, file, `product surfaces (${manifest.stance})`, options)];
  const byType = groupBy(manifest.items, (i) => i.surfaceType);

  parts.push("## At a glance", "");
  parts.push("| Surface type | Count | Statuses |");
  parts.push("| ------------ | ----- | -------- |");
  for (const [type, items] of byType) {
    const statuses = [...new Set(items.map((i) => i.status))].sort().join(", ");
    parts.push(`| ${type} | ${items.length} | ${statuses} |`);
  }
  parts.push("");

  for (const [type, items] of byType) {
    parts.push(`## ${type}`, "");
    for (const item of items) {
      parts.push(`### \`${item.id}\` — ${esc(item.name)}`, "");
      parts.push(`${esc(item.purpose)}`, "");
      parts.push(
        `- Status: ${statusBadge(item.status)} · Entry: \`${esc(item.entry.value)}\` (${item.entry.kind}) · Audience: ${item.audience.join(", ") || "unspecified"}`,
      );
      parts.push(
        `- Lives in: \`${item.placement.current}\`${item.placement.verdict === "misplaced" ? ` — **MISPLACED**, canonical home \`${item.placement.canonical ?? "?"}\`` : ""}`,
      );
      parts.push(
        `- Evidence: ${
          item.provenance.evidence
            .slice(0, options.maxEvidencePaths)
            .map((e) => `\`${e}\``)
            .join(", ") || `\`${item.provenance.source}\``
        } (confidence: ${item.provenance.confidence})`,
      );
      if (item.binds.length > 0) {
        parts.push(
          `- Bound capabilities (${item.binds.length}): ${item.binds
            .slice(0, options.maxListedBinds)
            .map((b) => `\`${b.capabilityId}\``)
            .join(
              ", ",
            )}${item.binds.length > options.maxListedBinds ? ` … and ${item.binds.length - options.maxListedBinds} more` : ""}`,
        );
      } else {
        parts.push("- Bound capabilities: none declared (unbound)");
      }
      if (item.views !== undefined && item.views.length > 0) {
        parts.push(
          `- Views (${item.views.length}): ${item.views
            .slice(0, options.maxListedViews)
            .map((v) => `\`${esc(v.name)}\``)
            .join(", ")}${item.views.length > options.maxListedViews ? " …" : ""}`,
        );
      }
      parts.push("");
    }
  }
  return `${parts.join("\n")}`;
}

export function renderCapabilities(
  manifest: CapabilityManifest,
  file: string,
  overrides: Partial<RenderOptions> = {},
): string {
  const options = createRenderOptions(overrides);
  const parts = [header(manifest, file, `capabilities (${manifest.stance})`, options)];
  const byKind = groupBy(manifest.items, (i) => i.kind);

  parts.push("## At a glance", "");
  parts.push("| Kind | Count | Areas |");
  parts.push("| ---- | ----- | ----- |");
  for (const [kind, items] of byKind) {
    parts.push(`| ${kind} | ${items.length} | ${[...new Set(items.map((i) => i.surfaceArea))].sort().join(", ")} |`);
  }
  parts.push("");

  for (const [kind, items] of byKind) {
    const open = items.length <= options.collapseThreshold;
    parts.push(`## ${kind} (${items.length})`, "");
    if (!open) parts.push(`<details><summary>Show all ${items.length}</summary>`, "");
    parts.push("| Id | Name | Description | Area | Status | Lives in |");
    parts.push("| -- | ---- | ----------- | ---- | ------ | -------- |");
    for (const item of items) {
      const misplaced = item.placement.verdict === "misplaced" ? " **(misplaced)**" : "";
      const description = item.purpose ?? "";
      parts.push(
        `| \`${item.id}\` | ${esc(item.name)} | ${esc(truncate(description, options.descriptionLimit))} | ${item.surfaceArea} | ${item.status} | \`${item.placement.current}\`${misplaced} |`,
      );
    }
    if (!open) parts.push("", "</details>");
    parts.push("");
  }
  return parts.join("\n");
}

export function renderMap(manifest: MapManifest, file: string, overrides: Partial<RenderOptions> = {}): string {
  const options = createRenderOptions(overrides);
  const parts = [header(manifest, file, "surface ↔ capability map", options)];
  const byRel = groupBy(manifest.items, (e) => e.relationship);

  parts.push("## Relationship counts", "");
  parts.push("| Relationship | Count | Meaning |");
  parts.push("| ------------ | ----- | ------- |");
  const MEANING: Record<string, string> = {
    bound: "surface is backed by a capability that exists",
    "bound-proposed": "binding is a proposal, not an assertion",
    "bound-conflict": "bound, but the two sides disagree about maturity",
    "surface-unbound": "surface declares no capability, or names one that does not exist",
    "capability-unbound": "no surface references this capability",
  };
  for (const [rel, entries] of byRel) {
    parts.push(`| ${rel} | ${entries.length} | ${MEANING[rel] ?? ""} |`);
  }
  parts.push("");

  const order = ["surface-unbound", "bound-conflict", "bound-proposed", "capability-unbound", "bound"];
  for (const rel of order) {
    const entries = byRel.get(rel);
    if (entries === undefined) continue;
    parts.push(`## ${rel} (${entries.length})`, "");
    const renderEntry = (e: MapEntry): string => {
      const subject = [e.surfaceId, e.capabilityId]
        .filter(Boolean)
        .map((id) => `\`${id}\``)
        .join(" ↔ ");
      const candidates =
        e.candidates !== undefined && e.candidates.length > 0
          ? ` Candidates: ${e.candidates.map((c) => `\`${c.id}\` (${c.score})`).join(", ")}.`
          : "";
      return `- ${subject}${e.note !== undefined ? ` — ${esc(e.note)}` : ""}${candidates}`;
    };
    if (rel === "bound" || (rel === "capability-unbound" && entries.length > options.collapseThreshold)) {
      parts.push(`<details><summary>Show all ${entries.length}</summary>`, "");
      for (const e of entries) parts.push(renderEntry(e));
      parts.push("", "</details>", "");
    } else {
      for (const e of entries) parts.push(renderEntry(e));
      parts.push("");
    }
  }
  return parts.join("\n");
}

/**
 * The actionable report: what to fix, grouped by the action it implies.
 * Rendered from the existing map + manifests; the reconciliation plan proper
 * arrives once planned manifests exist.
 */
export function renderGaps(
  surfaces: SurfaceManifest,
  capabilities: CapabilityManifest,
  map: MapManifest,
  file: string,
  overrides: Partial<RenderOptions> = {},
): string {
  const options = createRenderOptions(overrides);
  const parts = [header(map, file, "gaps and follow-ups", options)];
  const surfaceById = new Map(surfaces.items.map((s) => [s.id, s]));
  const capabilityById = new Map(capabilities.items.map((c) => [c.id, c]));

  // Placement is an item-level fact, so it is read from the manifests rather
  // than from the map: the map classifies links between items, not items.
  const misplaced = [...surfaces.items, ...capabilities.items].filter((item) => item.placement.verdict === "misplaced");
  parts.push("## 1. Misplaced — move these to their canonical package", "");
  if (misplaced.length === 0) parts.push("Nothing misplaced detected.", "");
  for (const item of misplaced) {
    parts.push(
      `- \`${item.id}\` — lives in \`${item.placement.current}\`, canonical home \`${item.placement.canonical ?? "?"}\``,
    );
  }
  if (misplaced.length > 0) parts.push("");

  const unbound = map.items.filter((e) => e.relationship === "surface-unbound");
  parts.push("## 2. Unbound surfaces — declare what powers them", "");
  parts.push(
    "These surfaces have no capability bindings. Either the extractor cannot see the wiring (emit curated binds from `extract.local.mjs`) or the surface genuinely fronts nothing.",
    "",
  );
  for (const entry of unbound) {
    const surface = entry.surfaceId !== undefined ? surfaceById.get(entry.surfaceId) : undefined;
    const candidates =
      entry.candidates !== undefined && entry.candidates.length > 0
        ? ` Likely matches: ${entry.candidates.map((c) => `\`${c.id}\` (${c.score})`).join(", ")}.`
        : "";
    parts.push(
      `- \`${entry.surfaceId ?? "?"}\`${surface !== undefined ? ` (${surface.surfaceType}, ${surface.status})` : ""}.${candidates}`,
    );
  }
  parts.push("");

  const orphaned = map.items
    .filter((e) => e.relationship === "capability-unbound")
    .flatMap((e) => (e.capabilityId !== undefined ? [capabilityById.get(e.capabilityId) ?? null] : []))
    .filter((c): c is CapabilityItem => c !== null);
  // The three reaches imply three different actions, so they are three
  // different piles. Something nothing outside the repo can consume is
  // unexposed by construction, not by neglect, and stays unlisted; an observed
  // `external` capability nothing fronts is an exposure decision; `unknown` is
  // a hole in what the extractors observed, not a finding about the product.
  const internal = orphaned.filter((c) => c.reach === "internal");
  const byKind = (items: CapabilityItem[]): string[] =>
    [...groupBy(items, (c) => c.kind)].map(
      ([kind, group]) =>
        `- **${kind}** (${group.length}): ${group
          .slice(0, options.maxListedItems)
          .map((c) => `\`${c.id}\``)
          .join(
            ", ",
          )}${group.length > options.maxListedItems ? ` … and ${group.length - options.maxListedItems} more` : ""}`,
    );

  parts.push("## 3. Orphan capabilities — nothing surfaces these", "");
  parts.push(
    `Split by reach and grouped by kind. ${internal.length} internal capabilit${internal.length === 1 ? "y is" : "ies are"} unexposed by construction and not listed.`,
    "",
  );

  const external = orphaned.filter((c) => c.reach === "external");
  parts.push("### Confirmed externally consumable — decide how they are exposed", "");
  if (external.length === 0) {
    parts.push("None: nothing observed as externally consumable is unexposed.", "");
  } else {
    parts.push(
      "Something outside this repository can consume these, and no surface fronts them. Front them and declare the bind, or stop distributing them.",
      "",
      ...byKind(external),
      "",
    );
  }

  const undetermined = orphaned.filter((c) => c.reach === "unknown");
  parts.push("### Reach undetermined — record it, or report the adapter gap", "");
  if (undetermined.length === 0) {
    parts.push("None: every unbound capability has an observed reach.", "");
  } else {
    parts.push(
      "Nothing observed how these are distributed, so whether they are a gap is unknown. Set their reach from `extract.local.mjs` or an `overrides` entry in `product-map.config.mjs`.",
      "",
      ...byKind(undetermined),
      "",
    );
  }

  const surfaceTypes = new Set(surfaces.items.map((s) => s.surfaceType));
  const COMMON: Array<[string, string]> = [
    ["docs", "no rendered docs surface was detected"],
    ["marketing", "no marketing surface was detected"],
    ["mcp", "no MCP server was detected — agent-facing repos usually want one"],
    ["email", "no email surface was detected"],
  ];
  const absent = COMMON.filter(([type]) => !surfaceTypes.has(type as SurfaceItem["surfaceType"]));
  parts.push("## 4. Absent surface types worth considering", "");
  if (absent.length === 0) parts.push("All commonly-expected surface types are present.", "");
  for (const [type, note] of absent) parts.push(`- **${type}** — ${note}`);
  if (absent.length > 0) parts.push("");

  parts.push("## 5. Next step", "");
  parts.push(
    "Author or export the planned stance (Claude Design Case A/B prompts in `prompts/`), drop `surfaces.planned.json` beside the existing manifests, and re-run `pmap all` — the planned-vs-existing map, diffs, and reconciliation plan light up from there.",
    "",
  );
  return parts.join("\n");
}

export function renderIndex(
  surfaces: SurfaceManifest,
  capabilities: CapabilityManifest,
  map: MapManifest | null,
  hasPlanned: boolean,
  overrides: Partial<RenderOptions> = {},
): string {
  const options = createRenderOptions(overrides);
  const parts: string[] = [
    `<!-- generated index for the product-map directory — do not edit -->`,
    "",
    `# ${surfaces.scope} — product map`,
    "",
    `Extracted at commit \`${surfaces.generatedFrom.commit?.slice(0, options.commitDisplayLength) ?? "n/a"}\` (${surfaces.generatedFrom.workingTree} tree) by ${surfaces.generator.name}@${surfaces.generator.version}.`,
    "",
    `- **${surfaces.items.length} surfaces** across ${new Set(surfaces.items.map((s) => s.surfaceType)).size} types — [inventory](./surfaces.existing.generated.md)`,
    `- **${capabilities.items.length} capabilities** across ${new Set(capabilities.items.map((c) => c.kind)).size} kinds — [inventory](./capabilities.existing.generated.md)`,
  ];
  if (map !== null) {
    const counts = new Map<string, number>();
    for (const e of map.items) counts.set(e.relationship, (counts.get(e.relationship) ?? 0) + 1);
    const summary = [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([rel, n]) => `${n} ${rel}`)
      .join(" · ");
    parts.push(
      `- **Map**: ${summary} — [details](./map.existing.generated.md), [gaps report](./product-surface-gaps.generated.md)`,
    );
  }
  parts.push(
    `- **Planned stance**: ${hasPlanned ? "present — planned-vs-existing map and diffs are generated" : "not yet authored — run the Claude Design prompts in this repo's prompts/ (or product-map's) to produce surfaces.planned.json"}`,
    "",
    "## Files",
    "",
    "| File | What it is |",
    "| ---- | ---------- |",
    "| `surfaces.existing.json` | machine-readable surface inventory (source of truth) |",
    "| `capabilities.existing.json` | machine-readable capability inventory (source of truth) |",
    "| `maps/map.existing.json` | surface ↔ capability join with relationship classification |",
    "| `generated/*.generated.md` | human-readable renderings of the JSON (never edit) |",
    "",
    "Regenerate with `pmap all --repo <this repo>`; verify freshness with `pmap check-fresh`.",
    "",
  );
  return parts.join("\n");
}

/**
 * Projection of a fleet manifest. Like every other renderer here it reads only
 * the manifest, so the matrix cannot say anything the JSON does not.
 */
export function renderFleet(manifest: FleetManifest, file: string, overrides: Partial<RenderOptions> = {}): string {
  const options = createRenderOptions(overrides);
  const parts = [header(manifest, file, "fleet matrix", options)];
  const covered = manifest.items.filter((entry) => entry.state === "mapped" || entry.state === "scanned");
  const committed = covered.filter((entry) => entry.state === "mapped");
  const missing = manifest.items.filter((entry) => entry.state !== "mapped" && entry.state !== "scanned");

  parts.push(
    `${covered.length} of ${manifest.items.length} repositories reported a product map (${committed.length} committed, ${covered.length - committed.length} extracted live), covering ${covered.reduce((total, entry) => total + entry.surfaceCount, 0)} surfaces and ${covered.reduce((total, entry) => total + entry.capabilityCount, 0)} capabilities.`,
    "",
    "| Repo | Source | Commit | Surfaces | Capabilities | Planned | Misplaced | Surface types |",
    "| ---- | ------ | ------ | -------- | ------------ | ------- | --------- | ------------- |",
  );
  for (const entry of covered) {
    const types = Object.entries(entry.surfacesByType)
      .sort()
      .map(([type, count]) => (count > 1 ? `${type} x${count}` : type))
      .join(", ");
    parts.push(
      `| ${esc(entry.repo)} | ${entry.state} | \`${entry.commit?.slice(0, options.shortCommitDisplayLength) ?? "n/a"}\`${entry.workingTree === "dirty" ? " (dirty)" : ""} | ${entry.surfaceCount} | ${entry.capabilityCount} | ${entry.hasPlanned ? "yes" : "no"} | ${entry.misplacedCount > 0 ? `**${entry.misplacedCount}**` : "0"} | ${types} |`,
    );
  }
  parts.push("");

  if (missing.length > 0) {
    parts.push("## Not mapped", "");
    for (const entry of missing) {
      parts.push(`- **${esc(entry.repo)}** (\`${entry.path}\`) — ${entry.state}: ${esc(entry.note ?? "")}`);
    }
    parts.push("");
  }

  if (committed.length > 0) {
    parts.push("## Per-repository maps", "");
  }
  for (const entry of committed) {
    parts.push(`- **${esc(entry.repo)}** — \`${entry.path}/docs/reference/product-map/generated/README.generated.md\``);
  }
  parts.push("");
  return parts.join("\n");
}
