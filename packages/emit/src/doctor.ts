import type {
  AdapterIssue,
  CapabilityItem,
  CapabilityManifest,
  SkippedItem,
  SurfaceItem,
  SurfaceManifest,
} from "@product-map/spec";

import { groupBy } from "./shared";

export type DoctorSeverity = "error" | "warning" | "note";

export interface DoctorFinding {
  severity: DoctorSeverity;
  code: string;
  detail: string;
  remedy: string;
}

export interface DoctorData {
  scope: string;
  adaptersRun: string[];
  adaptersSilent: string[];
  adaptersExcluded: string[];
  surfaceCount: number;
  capabilityCount: number;
  findings: DoctorFinding[];
}

export interface DoctorInput {
  surfaces: SurfaceManifest;
  capabilities: CapabilityManifest;
  adaptersAvailable: readonly string[];
  adaptersRun: readonly string[];
  adaptersExcluded: readonly string[];
  skipped: readonly SkippedItem[];
  localIssues: readonly string[];
  adapterIssues: readonly AdapterIssue[];
}

/**
 * Surface types whose whole point is fronting capabilities of a given kind. A
 * repo that has the surface but none of the capability is not "clean" — it is
 * a repo whose extraction is thin, and saying so is the entire job of doctor.
 */
const EXPECTED_CAPABILITY_KINDS: ReadonlyArray<{
  surfaceType: SurfaceItem["surfaceType"];
  kind: CapabilityItem["kind"];
}> = [
  { surfaceType: "cli", kind: "command" },
  { surfaceType: "tui", kind: "command" },
  { surfaceType: "mcp", kind: "mcp-tool" },
  { surfaceType: "dashboard", kind: "route" },
  { surfaceType: "docs", kind: "route" },
  { surfaceType: "lsp", kind: "lsp-method" },
  { surfaceType: "lint-plugin", kind: "rule" },
];

const REMEDY_LOCAL_EXTRACTOR =
  "teach docs/reference/product-map/extract.local.mjs to emit them, or report the adapter gap upstream";
const REMEDY_CONFIG_BINDS = "declare the wiring in product-map.config.mjs `binds`, or emit it from extract.local.mjs";
const REMEDY_CONFIG_TYPO = "fix the id in product-map.config.mjs";
const REMEDY_UNEXPOSED =
  "decide the exposure: front them from a surface and declare the bind, or stop distributing what nothing is meant to reach";
const REMEDY_UNDETERMINED_REACH =
  "record the reach — set it from docs/reference/product-map/extract.local.mjs or an `overrides` entry in product-map.config.mjs, or report the adapter gap upstream";
const REMEDY_DEDUPE = "rename one of the items, or pin the winner with an `overrides` entry in product-map.config.mjs";
const REMEDY_SUPERSEDED = "nothing to do — extract.local.mjs is authoritative and enriched this item";
const REMEDY_OVERLAP = "nothing to do — two adapters described this item and the richer description won";
const REMEDY_ADAPTER_DUPLICATE =
  "one adapter emitted this id twice, so neither item can be renamed here: exclude it with `adapters.exclude` in product-map.config.mjs, and report the collision upstream";
const REMEDY_ADAPTER_FAILURE =
  "silence the adapter with an `adapters.exclude` entry in product-map.config.mjs, and report the failure upstream";
const REMEDY_CATCH_ALL =
  "if a manifest or content collection decides which pages the catch-all serves, enumerate those pages as views from docs/reference/product-map/extract.local.mjs";

// `[...slug]` and `[[...slug]]`: one route file that serves a set of pages the
// filesystem does not enumerate, so the view list may be a fraction of the UI.
const CATCH_ALL_SEGMENT = /\[\[\.\.\.[^\]]+\]\]|\[\.\.\.[^\]]+\]/;

const SUPERSEDED_BY_LOCAL = "superseded by local";

const SUPERSEDED: Omit<DoctorFinding, "detail"> = { severity: "note", code: "superseded", remedy: REMEDY_SUPERSEDED };
const OVERLAP: Omit<DoctorFinding, "detail"> = { severity: "note", code: "adapter-overlap", remedy: REMEDY_OVERLAP };
const DUPLICATE: Omit<DoctorFinding, "detail"> = { severity: "warning", code: "duplicate-id", remedy: REMEDY_DEDUPE };
const ADAPTER_DUPLICATE: Omit<DoctorFinding, "detail"> = {
  severity: "warning",
  code: "adapter-duplicate",
  remedy: REMEDY_ADAPTER_DUPLICATE,
};

/**
 * Only collisions the author can act on are warnings. Two adapters describing
 * one item, or a generic adapter losing to the repo-local extractor, are the
 * system working as designed — reporting them as duplicates would demand a
 * rename of items the author never wrote. One adapter colliding with itself is
 * a different animal and stays a warning: it is a genuine duplicate id, and the
 * remedy differs depending on whether the author owns that adapter.
 */
function classifySkipped(item: SkippedItem): Omit<DoctorFinding, "detail"> {
  if (item.adapter === "config") {
    return { severity: "error", code: "config-reference", remedy: REMEDY_CONFIG_TYPO };
  }
  if (item.collision !== undefined) {
    switch (item.collision.resolvedBy) {
      case "local-authority":
        return SUPERSEDED;
      case "richness":
        return OVERLAP;
      case "same-adapter":
        return ADAPTER_DUPLICATE;
      default:
        return DUPLICATE;
    }
  }
  return item.reason === SUPERSEDED_BY_LOCAL ? SUPERSEDED : DUPLICATE;
}

