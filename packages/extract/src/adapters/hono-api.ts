import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { CODE_FILE, NOISE_STEM, out, pkgName, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** hono-api: packages depending on hono expose route capabilities from src/routes. */
export const honoAdapter: Adapter = {
  name: "hono-api",
  detect: (ctx) => ctx.packages.some((p) => depOf(p.manifest, "hono")),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!depOf(pkg.manifest, "hono") || pkg.dir === "") continue;
      const routesDir = ["src/routes", "src/router"].find((d) => ctx.exists(`${pkg.dir}/${d}`));
      const name = slugify(pkgName(pkg));
      if (routesDir !== undefined) {
        const scope = `${pkg.dir}/${routesDir}`;
        result.sources.push(scope);
        // routes are files at ANY depth; nested dirs (routes/webhooks/x.ts) name by path
        const routeNames = new Set<string>();
        for (const file of ctx.listFiles(scope, 4)) {
          if (!CODE_FILE.test(file) || file.includes("__tests__") || /\.(test|spec)\./.test(file)) continue;
          const rel = file.slice(scope.length + 1).replace(CODE_FILE, "");
          const stem = rel
            .split("/")
            .filter((seg) => seg !== "index")
            .join("-");
          if (stem === "" || NOISE_STEM.test(stem)) continue;
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
      } else if (pkg.dir.startsWith("apps/")) {
        // an app depending on hono with no routes dir is still a deployed service;
        // library packages with a hono dep are NOT (auth-helpers false positive)
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
