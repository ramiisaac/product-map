import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import type { CapabilityManifest, Generator, Manifest, ManifestKind, SurfaceManifest } from "@product-map/spec";
import { finalizeManifest, serializeManifest, validateManifest } from "@product-map/spec";

import type { CommandName } from "./registry";
import { diffManifests, rejectedRenames } from "@product-map/derive";
import { extractRepo } from "@product-map/extract";
import type { DeriveContext, FleetRepoInput } from "@product-map/derive";
import { buildFleetManifest } from "@product-map/derive";
import type { ManifestRole } from "./layout";
import type { AssetPaths } from "./layout";
import { GENERATED_DIR, MANIFESTS, productMapDir } from "./layout";
import { mapManifests } from "@product-map/derive";
import {
  buildDigest,
  renderCapabilities,
  renderDigest,
  renderFleet,
  renderGaps,
  renderIndex,
  renderMap,
  renderSurfaces,
} from "@product-map/emit";
import { renderReconciliationPlan } from "@product-map/emit";
import { loadRepoContext } from "@product-map/discovery";
import type { Logger } from "@product-map/runtime";
import { pool, SILENT_LOGGER } from "@product-map/runtime";
import type { ResolvedOptions } from "./options";
import { deriveContextFor, EMPTY_OPTIONS } from "./options";
import { CliError } from "./errors";
import { loadInventory } from "./inventory";
import type { OutputFormat } from "./read-only";
import {
  renderBundleCommand,
  renderDigestCommand,
  renderDoctorCommand,
  renderExplainCommand,
  renderShowCommand,
} from "./read-only";
import { Writer } from "./writer";

/**
 * The application layer: every command's behavior, expressed as functions that
 * take explicit inputs, stage output through a Writer, and signal user-facing
 * failure by throwing CliError. Nothing here calls process.exit or reads argv,
 * so a test can drive `runCommand` in-process and assert on the thrown error
 * or the Writer's staged overlay. The thin argv/process adapter in cli.ts maps
 * CliError to an exit code and commits the Writer once a command succeeds.
 */

/** Optional roster read by `fleet` when no repo paths are given. */
export const FLEET_ROSTER_FILE = "product-map.fleet.json";
const FLEET_MANIFEST_FILE = "fleet.json";
const EXTRACT_COMMIT_DISPLAY_LENGTH = 8;
const HASH_DISPLAY_LENGTH = 12;
export const DIGEST_FILE = "digest.generated.md";
const FLEET_RENDER_FILE = "fleet.generated.md";

type ManifestOf<K extends ManifestKind> = Extract<Manifest, { kind: K }>;

/**
 * Parse and fully vet a raw manifest for the slot it claims to occupy: valid
 * JSON, a structurally valid manifest, the kind and stance the slot requires,
 * and canonical on-disk bytes. Every failure is a CliError, so a manifest in
 * the wrong slot or with non-canonical bytes is caught here rather than
 * crashing a downstream stage that trusted the slot.
 */
function parseManifestForRole(raw: string, role: ManifestRole, rel: string): Manifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CliError(`${rel} is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
  const result = validateManifest(parsed);
  if (!result.ok) {
    throw new CliError(`${rel} is invalid:\n${result.issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n")}`);
  }
  const manifest = parsed as Manifest;
  if (manifest.kind !== role.kind || manifest.stance !== role.stance) {
    throw new CliError(
      `${rel} must be a ${role.stance} ${role.kind} manifest, but declares ${manifest.stance} ${manifest.kind}`,
    );
  }
  if (raw !== serializeManifest(manifest)) {
    throw new CliError(`${rel} is not canonical on disk; regenerate it (pmap all) or re-ingest it (pmap ingest)`);
  }
  return manifest;
}

/**
 * Load the manifest expected in a slot, or null when the file is absent. The
 * return type is narrowed to the slot's kind because parseManifestForRole has
 * verified it at runtime.
 */
function loadManifest<R extends ManifestRole>(dir: string, role: R, writer?: Writer): ManifestOf<R["kind"]> | null {
  const file = join(dir, role.rel);
  const raw = writer !== undefined ? writer.read(file) : existsSync(file) ? readFileSync(file, "utf8") : null;
  if (raw === null) return null;
  return parseManifestForRole(raw, role, role.rel) as ManifestOf<R["kind"]>;
}

