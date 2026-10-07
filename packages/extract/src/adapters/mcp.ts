import { basename } from "node:path";
import type { Bind, CapabilityItem } from "@product-map/spec";
import type { Adapter } from "../types";
import type { PackageInfo, RepoContext } from "@product-map/discovery";
import { depOf } from "@product-map/discovery";
import {
  CODE_FILE,
  DECLARATION_FILE,
  NOISE_STEM,
  TEST_FILE,
  memberCall,
  moduleSpecifiers,
  out,
  parseModule,
  pkgName,
  prov,
  staticString,
  uniqueSlugs,
  walk,
} from "./shared";
import type { ScriptFile } from "./shared";
import { slugify } from "@product-map/spec";

const SDK_PACKAGES = ["@modelcontextprotocol/sdk", "@modelcontextprotocol/server"];
const SERVER_TOOLS_DIR = "src/mcp/tools";
const TOOL_DIRS = [SERVER_TOOLS_DIR, "src/tools"];
const SCAN_DEPTH = 4;
/**
 * The v1 SDK's `server/` subpath holds the server classes and the transports
 * — except `server/zod-compat`, a schema shim clients import just as often, so
 * matching it would call every consumer of the SDK a server. The v2 SDK ships
 * the server as its own package, `@modelcontextprotocol/server`.
 */
const SERVER_SPECIFIER = /^@modelcontextprotocol\/(?:sdk\/server(?!\/zod-compat)|server)(?:\/|$)/;
const TOOL_REGISTRATIONS = new Set(["registerTool", "tool"]);

const prefixOf = (pkg: PackageInfo): string => (pkg.dir === "" ? "" : `${pkg.dir}/`);

const dependsOnSdk = (pkg: PackageInfo): boolean => SDK_PACKAGES.some((sdk) => depOf(pkg.manifest, sdk));

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

interface ToolRegistrations {
  literal: Array<{ name: string; file: string }>;
  dynamic: boolean;
}

/**
 * `.registerTool(name, ...)` (SDK v1 and v2) and the older `.tool(name, ...)`.
 * A name is literal only when the whole argument is static; anything else, or
 * a module that does not parse, counts as a registration that cannot be read.
 */
function toolRegistrations(sources: ReadonlyArray<{ file: string; parsed: ScriptFile | null }>): ToolRegistrations {
  const registrations: ToolRegistrations = { literal: [], dynamic: false };
  for (const { file, parsed } of sources) {
    if (parsed === null) {
      registrations.dynamic = true;
      continue;
    }
    walk(parsed.program, (node) => {
      const call = memberCall(node);
      if (call === null || !TOOL_REGISTRATIONS.has(call.method) || call.args.length === 0) return;
      const name = staticString(call.args[0]);
      if (name !== null && name.trim() !== "") registrations.literal.push({ name, file });
      else registrations.dynamic = true;
    });
  }
  return registrations;
}

/**
 * mcp: MCP server packages are agent-facing surfaces, and a surface is minted
 * only on observed server evidence — an `src/mcp/tools` directory, or source
 * that imports a server entrypoint of the v1 or v2 SDK. Depending on the SDK
 * proves nothing: clients, test helpers, and inspectors depend on it too, and
 * a generic `src/tools` directory is as likely an AI SDK tool set. The
 * tools-dir arm carries the case of a server that takes the SDK transitively
 * through a sibling package and so declares no dependency of its own. A
 * package that only calls a server wrapper exported by another workspace
 * package is not itself a server; the wrapper's package is.
 */
export const mcpAdapter: Adapter = {
  name: "mcp",
  detect: (ctx) => ctx.packages.some((p) => dependsOnSdk(p) || ctx.exists(`${prefixOf(p)}${SERVER_TOOLS_DIR}`)),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      const prefix = prefixOf(pkg);
      const hasServerToolsDir = ctx.exists(`${prefix}${SERVER_TOOLS_DIR}`);
      if (!hasServerToolsDir && !dependsOnSdk(pkg)) continue;
      const sources = ownSourceFiles(ctx, pkg).map((file) => ({
        file,
        parsed: parseModule(ctx.read(file) ?? "", file),
      }));
      const importsServer = sources.some(({ parsed }) =>
        parsed === null ? false : moduleSpecifiers(parsed).some((specifier) => SERVER_SPECIFIER.test(specifier)),
      );
      if (!hasServerToolsDir && !importsServer) continue;

      const manifestPath = `${prefix}package.json`;
      result.sources.push(manifestPath);
      const placement = { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" } as const;
      // exact names are the identity: a name registered twice is one tool,
      // while two names that slugify alike stay two tools with distinct ids
      const tools = new Map<string, { file: string; registered: boolean }>();
      const registrations = toolRegistrations(sources);
      for (const { name, file } of registrations.literal) {
        if (!tools.has(name)) tools.set(name, { file, registered: true });
      }
      // a registration whose name cannot be read leaves the tools directory to
      // speak for it: partial coverage must never drop tools
      const toolsDir = toolsDirOf(ctx, pkg);
      if (toolsDir !== undefined && (registrations.dynamic || registrations.literal.length === 0)) {
        for (const file of ctx.listFiles(`${prefix}${toolsDir}`, 2).sort()) {
          if (!CODE_FILE.test(file) || /\.(test|spec)\./.test(file)) continue;
          const rawStem = basename(file).replace(CODE_FILE, "");
          if (!NOISE_STEM.test(slugify(rawStem)) && !tools.has(rawStem))
            tools.set(rawStem, { file, registered: false });
        }
      }

      const owner = slugify(pkgName(pkg));
      const toolBinds: Bind[] = [];
      const entries = [...tools.entries()].map(([name, value]) => ({ key: name, name, value }));
      for (const { name, slug, value: tool } of uniqueSlugs(entries)) {
        const id = `cap:mcp-tool:${owner}.${slug}`;
        const item: CapabilityItem = {
          id,
          kind: "mcp-tool",
          name,
          surfaceArea: "mcp",
          status: "live",
          // the tool belongs to a package the adapter has already proved is
          // an MCP server, and any MCP client that connects to it can call it
          reach: "external",
          placement,
          provenance: prov(tool.file, [tool.file], tool.registered ? "high" : "medium"),
        };
        result.capabilities.push(item);
        toolBinds.push({
          capabilityId: id,
          via: "inferred-high",
          note: tool.registered ? "tool registered by the MCP server package" : "tool module in the MCP server package",
        });
      }
      result.surfaces.push({
        id: `surface:mcp:${slugify(pkgName(pkg))}`,
        surfaceType: "mcp",
        name: `${pkgName(pkg)} MCP server`,
        entry: { kind: "mcp-tool", value: pkgName(pkg) },
        purpose: `MCP server implemented in ${pkg.dir}${toolBinds.length > 0 ? ` (${toolBinds.length} tools)` : ""}.`,
        audience: ["agent"],
        status: "live",
        binds: toolBinds,
        placement,
        provenance: prov(manifestPath, [manifestPath], "high"),
      });
    }
    return result;
  },
};