export function diagnose(input: DoctorInput): DoctorData {
  const findings: DoctorFinding[] = [];
  const run = new Set(input.adaptersRun);
  const failed = new Set(input.adapterIssues.map((issue) => issue.adapter));

  for (const issue of input.localIssues) {
    findings.push({
      severity: "error",
      code: "local-extractor",
      detail: issue,
      remedy: "fix docs/reference/product-map/extract.local.mjs; --allow-partial-local accepts degraded output",
    });
  }

  for (const issue of input.adapterIssues) {
    findings.push({
      severity: "warning",
      code: "adapter-failure",
      detail: `${issue.adapter}: ${issue.message}`,
      remedy: REMEDY_ADAPTER_FAILURE,
    });
  }

  for (const item of input.skipped) {
    findings.push({ ...classifySkipped(item), detail: `${item.id}: ${item.reason}` });
  }

  const kindCounts = new Map<string, number>();
  for (const item of input.capabilities.items) kindCounts.set(item.kind, (kindCounts.get(item.kind) ?? 0) + 1);
  for (const { surfaceType, kind } of EXPECTED_CAPABILITY_KINDS) {
    const surfaces = input.surfaces.items.filter((item) => item.surfaceType === surfaceType);
    if (surfaces.length === 0 || (kindCounts.get(kind) ?? 0) > 0) continue;
    findings.push({
      severity: "warning",
      code: "thin-extraction",
      detail: `${surfaces.length} ${surfaceType} surface(s) but zero ${kind} capabilities`,
      remedy: REMEDY_LOCAL_EXTRACTOR,
    });
  }

  for (const surface of input.surfaces.items) {
    if (surface.binds.length > 0) continue;
    findings.push({
      severity: "note",
      code: "unbound-surface",
      detail: `${surface.id} (${surface.surfaceType}) fronts nothing`,
      remedy: REMEDY_CONFIG_BINDS,
    });
  }

  for (const surface of input.surfaces.items) {
    const catchAll = (surface.views ?? []).map((view) => view.name).filter((name) => CATCH_ALL_SEGMENT.test(name));
    if (catchAll.length === 0) continue;
    findings.push({
      severity: "note",
      code: "catch-all-route",
      detail: `${surface.id} has catch-all view(s) ${catchAll.join(", ")} and may render more pages than its view list shows`,
      remedy: REMEDY_CATCH_ALL,
    });
  }

  // An unbound capability means something different per reach, so the two
  // reportable buckets get their own code and remedy: `external` is an
  // exposure decision the author has to make, `unknown` is a hole in what the
  // extractors observed. Unbound `internal` is the normal state of plumbing
  // and stays unreported.
  const bound = new Set(input.surfaces.items.flatMap((surface) => surface.binds.map((bind) => bind.capabilityId)));
  for (const capability of input.capabilities.items) {
    if (bound.has(capability.id) || capability.reach === "internal") continue;
    findings.push(
      capability.reach === "external"
        ? {
            severity: "note",
            code: "unexposed-capability",
            detail: `${capability.id} (${capability.kind}) is externally consumable, and no surface exposes it`,
            remedy: REMEDY_UNEXPOSED,
          }
        : {
            severity: "note",
            code: "undetermined-reach",
            detail: `${capability.id} (${capability.kind}) is unbound, and its reach was never observed`,
            remedy: REMEDY_UNDETERMINED_REACH,
          },
    );
  }

  return {
    scope: input.surfaces.scope,
    adaptersRun: [...input.adaptersRun],
    // an adapter that threw is not silent — it is reported by its own finding,
    // and listing it here would claim detect() found nothing it understood
    adaptersSilent: input.adaptersAvailable.filter((name) => !run.has(name) && !failed.has(name)),
    adaptersExcluded: [...input.adaptersExcluded],
    surfaceCount: input.surfaces.items.length,
    capabilityCount: input.capabilities.items.length,
    findings,
  };
}

const SEVERITY_ORDER: readonly DoctorSeverity[] = ["error", "warning", "note"];

export function renderDiagnosis(data: DoctorData): string {
  const lines = [
    `${data.scope} — ${data.surfaceCount} surfaces, ${data.capabilityCount} capabilities`,
    "",
    `ADAPTERS RUN (${data.adaptersRun.length})`,
    `  ${data.adaptersRun.join(", ")}`,
    "",
    `ADAPTERS SILENT (${data.adaptersSilent.length}) — detect() found nothing they understand`,
    `  ${data.adaptersSilent.length === 0 ? "none" : data.adaptersSilent.join(", ")}`,
  ];
  if (data.adaptersExcluded.length > 0) {
    lines.push(
      "",
      `ADAPTERS EXCLUDED BY CONFIG (${data.adaptersExcluded.length})`,
      `  ${data.adaptersExcluded.join(", ")}`,
    );
  }

  for (const severity of SEVERITY_ORDER) {
    const findings = data.findings.filter((finding) => finding.severity === severity);
    if (findings.length === 0) continue;
    lines.push("", `${severity.toUpperCase()} (${findings.length})`);
    // Grouped by code so the remedy is stated once per class of problem rather
    // than repeated under every instance of it.
    for (const [code, group] of groupBy(findings, (finding) => finding.code)) {
      lines.push(`  ${code}`);
      lines.push(...group.map((finding) => `    ${finding.detail}`));
      lines.push(`    -> ${group[0]?.remedy ?? ""}`);
    }
  }

  if (data.findings.length === 0)
    lines.push("", "No findings: every adapter that detected something contributed items.");
  lines.push("");
  return lines.join("\n");
}