export interface RunExtractOptions {
  generator: Generator;
  logger?: Logger;
  options?: ResolvedOptions;
  allowRepoCode?: boolean;
  /** Write partial output when the repo-local extractor fails or emits invalid items, instead of failing closed. */
  allowPartialLocal?: boolean;
  recordedContext?: Pick<SurfaceManifest["generatedFrom"], "commit" | "workingTree">;
}

export async function runExtract(
  repoRoot: string,
  writer: Writer,
  options: RunExtractOptions,
): Promise<{ surfaces: SurfaceManifest; capabilities: CapabilityManifest }> {
  const logger = options.logger ?? SILENT_LOGGER;
  const resolved = options.options ?? EMPTY_OPTIONS;
  const liveContext = loadRepoContext(repoRoot, resolved.discovery);
  const ctx = options.recordedContext === undefined ? liveContext : { ...liveContext, ...options.recordedContext };
  const result = await extractRepo(ctx, {
    generator: options.generator,
    allowRepoCode: options.allowRepoCode,
    config: resolved.config,
    ...(resolved.config.localExtractor === undefined ? {} : { localExtractor: resolved.config.localExtractor }),
  });
  logger.info(
    `extract: ${ctx.repoName}@${ctx.commit?.slice(0, EXTRACT_COMMIT_DISPLAY_LENGTH) ?? "no-git"} (${ctx.workingTree}) — adapters: ${result.adaptersRun.join(", ")}`,
  );
  logger.info(`  ${result.surfaces.items.length} surfaces, ${result.capabilities.items.length} capabilities`);
  for (const issue of result.localIssues) logger.warn(`  local-extractor: ${issue}`);
  // A failed adapter is fail-soft by design, but silence would let the run
  // write manifests missing its items with no signal at all — and an adapter
  // that only throws on some machines would then read as unexplained drift.
  for (const issue of result.adapterIssues) logger.warn(`  adapter-failure: ${issue.adapter}: ${issue.message}`);
  // The repo-local extractor is authoritative, so its failure must fail the
  // run closed — otherwise a transient error silently drops authoritative
  // items and rewrites the manifests without them. --allow-partial-local opts
  // into the degraded output explicitly.
  if (options.allowPartialLocal !== true && result.localIssues.length > 0) {
    throw new CliError(
      `repo-local extractor failed (${result.localIssues.length} issue(s)); refusing to write partial output. Fix docs/reference/product-map/extract.local.mjs, or pass --allow-partial-local to accept degraded output:\n${result.localIssues.map((issue) => `  - ${issue}`).join("\n")}`,
    );
  }
  // adapters and config overrides are trusted TypeScript, but a bad override
  // (or adapter bug) must fail here, not on the next load of the written file
  for (const [label, manifest] of [
    ["surfaces", result.surfaces],
    ["capabilities", result.capabilities],
  ] as const) {
    const check = validateManifest(manifest);
    if (!check.ok) {
      throw new CliError(
        `extraction produced an invalid ${label} manifest (check product-map.config.mjs overrides and extract.local.mjs):\n${check.issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n")}`,
      );
    }
  }
  const dir = productMapDir(repoRoot);
  writer.write(join(dir, MANIFESTS.surfacesExisting.rel), serializeManifest(result.surfaces));
  writer.write(join(dir, MANIFESTS.capabilitiesExisting.rel), serializeManifest(result.capabilities));
  return { surfaces: result.surfaces, capabilities: result.capabilities };
}

