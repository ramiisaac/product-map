import { basename, dirname } from "node:path";
import type { Bind } from "@product-map/spec";
import type { Adapter } from "../types";
import type { RepoContext } from "@product-map/discovery";

import { out, prov } from "./shared";
import { slugify } from "@product-map/spec";

const PLUGIN_MANIFEST = ".claude-plugin/plugin.json";
const MARKETPLACE_MANIFEST = ".claude-plugin/marketplace.json";

/**
 * Minimal front-matter reader for agent-facing Markdown. Only `name` and
 * `description` are consumed, and both are single-line scalars in every
 * Claude Code component format, so a full YAML parser would be a dependency
 * bought for nothing. Unparseable front matter yields an empty record and the
 * caller falls back to the filename.
 */
function frontMatter(content: string | null): Record<string, string> {
  if (content === null || !content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end === -1) return {};
  const fields: Record<string, string> = {};
  for (const line of content.slice(3, end).split("\n")) {
    const match = /^([A-Za-z][\w-]*):\s*(.+)$/.exec(line);
    if (match === null) continue;
    fields[match[1]!] = match[2]!.trim().replace(/^["'](.*)["']$/, "$1");
  }
  return fields;
}

/** Directories that could hold a plugin: the repo root, marketplace entries, and workspace packages. */
function pluginRoots(ctx: RepoContext): string[] {
  const candidates = new Set<string>([""]);
  for (const pkg of ctx.packages) candidates.add(pkg.dir);
  // .claude-plugin is a dot-directory, so the walker never lists it; plugin
  // directories are found by their ordinary files instead and then probed.
  for (const file of ctx.listFiles("plugins", 4)) {
    const parts = file.split("/");
    if (parts.length >= 2) candidates.add(`${parts[0]}/${parts[1]}`);
  }
  return [...candidates].filter((dir) => ctx.exists(dir === "" ? PLUGIN_MANIFEST : `${dir}/${PLUGIN_MANIFEST}`)).sort();
}

function componentFiles(ctx: RepoContext, root: string, subdir: string, leaf: RegExp): string[] {
  const scope = root === "" ? subdir : `${root}/${subdir}`;
  if (!ctx.exists(scope)) return [];
  return ctx
    .listFiles(scope, 3)
    .filter((file) => leaf.test(file.slice(scope.length + 1)))
    .sort();
}

/**
 * claude-plugin: a Claude Code plugin is a distributable surface, and each
 * skill, slash command, and subagent it ships is a capability that surface
 * provides — the same shape the bins and cli-commands adapters give a CLI.
 * Component ids are namespaced by their owning plugin so two plugins shipping
 * a `review` command never collide. A marketplace manifest is a separate
 * registry surface: it distributes plugins rather than providing behavior.
 */
export const claudePluginAdapter: Adapter = {
  name: "claude-plugin",
  detect: (ctx) => ctx.exists(MARKETPLACE_MANIFEST) || pluginRoots(ctx).length > 0,
  extract(ctx) {
    const result = out();

    const marketplaceRaw = ctx.read(MARKETPLACE_MANIFEST);
    if (marketplaceRaw !== null) {
      try {
        const marketplace = JSON.parse(marketplaceRaw) as { name?: string; plugins?: unknown[] };
        const name = typeof marketplace.name === "string" ? marketplace.name : "marketplace";
        const count = Array.isArray(marketplace.plugins) ? marketplace.plugins.length : 0;
        result.sources.push(MARKETPLACE_MANIFEST);
        result.surfaces.push({
          // the id names the repository whose registry this is; the marketplace
          // owner's handle stays in the human-readable name and the manifest
          id: `surface:registry:${slugify(ctx.repoName)}`,
          surfaceType: "registry",
          name: `${name} plugin marketplace`,
          entry: { kind: "config-file", value: MARKETPLACE_MANIFEST },
          purpose: `Claude Code plugin marketplace distributing ${count} plugin${count === 1 ? "" : "s"} from this repository.`,
          audience: ["developer"],
          status: "live",
          binds: [],
          placement: { current: ".", verdict: "correct" },
          provenance: prov(MARKETPLACE_MANIFEST, [MARKETPLACE_MANIFEST], "high"),
        });
      } catch {
        // an unparseable marketplace manifest is not worth failing extraction over
      }
    }

    for (const root of pluginRoots(ctx)) {
      const manifestPath = root === "" ? PLUGIN_MANIFEST : `${root}/${PLUGIN_MANIFEST}`;
      let manifest: { name?: string; description?: string };
      try {
        manifest = JSON.parse(ctx.read(manifestPath) ?? "{}") as { name?: string; description?: string };
      } catch {
        continue;
      }
      const pluginName = typeof manifest.name === "string" ? manifest.name : basename(root) || "plugin";
      const pluginSlug = slugify(pluginName);
      result.sources.push(manifestPath);

      const binds: Bind[] = [];
      const components: Array<{ subdir: string; leaf: RegExp; kind: "agent-skill" | "command" | "agent-subagent" }> = [
        { subdir: "skills", leaf: /^[^/]+\/SKILL\.md$/, kind: "agent-skill" },
        { subdir: "commands", leaf: /\.md$/, kind: "command" },
        { subdir: "agents", leaf: /^[^/]+\.md$/, kind: "agent-subagent" },
      ];
      for (const { subdir, leaf, kind } of components) {
        const files = componentFiles(ctx, root, subdir, leaf);
        if (files.length > 0) result.sources.push(root === "" ? subdir : `${root}/${subdir}`);
        for (const file of files) {
          const fields = frontMatter(ctx.read(file));
          const declared = fields["name"];
          const fallback = subdir === "skills" ? basename(dirname(file)) : basename(file).replace(/\.md$/, "");
          const componentName = declared === undefined || declared === "" ? fallback : declared;
          const id = `cap:${kind}:${pluginSlug}.${slugify(componentName)}`;
          if (result.capabilities.some((capability) => capability.id === id)) continue;
          binds.push({ capabilityId: id, via: "explicit", note: `shipped by the ${pluginName} plugin` });
          result.capabilities.push({
            id,
            kind,
            name: componentName,
            surfaceArea: "agent",
            status: "live",
            // a component is shipped by the plugin, and installing the plugin
            // is what makes it reachable, so the plugin manifest IS the evidence
            reach: "external",
            ...(fields["description"] === undefined ? {} : { purpose: fields["description"] }),
            placement: { current: root === "" ? "." : root, verdict: "correct" },
            provenance: prov(file, [file], "high"),
          });
        }
      }

      result.surfaces.push({
        id: `surface:agent-plugin:${pluginSlug}`,
        surfaceType: "agent-plugin",
        name: `${pluginName} plugin`,
        entry: { kind: "config-file", value: manifestPath },
        purpose:
          typeof manifest.description === "string" && manifest.description !== ""
            ? manifest.description
            : `Claude Code plugin \`${pluginName}\`.`,
        audience: ["developer", "agent"],
        status: "live",
        binds: binds.sort((a, b) => (a.capabilityId < b.capabilityId ? -1 : 1)),
        placement: { current: root === "" ? "." : root, verdict: "correct" },
        provenance: prov(manifestPath, [manifestPath], "high"),
      });
    }

    return result;
  },
};
