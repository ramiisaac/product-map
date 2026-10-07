import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import {
  CODE_FILE,
  NOISE_STEM,
  isNode,
  memberCall,
  out,
  parseModule,
  pkgName,
  prov,
  staticString,
  walk,
} from "./shared";
import type { NodeLike } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "all", "on", "route"]);

const isRoutePath = (node: NodeLike | undefined): boolean => {
  const path = staticString(node);
  return path !== null && (path.startsWith("/") || path.startsWith("*"));
};

/** A `.on()` method argument: a static method name or an array of them. */
const isMethodArgument = (node: NodeLike | undefined): boolean =>
  staticString(node) !== null ||
  (isNode(node, "ArrayExpression") && node.elements.every((element) => staticString(element) !== null));

/**
 * Whether a module registers a route: `<receiver>.<method>("/path" | "*", ...)`
 * for a Hono routing method, `.on(method, "/path", ...)`, or any
 * `.openapi(...)`. A wholly static path argument is what tells a route from
 * `map.get(key)`; a module that does not parse registers nothing.
 */
function registersRoutes(source: string, file: string): boolean {
  const parsed = parseModule(source, file);
  if (parsed === null) return false;
  let registers = false;
  walk(parsed.program, (node) => {
    const call = registers ? null : memberCall(node);
    if (call === null) return;
    if (call.method === "openapi") registers = true;
    else if (ROUTE_METHODS.has(call.method) && isRoutePath(call.args[0])) registers = true;
    else if (call.method === "on" && isMethodArgument(call.args[0]) && isRoutePath(call.args[1])) registers = true;
  });
  return registers;
}

/**
 * hono-api: packages depending on hono expose route capabilities, one per
 * module under src/routes that actually registers a route. Types, schemas,
 * and handler modules living beside the routes are not routes.
 */
export const honoAdapter: Adapter = {
  name: "hono-api",
  detect: (ctx) => ctx.packages.some((p) => depOf(p.manifest, "hono")),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!depOf(pkg.manifest, "hono") || pkg.dir === "") continue;
      const routesDir = ["src/routes", "src/router"].find((d) => ctx.exists(`${pkg.dir}/${d}`));
      const name = slugify(pkgName(pkg));
      const routeNames = new Set<string>();
      if (routesDir !== undefined) {
        const scope = `${pkg.dir}/${routesDir}`;
        result.sources.push(scope);
        // routes are files at ANY depth; nested dirs (routes/webhooks/x.ts) name by path
        for (const file of ctx.listFiles(scope, 4)) {
          if (!CODE_FILE.test(file) || file.includes("__tests__") || /\.(test|spec)\./.test(file)) continue;
          const rel = file.slice(scope.length + 1).replace(CODE_FILE, "");
          const stem = rel
            .split("/")
            .filter((seg) => seg !== "index")
            .join("-");
          if (stem === "" || NOISE_STEM.test(stem)) continue;
          const content = ctx.read(file);
          if (content === null || !registersRoutes(content, file)) continue;
          routeNames.add(slugify(stem));
        }
        for (const stem of [...routeNames].sort()) {
          result.capabilities.push({
            id: `cap:route:${slugify(`${name}-${stem}`)}`,
            kind: "route",
            name: stem,
            surfaceArea: "api",
            status: "live",
            reach: DEFAULT_REACH["route"],
            placement: { current: pkg.dir, verdict: "correct" },
            provenance: prov(scope, [scope], "medium"),
          });
        }
        if (pkg.dir.startsWith("apps/") && routeNames.size > 0) {
          result.surfaces.push({
            id: `surface:other:${name}-api`,
            surfaceType: "other",
            name: `${pkgName(pkg)} API service`,
            entry: { kind: "route", value: pkg.dir },
            purpose: `Hono API service at ${pkg.dir} (${routeNames.size} route modules).`,
            audience: ["developer", "agent"],
            status: "live",
            binds: [],
            placement: { current: pkg.dir, verdict: "correct" },
            provenance: prov(`${pkg.dir}/package.json`, [`${pkg.dir}/package.json`], "high"),
          });
        }
      }
      if (routeNames.size === 0 && pkg.dir.startsWith("apps/")) {
        // an app depending on hono with no route modules is still a deployed
        // service; library packages with a hono dep are NOT (auth-helpers false positive)
        result.capabilities.push({
          id: `cap:service:${name}`,
          kind: "service",
          name: pkgName(pkg),
          surfaceArea: "api",
          status: "live",
          reach: DEFAULT_REACH["service"],
          placement: { current: pkg.dir, verdict: "correct" },
          provenance: prov(`${pkg.dir}/package.json`, [`${pkg.dir}/package.json`], "medium"),
        });
      }
    }
    return result;
  },
};