export function runMap(
  repoRoot: string,
  writer: Writer,
  deriveContext: DeriveContext,
  existing?: { surfaces: SurfaceManifest; capabilities: CapabilityManifest },
  logger: Logger = SILENT_LOGGER,
): void {
  const dir = productMapDir(repoRoot);
  const surfaces = existing?.surfaces ?? loadManifest(dir, MANIFESTS.surfacesExisting, writer);
  const capabilities = existing?.capabilities ?? loadManifest(dir, MANIFESTS.capabilitiesExisting, writer);
  if (surfaces === null || capabilities === null) {
    throw new CliError("map requires existing manifests; run `pmap extract` first");
  }
  writer.write(
    join(dir, MANIFESTS.mapExisting.rel),
    serializeManifest(mapManifests(surfaces, capabilities, deriveContext)),
  );
  const planned = loadManifest(dir, MANIFESTS.surfacesPlanned, writer);
  const capsPlanned = loadManifest(dir, MANIFESTS.capabilitiesPlanned, writer);
  if (planned !== null) {
    writer.write(
      join(dir, MANIFESTS.mapPlannedVsExisting.rel),
      serializeManifest(mapManifests(planned, capabilities, deriveContext)),
    );
  } else {
    logger.info("  (no surfaces.planned.json — skipping planned-vs-existing map)");
    writer.remove(join(dir, MANIFESTS.mapPlannedVsExisting.rel));
  }
  if (capsPlanned !== null) {
    writer.write(
      join(dir, MANIFESTS.mapExistingVsPlanned.rel),
      serializeManifest(mapManifests(surfaces, capsPlanned, deriveContext)),
    );
    if (planned !== null) {
      writer.write(
        join(dir, MANIFESTS.mapPlanned.rel),
        serializeManifest(mapManifests(planned, capsPlanned, deriveContext)),
      );
    } else {
      writer.remove(join(dir, MANIFESTS.mapPlanned.rel));
    }
  } else {
    writer.remove(join(dir, MANIFESTS.mapExistingVsPlanned.rel));
    writer.remove(join(dir, MANIFESTS.mapPlanned.rel));
  }
}

export function runDiff(
  repoRoot: string,
  writer: Writer,
  deriveContext: DeriveContext,
  logger: Logger = SILENT_LOGGER,
): void {
  const dir = productMapDir(repoRoot);
  const warnRejectedRenames = (
    from: Parameters<typeof rejectedRenames>[0],
    to: Parameters<typeof rejectedRenames>[1],
  ) => {
    for (const { rename, reason } of rejectedRenames(from, to, deriveContext.renames)) {
      logger.warn(
        `  declared rename ${rename.fromId} -> ${rename.toId} ignored (${reason}) — reported as added/removed instead`,
      );
    }
  };
  const surfacesExisting = loadManifest(dir, MANIFESTS.surfacesExisting, writer);
  const surfacesPlanned = loadManifest(dir, MANIFESTS.surfacesPlanned, writer);
  if (surfacesExisting !== null && surfacesPlanned !== null) {
    warnRejectedRenames(surfacesExisting, surfacesPlanned);
    writer.write(
      join(dir, MANIFESTS.surfacesDiff.rel),
      serializeManifest(diffManifests(surfacesExisting, surfacesPlanned, deriveContext)),
    );
  } else {
    logger.info("  (no surfaces.planned.json — skipping surfaces diff)");
    writer.remove(join(dir, MANIFESTS.surfacesDiff.rel));
  }
  const capsExisting = loadManifest(dir, MANIFESTS.capabilitiesExisting, writer);
  const capsPlanned = loadManifest(dir, MANIFESTS.capabilitiesPlanned, writer);
  if (capsExisting !== null && capsPlanned !== null) {
    warnRejectedRenames(capsExisting, capsPlanned);
    writer.write(
      join(dir, MANIFESTS.capabilitiesDiff.rel),
      serializeManifest(diffManifests(capsExisting, capsPlanned, deriveContext)),
    );
  } else {
    writer.remove(join(dir, MANIFESTS.capabilitiesDiff.rel));
  }
}

