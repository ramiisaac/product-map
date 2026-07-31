import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { CODE_FILE, NOISE_STEM, out, pkgName, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** trpc-routers: code-registered tRPC routers are the API in tRPC repos — file-per-router approximation. */
export const trpcRoutersAdapter: Adapter = {
  name: "trpc-routers",
  detect: (ctx) =>
    ctx.packages.some(
      (p) => ctx.exists(`${p.dir}/src/routers`) && (depOf(p.manifest, "@trpc/server") || pkgName(p).includes("api")),
    ),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!ctx.exists(`${pkg.dir}/src/routers`)) continue;
      if (!depOf(pkg.manifest, "@trpc/server") && !pkgName(pkg).includes("api")) continue;
      const scope = `${pkg.dir}/src/routers`;
      result.sources.push(scope);
      const seen = new Set<string>();
      for (const file of ctx.listFiles(scope, 3).sort()) {
        if (!CODE_FILE.test(file) || /\.(test|spec)\./.test(file) || file.includes("__tests__")) continue;
        const rel = file.slice(scope.length + 1).replace(CODE_FILE, "");
        const stem = slugify(
          rel
            .split("/")
            .filter((seg) => seg !== "index")
            .join("-"),
        );
        if (stem === "" || NOISE_STEM.test(stem) || seen.has(stem)) continue;
        seen.add(stem);
        result.capabilities.push({
          id: `cap:query:trpc.${stem}`,
          kind: "query",
          name: `tRPC router: ${stem}`,
          surfaceArea: "api",
          status: "live",
          reach: DEFAULT_REACH["query"],
          placement: { current: pkg.dir, verdict: "correct" },
          provenance: prov(file, [file], "medium"),
        });
      }
    }
    return result;
  },
};
