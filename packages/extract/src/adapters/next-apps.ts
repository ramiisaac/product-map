import { basename } from "node:path";
import type { SurfaceItem } from "@product-map/spec";
import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { out, pkgName, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

const APP_SURFACE_TYPE: Array<[RegExp, SurfaceItem["surfaceType"]]> = [
  [/docs/, "docs"],
  [/admin/, "admin"],
  [/dashboard/, "dashboard"],
  [/playground|sandbox/, "playground"],
  [/marketing|landing|site/, "marketing"],
  [/telemetry/, "other"],
];

/** next-apps: one surface per Next.js app, with its page routes as views and route handlers as capabilities. */
export const nextAppsAdapter: Adapter = {
  name: "next-apps",
  detect: (ctx) => ctx.packages.some((p) => depOf(p.manifest, "next")),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!depOf(pkg.manifest, "next")) continue;
      // single-package repos: the root package IS the app
      const prefix = pkg.dir === "" ? "" : `${pkg.dir}/`;
      const appDir = ["app", "src/app"].find((d) => ctx.exists(`${prefix}${d}`));
      const pagesDir =
        appDir === undefined ? ["pages", "src/pages"].find((d) => ctx.exists(`${prefix}${d}`)) : undefined;
      const scanDir = appDir ?? pagesDir;
      if (scanDir === undefined) continue;
      const files = ctx.listFiles(`${prefix}${scanDir}`, 8);
      const routes = new Set<string>();
      const handlers: string[] = [];
      for (const file of files) {
        const rel = file.slice(`${prefix}${scanDir}/`.length);
        const stem = basename(rel);
        if (appDir !== undefined) {
          if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(stem)) {
            const route = `/${rel.replace(/\/?page\.\w+$/, "")}`.replace(/\/+$/, "") || "/";
            routes.add(route.replace(/\([^)]*\)\//g, "").replace(/\/\([^)]*\)/g, "") || "/");
          } else if (/^route\.(ts|js)$/.test(stem)) {
            handlers.push(rel.replace(/\/route\.\w+$/, ""));
          }
        } else {
          // pages router: every module IS a route; _app/_document/_error are
          // framework files, pages/api/* are API handlers
          if (!/\.(tsx|ts|jsx|js|mdx)$/.test(rel) || stem.startsWith("_")) continue;
          const path = rel.replace(/\.(tsx|ts|jsx|js|mdx)$/, "").replace(/\/index$/, "");
          if (path === "index") routes.add("/");
          else if (path.startsWith("api/") || path === "api") handlers.push(path.replace(/^api\/?/, "") || "root");
          else routes.add(`/${path}`);
        }
      }
      if (routes.size === 0 && handlers.length === 0) continue;
      const apiOnly = routes.size === 0;
      result.sources.push(`${prefix}${scanDir}`);
      // ids derive from the directory path, not the package's short name:
      // two apps both named "web" (e.g. apps/astwalk/web + apps/fieldguide/web)
      // must never collide into one surface; root packages use the repo name
      const name = slugify(pkg.dir === "" ? ctx.repoName : pkg.dir.replace(/^apps\//, ""));
      const description =
        typeof pkg.manifest["description"] === "string" ? (pkg.manifest["description"] as string) : null;
      const surfaceType =
        APP_SURFACE_TYPE.find(([re]) => re.test(pkg.dir || ctx.repoName) || re.test(name))?.[1] ??
        (description !== null && /\bdoc(s|umentation)\b/i.test(description)
          ? "docs"
          : description !== null && /\b(marketing|landing)\b/i.test(description)
            ? "marketing"
            : "dashboard");
      {
        const finalType = apiOnly ? "other" : surfaceType;
        result.surfaces.push({
          id: `surface:${finalType}:${name}${apiOnly && !name.endsWith("api") ? "-api" : ""}`,
          surfaceType: finalType,
          name: pkgName(pkg),
          entry: { kind: "route", value: "/" },
          purpose: description ?? `Next.js app at ${pkg.dir || "repo root"} (${routes.size} page routes).`,
          audience: ["developer"],
          status: "live",
          views: (() => {
            const sorted = [...routes].sort();
            const shown = sorted
              .slice(0, 40)
              .map((route) => ({ id: slugify(route === "/" ? "home" : route), name: route }));
            if (sorted.length > 40)
              shown.push({ id: "truncated-views", name: `(+${sorted.length - 40} more routes not listed)` });
            return shown;
          })(),
          binds: [],
          placement: { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" },
          provenance: prov(`${prefix}${scanDir}`, [`${prefix}${scanDir}`], "medium"),
        });
      }
      for (const handler of [...new Set(handlers)].sort()) {
        const cleaned = handler
          .replace(/\([^)]*\)\//g, "")
          .replace(/\[\.\.\.([^\]]+)\]/g, "$1-catchall")
          .replace(/\[([^\]]+)\]/g, "$1");
        result.capabilities.push({
          id: `cap:route:${slugify(`${name}-${cleaned === "" ? "root" : cleaned}`)}`,
          kind: "route",
          name: `/${cleaned}`,
          surfaceArea: "api",
          status: "live",
          reach: DEFAULT_REACH["route"],
          placement: { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" },
          provenance: prov(
            `${prefix}${scanDir}${appDir !== undefined ? `/${handler}/route.ts` : `/api/${handler}`}`,
            [`${prefix}${scanDir}/${appDir !== undefined ? handler : `api/${handler}`}`],
            "high",
          ),
        });
      }
    }
    return result;
  },
};
