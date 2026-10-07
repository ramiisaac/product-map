import type {
  Adapter,
  CapabilityItem,
  CapabilityManifest,
  ExtractOptions,
  ExtractResult,
  SurfaceItem,
  SurfaceManifest,
} from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";

import type { RepoContext } from "@product-map/discovery";

import { ADAPTERS } from "./adapters";
import {
  applyConfig,
  applyDeclaredBinds,
  applyIgnores,
  loadRepoConfig,
  reportDanglingDeclaredBinds,
  reportUnconsumedOverrides,
  selectAdapters,
} from "./config";
import { dedupe } from "./dedupe";
import { runLocalExtractor } from "./local-extractor";

/**
 * Template/fixture/example/internal-tooling packages describe scaffolding, not
 * the product.
 *
 * The scaffolding word may be wrapped in underscores or carry a qualifying
 * prefix — `__fixtures__` and `functions-templates` are both extremely common
 * and both slipped through a whole-segment match, which reported test
 * fixtures and function templates as product capabilities.
 * Only a suffix match is accepted, so `templates-engine` stays a product.
 */
const NON_PRODUCT_DIR =
  /(^|\/)(?:_{1,2})?(?:[a-z0-9]+[-_])*(templates?|fixtures?|examples?|tests?|generators?|sandbox|demos?|tooling|vendored?|third[-_]?party)(?:_{1,2})?(\/|$)|(^|\/)_(\/|$)/;
// vendored-tree names that are also legitimate product words deeper in a repo;
// exclude these only at the repo root, where they always mean vendored copies
const ROOT_ONLY_NON_PRODUCT = /^(archives?|reference|backups?)(\/|$)/;