export function runRender(repoRoot: string, writer: Writer, resolved: ResolvedOptions = EMPTY_OPTIONS): void {
  const dir = productMapDir(repoRoot);
  const generated = (name: string) => join(dir, GENERATED_DIR, name);
  const renderTargets = [
    { role: MANIFESTS.surfacesExisting, render: renderSurfaces },
    { role: MANIFESTS.surfacesPlanned, render: renderSurfaces },
    { role: MANIFESTS.capabilitiesExisting, render: renderCapabilities },
    { role: MANIFESTS.capabilitiesPlanned, render: renderCapabilities },
    { role: MANIFESTS.mapExisting, render: renderMap },
    { role: MANIFESTS.mapPlannedVsExisting, render: renderMap },
    { role: MANIFESTS.mapExistingVsPlanned, render: renderMap },
    { role: MANIFESTS.mapPlanned, render: renderMap },
  ] as const;
  // outputs.markdown turns off the human-readable projections for consumers
  // that render elsewhere. Turning one off removes it rather than leaving a
  // stale copy behind, so the directory never disagrees with the config.
  const markdown = resolved.outputs.markdown;
  for (const { role, render } of renderTargets) {
    const outName = `${role.rel.replace(/^maps\//, "").replace(/\.json$/, "")}.generated.md`;
    const manifest = loadManifest(dir, role, writer);
    if (manifest === null || !markdown) {
      writer.remove(generated(outName));
      continue;
    }
    const renderManifest = render as (m: Manifest, f: string, o: typeof resolved.render) => string;
    writer.write(generated(outName), renderManifest(manifest, role.rel, resolved.render));
  }
  const surfaces = loadManifest(dir, MANIFESTS.surfacesExisting, writer);
  const capabilities = loadManifest(dir, MANIFESTS.capabilitiesExisting, writer);
  const map = loadManifest(dir, MANIFESTS.mapExisting, writer);
  if (surfaces !== null && capabilities !== null && markdown) {
    if (map !== null) {
      writer.write(
        generated("product-surface-gaps.generated.md"),
        renderGaps(surfaces, capabilities, map, MANIFESTS.mapExisting.rel, resolved.render),
      );
    } else {
      writer.remove(generated("product-surface-gaps.generated.md"));
    }
    const hasPlanned = writer.exists(join(dir, MANIFESTS.surfacesPlanned.rel));
    writer.write(
      generated("README.generated.md"),
      renderIndex(surfaces, capabilities, map, hasPlanned, resolved.render),
    );
  } else {
    writer.remove(generated("product-surface-gaps.generated.md"));
    writer.remove(generated("README.generated.md"));
  }
  if (surfaces !== null && capabilities !== null && resolved.outputs.digest) {
    // The committed digest uses the config-composed budget, never --max-tokens:
    // a flag that changed committed bytes would make check-fresh report drift
    // for anyone who passed a different one.
    writer.write(generated(DIGEST_FILE), renderDigest(buildDigest({ surfaces, capabilities, map }), resolved.digest));
  } else {
    writer.remove(generated(DIGEST_FILE));
  }
  const plannedSurfaces = loadManifest(dir, MANIFESTS.surfacesPlanned, writer);
  const plannedMap = loadManifest(dir, MANIFESTS.mapPlannedVsExisting, writer);
  if (plannedSurfaces !== null && plannedMap !== null && capabilities !== null && markdown) {
    const surfacesDiff = loadManifest(dir, MANIFESTS.surfacesDiff, writer);
    writer.write(
      generated("reconciliation-plan.generated.md"),
      renderReconciliationPlan(plannedSurfaces, capabilities, plannedMap, surfacesDiff, resolved.render),
    );
  } else {
    writer.remove(generated("reconciliation-plan.generated.md"));
  }
}

export function runIngest(repoRoot: string, writer: Writer, files: string[], logger: Logger = SILENT_LOGGER): void {
  if (files.length === 0)
    throw new CliError("ingest requires one or more raw manifest files (pasted Claude Design output)");
  const dir = productMapDir(repoRoot);
  const staged: Array<{ file: string; finalized: SurfaceManifest | CapabilityManifest; target: string }> = [];
  for (const file of files) {
    const full = resolve(file);
    if (!existsSync(full)) throw new CliError(`no such file: ${full}`);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(full, "utf8"));
    } catch (error) {
      throw new CliError(`${file}: not valid JSON (${error instanceof Error ? error.message : String(error)})`);
    }
    const record = raw as Record<string, unknown>;
    if (record["stance"] !== "planned") {
      throw new CliError(`${file}: ingest only accepts stance "planned" manifests (got "${String(record["stance"])}")`);
    }
    // pasted design output arrives with an empty/absent contentHash; finalize
    // sorts items, canonicalizes, and stamps the hash before validation.
    // Structurally broken pastes (items missing/not an array, non-finite
    // numbers) must bounce like any other invalid manifest, never stack-trace.
    let finalized: Manifest;
    try {
      if (!Array.isArray(record["items"])) throw new Error(`"items" must be an array (got ${typeof record["items"]})`);
      finalized = finalizeManifest<Manifest>(record as never);
    } catch (error) {
      throw new CliError(
        `INGEST BOUNCE for ${file} — paste this back into the Claude Design project:\n  - manifest is structurally malformed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const result = validateManifest(finalized);
    if (!result.ok) {
      throw new CliError(
        `INGEST BOUNCE for ${file} — paste this back into the Claude Design project:\n${result.issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n")}`,
      );
    }
    const target =
      finalized.kind === "surface"
        ? MANIFESTS.surfacesPlanned.rel
        : finalized.kind === "capability"
          ? MANIFESTS.capabilitiesPlanned.rel
          : null;
    if (target === null)
      throw new CliError(`${file}: ingest accepts surface/capability manifests, not ${finalized.kind}`);
    staged.push({ file, finalized: finalized as SurfaceManifest | CapabilityManifest, target });
  }
  for (const { file, finalized, target } of staged) {
    writer.write(join(dir, target), serializeManifest(finalized));
    logger.info(
      `  ingested ${file} -> ${target} (${finalized.items.length} items, hash ${finalized.contentHash.slice(0, HASH_DISPLAY_LENGTH)})`,
    );
  }
}

