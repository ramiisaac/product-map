import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type {
  Adapter,
  CanonicalPlacementRule,
  CapabilityItem,
  DeclaredBind,
  RepoConfig,
  RepoContext,
  SkippedItem,
  SurfaceItem,
} from "@product-map/spec";
import { createPathMatcher } from "@product-map/runtime";

export type { DeclaredBind, RepoConfig };

export const REPO_CONFIG_FILE = "product-map.config.mjs";

const DECLARED_BIND_VIA = "explicit";
const DECLARED_BIND_NOTE = "declared in product-map.config.mjs";
const CONFIG_ADAPTER_LABEL = "config";

/**
 * An explicit path is a user's deliberate choice, so its absence is an error;
 * the conventional file's absence is the common case and yields empty config.
 */
export async function loadRepoConfig(root: string, explicitPath?: string): Promise<RepoConfig> {
  const file = explicitPath ?? join(root, REPO_CONFIG_FILE);
  if (!existsSync(file)) {
    if (explicitPath === undefined) return {};
    throw new Error(`no such config file: ${explicitPath}`);
  }
  const mod = (await import(pathToFileURL(file).href)) as { default?: RepoConfig };
  return mod.default ?? {};
}

/**
 * A misfiring adapter is meant to be a one-line fix, so a name that matches no
 * adapter is an error rather than a silent no-op — the whole reason someone
 * reaches for this field is that their map is already wrong.
 */
export function selectAdapters(adapters: readonly Adapter[], config: RepoConfig): readonly Adapter[] {
  const excluded = config.adapters?.exclude ?? [];
  if (excluded.length === 0) return adapters;
  const known = new Set(adapters.map((adapter) => adapter.name));
  const unknown = excluded.filter((name) => !known.has(name)).sort();
  if (unknown.length > 0) {
    throw new Error(
      `${REPO_CONFIG_FILE}: adapters.exclude names ${unknown.map((name) => `"${name}"`).join(", ")}, which no adapter provides. Known adapters: ${[...known].sort().join(", ")}`,
    );
  }
  const excludedSet = new Set(excluded);
  return adapters.filter((adapter) => !excludedSet.has(adapter.name));
}

/**
 * Hides ignored paths from every adapter rather than filtering their output, so
 * an ignore rule cannot be half-honoured by an adapter that reads a file
 * directly instead of listing the directory it lives in.
 */
export function applyIgnores(ctx: RepoContext, config: RepoConfig): RepoContext {
  const patterns = config.ignore ?? [];
  if (patterns.length === 0) return ctx;
  const ignored = createPathMatcher(patterns);
  return {
    ...ctx,
    packages: ctx.packages.filter((pkg) => !ignored(pkg.dir)),
    read: (relPath) => (ignored(relPath) ? null : ctx.read(relPath)),
    exists: (relPath) => (ignored(relPath) ? false : ctx.exists(relPath)),
    listFiles: (relDir, maxDepth) =>
      ignored(relDir) ? [] : ctx.listFiles(relDir, maxDepth).filter((path) => !ignored(path)),
  };
}

/**
 * Declared bindings are the escape hatch for wiring no convention can reveal.
 * They are applied before the dangling-bind prune so a typo lands in `skipped`
 * with a reason instead of vanishing.
 */
export function applyDeclaredBinds(surfaces: SurfaceItem[], config: RepoConfig, skipped: SkippedItem[]): void {
  const declared = config.binds ?? [];
  if (declared.length === 0) return;
  const byId = new Map(surfaces.map((surface) => [surface.id, surface]));
  for (const bind of declared) {
    const surface = byId.get(bind.surface);
    if (surface === undefined) {
      skipped.push({
        adapter: CONFIG_ADAPTER_LABEL,
        id: bind.surface,
        reason: `${REPO_CONFIG_FILE}: binds entry names a surface that was not extracted`,
      });
      continue;
    }
    if (surface.binds.some((existing) => existing.capabilityId === bind.capability)) continue;
    surface.binds.push({
      capabilityId: bind.capability,
      via: DECLARED_BIND_VIA,
      note: bind.note ?? DECLARED_BIND_NOTE,
    });
  }
}

export function reportDanglingDeclaredBinds(
  config: RepoConfig,
  capabilityIds: ReadonlySet<string>,
  skipped: SkippedItem[],
): void {
  for (const bind of config.binds ?? []) {
    if (capabilityIds.has(bind.capability)) continue;
    skipped.push({
      adapter: CONFIG_ADAPTER_LABEL,
      id: bind.capability,
      reason: `${REPO_CONFIG_FILE}: binds entry for ${bind.surface} names a capability that was not extracted`,
    });
  }
}

/**
 * Compiled up front so a malformed pattern is an error about the config file
 * rather than an anonymous `SyntaxError` from deep inside the item loop — and
 * so it is still an error in a repo that happens to have extracted no items.
 */
function compilePlacementRules(config: RepoConfig): Array<{ rule: CanonicalPlacementRule; where: RegExp }> {
  return (config.canonicalPlacements ?? []).map((rule) => {
    try {
      return { rule, where: new RegExp(rule.where) };
    } catch (error) {
      throw new Error(
        `${REPO_CONFIG_FILE}: canonicalPlacements entry has an invalid \`where\` pattern ${JSON.stringify(rule.where)}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  });
}

/**
 * `consumed` collects the override keys that matched an item. Which keys went
 * unused can only be judged across every kind at once, so the caller owns the
 * set and reports on it after the last pass.
 */
export function applyConfig<T extends SurfaceItem | CapabilityItem>(
  items: T[],
  config: RepoConfig,
  consumed: Set<string> = new Set(),
): T[] {
  const rules = compilePlacementRules(config);
  const overrides = config.overrides ?? {};
  return items.map((item) => {
    let next = item;
    for (const { rule, where } of rules) {
      const kind = "surfaceType" in next ? next.surfaceType : next.kind;
      if (rule.kinds !== undefined && !rule.kinds.includes(kind)) continue;
      if (where.test(next.placement.current) && !next.placement.current.startsWith(rule.canonical)) {
        next = { ...next, placement: { ...next.placement, canonical: rule.canonical, verdict: "misplaced" as const } };
      }
    }
    const override = overrides[next.id];
    if (override !== undefined) {
      consumed.add(next.id);
      next = { ...next, ...override } as T;
    }
    return next;
  });
}

/**
 * An override keyed to an id nothing emits is the same class of mistake as a
 * dangling declared bind, and gets the same loud treatment. A
 * `canonicalPlacements` rule that matches nothing is NOT reported: doctrine may
 * legitimately describe a directory the repo does not have yet.
 */
export function reportUnconsumedOverrides(
  config: RepoConfig,
  consumed: ReadonlySet<string>,
  skipped: SkippedItem[],
): void {
  for (const id of Object.keys(config.overrides ?? {}).sort()) {
    if (consumed.has(id)) continue;
    skipped.push({
      adapter: CONFIG_ADAPTER_LABEL,
      id,
      reason: `${REPO_CONFIG_FILE}: overrides entry names an item that was not extracted`,
    });
  }
}