export async function extractRepo(
  rawCtx: RepoContext,
  options: ExtractOptions,
  adapters: readonly Adapter[] = ADAPTERS,
): Promise<ExtractResult> {
  const allowRepoCode = options.allowRepoCode ?? true;
  const config = options.config ?? (allowRepoCode ? await loadRepoConfig(rawCtx.root) : {});
  const extraNonProduct = config.nonProductDirs ?? [];
  const isNonProduct = (dir: string) =>
    NON_PRODUCT_DIR.test(dir) ||
    ROOT_ONLY_NON_PRODUCT.test(dir) ||
    extraNonProduct.some((seg) => dir.split("/").includes(seg));
  const ctx: RepoContext = applyIgnores(
    {
      ...rawCtx,
      repoName: config.repoName ?? rawCtx.repoName,
      packages: rawCtx.packages.filter((p) => !isNonProduct(p.dir)),
    },
    config,
  );
  const surfaceEntries: Array<{ adapter: string; item: SurfaceItem }> = [];
  const capabilityEntries: Array<{ adapter: string; item: CapabilityItem }> = [];
  const sources = new Set<string>();
  const adaptersRun: string[] = [];
  const skipped: ExtractResult["skipped"] = [];

  // One adapter tripping on an unusual repo layout must not take extraction
  // down for a consumer who cannot fix that adapter: the failure is recorded
  // for doctor and the rest still run. Only the local extractor fails closed.
  const adapterIssues: ExtractResult["adapterIssues"] = [];
  for (const adapter of selectAdapters(adapters, config)) {
    try {
      if (!adapter.detect(ctx)) continue;
      const output = adapter.extract(ctx);
      adaptersRun.push(adapter.name);
      for (const item of output.surfaces) surfaceEntries.push({ adapter: adapter.name, item });
      for (const item of output.capabilities) capabilityEntries.push({ adapter: adapter.name, item });
      for (const source of output.sources) sources.add(source);
    } catch (error) {
      adapterIssues.push({ adapter: adapter.name, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const localIssues: string[] = [];
  const local = allowRepoCode ? runLocalExtractor(rawCtx, localIssues, options.localExtractor) : null;
  if (local !== null) {
    adaptersRun.push("local");
    for (const item of local.surfaces) surfaceEntries.push({ adapter: "local", item });
    for (const item of local.capabilities) capabilityEntries.push({ adapter: "local", item });
    for (const source of local.sources) sources.add(source);
  }

  const consumedOverrides = new Set<string>();
  const surfaceItems = applyConfig(dedupe(surfaceEntries, skipped), config, consumedOverrides);
  const capabilityItems = applyConfig(dedupe(capabilityEntries, skipped), config, consumedOverrides);
  reportUnconsumedOverrides(config, consumedOverrides, skipped);
  // Implicit binds are judged against the final, post-override status, and are
  // pruned before declared binds are applied: a declaration is skipped when a
  // bind to the same capability already exists, so pruning afterwards would
  // silently drop an explicit bind that should surface as a bound-conflict.
  const absentCapabilityIds = new Set(capabilityItems.filter((c) => c.status === "absent").map((c) => c.id));
  for (const surface of surfaceItems) {
    surface.binds = surface.binds.filter((b) => b.via !== "inferred-high" || !absentCapabilityIds.has(b.capabilityId));
  }
  applyDeclaredBinds(surfaceItems, config, skipped);
  // drop binds that reference capabilities we did not extract (never assert dangling ids)
  const capabilityIds = new Set(capabilityItems.map((c) => c.id));
  reportDanglingDeclaredBinds(config, capabilityIds, skipped);
  for (const surface of surfaceItems) {
    surface.binds = surface.binds.filter((b) => capabilityIds.has(b.capabilityId));
  }
  // containment bindings: a route capability living inside an app surface's
  // directory belongs to that surface; a package capability extracted from
  // the same package.json as a bin surface backs that bin. These are
  // mechanical facts, not guesses — without them every map drowned in
  // false orphan/unbound rows. A capability whose final status is absent
  // backs nothing, so it is never inferred into a binding.
  for (const surface of surfaceItems) {
    const dir = surface.placement.current;
    if (dir === "." || dir === "") continue;
    const bound = new Set(surface.binds.map((b) => b.capabilityId));
    for (const cap of capabilityItems) {
      if (bound.has(cap.id) || absentCapabilityIds.has(cap.id)) continue;
      const capDir = cap.placement.current;
      const sameDir = capDir === dir || capDir.startsWith(`${dir}/`);
      if (!sameDir) continue;
      if (
        cap.kind === "route" &&
        (surface.surfaceType === "dashboard" ||
          surface.surfaceType === "docs" ||
          surface.surfaceType === "marketing" ||
          surface.surfaceType === "admin" ||
          surface.surfaceType === "playground" ||
          surface.surfaceType === "other")
      ) {
        surface.binds.push({ capabilityId: cap.id, via: "inferred-high", note: "route handler inside this app" });
      } else if (cap.kind === "package" && surface.surfaceType === "cli" && capDir === dir) {
        surface.binds.push({ capabilityId: cap.id, via: "inferred-high", note: "bin declared by this package" });
      }
    }
    // a per-command bin (tool-render) binds its command (tool.render)
    if (surface.surfaceType === "cli") {
      const binName = surface.entry.value;
      const dash = binName.indexOf("-");
      if (dash > 0) {
        const candidate = `cap:command:${binName.slice(0, dash)}.${binName.slice(dash + 1)}`;
        if (
          capabilityIds.has(candidate) &&
          !absentCapabilityIds.has(candidate) &&
          !surface.binds.some((b) => b.capabilityId === candidate)
        ) {
          surface.binds.push({ capabilityId: candidate, via: "inferred-high", note: "dedicated bin for this command" });
        }
      }
    }
    surface.binds.sort((a, b) => (a.capabilityId < b.capabilityId ? -1 : 1));
  }

  const generatedFrom = {
    commit: ctx.commit,
    workingTree: ctx.workingTree,
    sources: [...sources].sort(),
  };

  const surfaces = finalizeManifest<SurfaceManifest>({
    schemaVersion: "product-map.v1",
    kind: "surface",
    stance: "existing",
    scope: ctx.repoName,
    generatedFrom,
    generator: options.generator,
    items: surfaceItems,
  });
  const capabilities = finalizeManifest<CapabilityManifest>({
    schemaVersion: "product-map.v1",
    kind: "capability",
    stance: "existing",
    scope: ctx.repoName,
    generatedFrom,
    generator: options.generator,
    items: capabilityItems,
  });

  return { surfaces, capabilities, adaptersRun, skipped, localIssues, adapterIssues };
}

export type { ExtractOptions, ExtractResult };
