import { basename } from "node:path";
import type { Bind } from "@product-map/spec";
import type { Adapter } from "../types";
import type { PackageInfo, RepoContext } from "@product-map/discovery";
import { depOf } from "@product-map/discovery";
import { CODE_FILE, DECLARATION_FILE, NOISE_STEM, out, pkgName, prov } from "./shared";
import { slugify } from "@product-map/spec";

const SDK = "@modelcontextprotocol/sdk";
const TOOL_DIRS = ["src/mcp/tools", "src/tools"];
const SCAN_DEPTH = 4;
/**
 * The SDK's `server/` subpath holds the server classes and the transports —
 * except `server/zod-compat`, a schema shim clients import just as often, so
 * matching it would call every consumer of the SDK a server.
 */
const SERVER_IMPORT = /["']@modelcontextprotocol\/sdk\/server(?!\/zod-compat)/;
const TEST_FILE = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\./;

const prefixOf = (pkg: PackageInfo): string => (pkg.dir === "" ? "" : `${pkg.dir}/`);

const toolsDirOf = (ctx: RepoContext, pkg: PackageInfo): string | undefined =>
  TOOL_DIRS.find((dir) => ctx.exists(`${prefixOf(pkg)}${dir}`));

/**
 * A package's own source, excluding what belongs to a package nested inside it
 * — otherwise a workspace root inherits every child's evidence and mints a
 * duplicate surface for the repository as a whole.
 */
function ownSourceFiles(ctx: RepoContext, pkg: PackageInfo): string[] {
  const prefix = prefixOf(pkg);
  const nested = ctx.packages.filter((other) => other.dir !== pkg.dir && other.dir.startsWith(prefix));
  return ctx
    .listFiles(prefix === "" ? "." : pkg.dir, SCAN_DEPTH)
    .filter((file) => CODE_FILE.test(file) && !DECLARATION_FILE.test(file) && !TEST_FILE.test(file))
    .filter((file) => !nested.some((other) => file.startsWith(`${other.dir}/`)))
    .sort();
}

/**
 * mcp: MCP server packages are agent-facing surfaces, and a surface is minted
 * only on observed server evidence — a tools directory, or source that imports
 * the SDK's server entrypoint. Depending on the SDK proves nothing: clients,
 * test helpers, and inspectors depend on it too. The tools-dir arm carries the
 * case of a server that takes the SDK transitively through a sibling package
 * and so declares no dependency of its own.
 */
const isMcpServerPkg = (ctx: RepoContext, pkg: PackageInfo): boolean =>
  toolsDirOf(ctx, pkg) !== undefined ||
  (depOf(pkg.manifest, SDK) &&
    ownSourceFiles(ctx, pkg).some((file) => {
      const content = ctx.read(file);
      return content !== null && SERVER_IMPORT.test(content);
    }));

export const mcpAdapter: Adapter = {
  name: "mcp",
  detect: (ctx) => ctx.packages.some((p) => depOf(p.manifest, SDK) || toolsDirOf(ctx, p) !== undefined),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!isMcpServerPkg(ctx, pkg)) continue;
      const prefix = prefixOf(pkg);
      const manifestPath = `${prefix}package.json`;
      result.sources.push(manifestPath);
      const toolsDir = toolsDirOf(ctx, pkg);
      const toolBinds: Bind[] = [];
      if (toolsDir !== undefined) {
        const scope = `${prefix}${toolsDir}`;
        for (const file of ctx.listFiles(scope, 2).sort()) {
          if (!CODE_FILE.test(file) || /\.(test|spec)\./.test(file)) continue;
          const stem = slugify(basename(file).replace(CODE_FILE, ""));
          if (NOISE_STEM.test(stem)) continue;
          const id = `cap:mcp-tool:${slugify(pkgName(pkg))}.${stem}`;
          result.capabilities.push({
            id,
            kind: "mcp-tool",
            name: stem,
            surfaceArea: "mcp",
            status: "live",
            // the tool belongs to a package the adapter has already proved is
            // an MCP server, and any MCP client that connects to it can call it
            reach: "external",
            placement: { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" },
            provenance: prov(file, [file], "medium"),
          });
          toolBinds.push({ capabilityId: id, via: "inferred-high", note: "tool module in the MCP server package" });
        }
      }
      result.surfaces.push({
        id: `surface:mcp:${slugify(pkgName(pkg))}`,
        surfaceType: "mcp",
        name: `${pkgName(pkg)} MCP server`,
        entry: { kind: "mcp-tool", value: pkgName(pkg) },
        purpose: `MCP server implemented in ${pkg.dir}${toolBinds.length > 0 ? ` (${toolBinds.length} tool modules)` : ""}.`,
        audience: ["agent"],
        status: "live",
        binds: toolBinds,
        placement: { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" },
        provenance: prov(manifestPath, [manifestPath], "high"),
      });
    }
    return result;
  },
};