/** Recursively list JSON files under the product-map dir, relative to it, skipping vendored JSON Schemas. */
function listManifestJson(dir: string, sub = ""): string[] {
  const abs = join(dir, sub);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs).sort()) {
    if (sub === "" && entry === "schemas") continue;
    const rel = sub === "" ? entry : `${sub}/${entry}`;
    if (statSync(join(dir, rel)).isDirectory()) out.push(...listManifestJson(dir, rel));
    else if (entry.endsWith(".json")) out.push(rel);
  }
  return out;
}

export function runValidate(repoRoot: string, logger: Logger = SILENT_LOGGER): void {
  const dir = productMapDir(repoRoot);
  if (!existsSync(dir)) throw new CliError(`no product-map directory at ${dir}`);
  const byRel = new Map<string, ManifestRole>(Object.values(MANIFESTS).map((role) => [role.rel, role]));
  const failures: string[] = [];
  let checked = 0;
  for (const rel of listManifestJson(dir)) {
    const role = byRel.get(rel);
    if (role === undefined) {
      failures.push(`  FAIL ${rel}\n    - unexpected JSON file (not a known product-map manifest slot)`);
      continue;
    }
    checked += 1;
    try {
      parseManifestForRole(readFileSync(join(dir, rel), "utf8"), role, rel);
      logger.info(`  ok ${rel}`);
    } catch (error) {
      failures.push(`  FAIL ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) {
    throw new CliError(`${checked} manifest(s) checked; ${failures.length} problem(s):\n${failures.join("\n")}`);
  }
  logger.info(`validate: ${checked} manifests checked, all valid`);
}

/**
 * Extraction across repositories, which is the only place concurrency buys
 * anything: within one repo the adapters are regex over a cached file index,
 * but N repos means N tree walks and N git spawns. `pool` returns results in
 * input order, so the fleet manifest stays byte-identical regardless of which
 * repository finishes first.
 */
export async function scanFleetRepos(
  repoPaths: readonly string[],
  generator: Generator,
  resolved: ResolvedOptions,
  allowRepoCode: boolean,
  logger: Logger = SILENT_LOGGER,
): Promise<FleetRepoInput[]> {
  return pool(
    repoPaths,
    async (repoPath): Promise<FleetRepoInput> => {
      const root = resolve(repoPath);
      const hasPlanned = existsSync(join(productMapDir(root), MANIFESTS.surfacesPlanned.rel));
      try {
        const inventory = await loadInventory({ repoRoot: root, generator, options: resolved, allowRepoCode });
        logger.info(
          `  scanned ${repoPath}: ${inventory.surfaces.items.length} surfaces, ${inventory.capabilities.items.length} capabilities`,
        );
        return {
          path: repoPath,
          scanned: true,
          surfaces: inventory.surfaces,
          capabilities: inventory.capabilities,
          hasPlanned,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`  fleet: ${repoPath}: ${message}`);
        return { path: repoPath, surfaces: null, capabilities: null, hasPlanned, error: message };
      }
    },
    { concurrency: resolved.concurrency },
  );
}

export function runFleet(
  name: string,
  repoPaths: string[],
  outDir: string,
  writer: Writer,
  deriveContext: DeriveContext,
  resolved: ResolvedOptions = EMPTY_OPTIONS,
  logger: Logger = SILENT_LOGGER,
  scanned?: readonly FleetRepoInput[],
): void {
  if (repoPaths.length === 0) throw new CliError("fleet requires one or more repo paths");
  const inputs: FleetRepoInput[] =
    scanned !== undefined
      ? [...scanned]
      : repoPaths.map((repoPath) => {
          const dir = productMapDir(resolve(repoPath));
          const hasPlanned = existsSync(join(dir, MANIFESTS.surfacesPlanned.rel));
          // one repo's broken manifest is a row with a reason, not a dead run
          try {
            return {
              path: repoPath,
              surfaces: loadManifest(dir, MANIFESTS.surfacesExisting),
              capabilities: loadManifest(dir, MANIFESTS.capabilitiesExisting),
              hasPlanned,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`  fleet: ${repoPath}: ${message}`);
            return { path: repoPath, surfaces: null, capabilities: null, hasPlanned, error: message };
          }
        });
  const manifest = buildFleetManifest(name, inputs, deriveContext);
  const check = validateManifest(manifest);
  if (!check.ok) {
    throw new CliError(
      `fleet produced an invalid manifest (duplicate repository names?):\n${check.issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n")}`,
    );
  }
  writer.write(join(outDir, FLEET_MANIFEST_FILE), serializeManifest(manifest));
  writer.write(join(outDir, FLEET_RENDER_FILE), renderFleet(manifest, FLEET_MANIFEST_FILE, resolved.render));
}

export function runInit(repoRoot: string, writer: Writer, assets: AssetPaths): void {
  const dir = productMapDir(repoRoot);
  for (const name of readdirSync(assets.promptsDir)) {
    writer.write(join(dir, "prompts", name), readFileSync(join(assets.promptsDir, name), "utf8"));
  }
  for (const name of readdirSync(assets.schemasDir)) {
    writer.write(join(dir, "schemas", name), readFileSync(join(assets.schemasDir, name), "utf8"));
  }
}

export async function runCheckFresh(
  repoRoot: string,
  allowRepoCode: boolean,
  generator: Generator,
  resolved: ResolvedOptions = EMPTY_OPTIONS,
  logger: Logger = SILENT_LOGGER,
): Promise<void> {
  // always a dry-run by construction: regenerate in memory, compare to disk
  const writer = new Writer({ dryRun: true });
  // The commit that adds generated files cannot be embedded in those same
  // files. Preserve the recorded git context so freshness measures semantic
  // artifacts, not the artifact-only commit or a clean/dirty transition. The
  // recorded generator is preserved for the same reason: a newer pmap would
  // otherwise rewrite every envelope and report fleet-wide drift with no
  // semantic change, while a version that does change extraction still drifts
  // through the items.
  const recorded = loadManifest(productMapDir(repoRoot), MANIFESTS.surfacesExisting);
  const effectiveGenerator = recorded === null ? generator : recorded.generator;
  const deriveContext = deriveContextFor(effectiveGenerator, resolved);
  const extracted = await runExtract(repoRoot, writer, {
    generator: effectiveGenerator,
    logger,
    options: resolved,
    allowRepoCode,
    ...(recorded === null
      ? {}
      : {
          recordedContext: { commit: recorded.generatedFrom.commit, workingTree: recorded.generatedFrom.workingTree },
        }),
  });
  runMap(repoRoot, writer, deriveContext, extracted, logger);
  runDiff(repoRoot, writer, deriveContext, logger);
  runRender(repoRoot, writer, resolved);
  const drift = writer.writes.filter((w) => w.action !== "unchanged");
  if (drift.length === 0) {
    logger.info("check-fresh: OK — committed product-map matches regeneration");
    return;
  }
  throw new CliError(
    `check-fresh: DRIFT — the following files are stale or missing:\n${drift.map((w) => `  ${w.action.padEnd(9)} ${w.path}`).join("\n")}`,
  );
}

export interface CommandContext {
  repoRoot: string;
  writer: Writer;
  generator: Generator;
  options: ResolvedOptions;
  logger: Logger;
  /** Command output proper — the part a user pipes. Diagnostics go to the logger. */
  output: (text: string) => void;
  assets: AssetPaths;
  allowRepoCode: boolean;
  allowPartialLocal: boolean;
  format: OutputFormat;
  maxTokens: number | undefined;
  /** fleet only: extract each repo live instead of reading its committed manifests. */
  scan: boolean;
  /** Positionals after the command name. */
  args: string[];
  out: string | undefined;
}

/**
 * Typed against the registry, so adding a command without a handler is a
 * compile error rather than something a user discovers as "unknown command".
 */
const HANDLERS: Record<CommandName, (ctx: CommandContext) => void | Promise<void>> = {
  extract: async ({ repoRoot, writer, generator, options, logger, allowRepoCode, allowPartialLocal }) => {
    await runExtract(repoRoot, writer, { generator, logger, options, allowRepoCode, allowPartialLocal });
  },
  ingest: ({ repoRoot, writer, args, logger }) => runIngest(repoRoot, writer, args, logger),
  map: ({ repoRoot, writer, generator, options, logger }) =>
    runMap(repoRoot, writer, deriveContextFor(generator, options), undefined, logger),
  diff: ({ repoRoot, writer, generator, options, logger }) =>
    runDiff(repoRoot, writer, deriveContextFor(generator, options), logger),
  render: ({ repoRoot, writer, options }) => runRender(repoRoot, writer, options),
  all: async ({ repoRoot, writer, generator, options, logger, allowRepoCode, allowPartialLocal }) => {
    const deriveContext = deriveContextFor(generator, options);
    const extracted = await runExtract(repoRoot, writer, {
      generator,
      logger,
      options,
      allowRepoCode,
      allowPartialLocal,
    });
    runMap(repoRoot, writer, deriveContext, extracted, logger);
    runDiff(repoRoot, writer, deriveContext, logger);
    runRender(repoRoot, writer, options);
  },
  validate: ({ repoRoot, logger }) => runValidate(repoRoot, logger),
  show: async (ctx) => {
    ctx.output(renderShowCommand(await inventoryFor(ctx), ctx.options, ctx.format));
  },
  digest: async (ctx) => {
    const digestOptions =
      ctx.maxTokens === undefined ? ctx.options.digest : { ...ctx.options.digest, maxTokens: ctx.maxTokens };
    ctx.output(renderDigestCommand(await inventoryFor(ctx), digestOptions, ctx.format));
  },
  doctor: async (ctx) => {
    ctx.output(renderDoctorCommand(await inventoryFor(ctx), ctx.format));
  },
  explain: async (ctx) => {
    ctx.output(renderExplainCommand(await inventoryFor(ctx), ctx.args[0], ctx.format));
  },
  bundle: async (ctx) => {
    ctx.output(renderBundleCommand(await inventoryFor(ctx), ctx.assets, ctx.options));
  },
  "check-fresh": async ({ repoRoot, allowRepoCode, generator, options, logger }) =>
    runCheckFresh(repoRoot, allowRepoCode, generator, options, logger),
  init: ({ repoRoot, writer, assets }) => runInit(repoRoot, writer, assets),
  fleet: async ({ writer, args, out, generator, options, logger, allowRepoCode, scan }) => {
    const outDir = resolve(out ?? process.cwd());
    let fleetRepos = args;
    let fleetName = basename(outDir);
    if (fleetRepos.length === 0 && existsSync(resolve(FLEET_ROSTER_FILE))) {
      const roster = JSON.parse(readFileSync(resolve(FLEET_ROSTER_FILE), "utf8")) as { name?: string; repos: string[] };
      fleetRepos = roster.repos;
      if (roster.name !== undefined && roster.name !== "") fleetName = roster.name;
      logger.info(`  (roster from ${FLEET_ROSTER_FILE}: ${fleetRepos.length} repos)`);
    }
    const scanned = scan ? await scanFleetRepos(fleetRepos, generator, options, allowRepoCode, logger) : undefined;
    runFleet(fleetName, fleetRepos, outDir, writer, deriveContextFor(generator, options), options, logger, scanned);
  },
};

function inventoryFor(ctx: CommandContext) {
  return loadInventory({
    repoRoot: ctx.repoRoot,
    generator: ctx.generator,
    options: ctx.options,
    allowRepoCode: ctx.allowRepoCode,
  });
}

/** Run one command by name. Stages output into ctx.writer; the caller commits on success. */
export async function runCommand(command: CommandName, ctx: CommandContext): Promise<void> {
  await HANDLERS[command](ctx);
}
