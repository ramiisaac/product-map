import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** root-script-cli: a root script running a workspace cli.ts entrypoint IS the repo's CLI, bin field or not. */
export const rootScriptCliAdapter: Adapter = {
  name: "root-script-cli",
  detect: (ctx) => {
    const scripts = (ctx.packages[0]?.manifest["scripts"] ?? {}) as Record<string, string>;
    return Object.values(scripts).some((v) => /tsx .*\/cli\.(ts|mts|mjs)/.test(v));
  },
  extract(ctx) {
    const result = out();
    const scripts = (ctx.packages[0]?.manifest["scripts"] ?? {}) as Record<string, string>;
    for (const [name, value] of Object.entries(scripts).sort()) {
      const match = value.match(/tsx (?:--\S+ \S+ )?(\S+\/cli\.(?:ts|mts|mjs))/);
      if (match === null) continue;
      // Once the target package declares a bin, the bins adapter owns that CLI
      // and this one would mint a colliding id for the same binary. This
      // adapter exists for the case its own text describes: no bin field yet.
      const packageDir = match[1]?.split("/src/")[0] ?? ".";
      const target = ctx.packages.find((pkg) => pkg.dir === packageDir);
      if (target !== undefined && target.manifest["bin"] !== undefined) continue;
      result.sources.push("package.json");
      result.surfaces.push({
        id: `surface:cli:${slugify(name)}`,
        surfaceType: "cli",
        name: `${name} (root-script CLI)`,
        entry: { kind: "command", value: `pnpm ${name}` },
        purpose: `CLI entrypoint ${match[1]} exposed as the root script \`pnpm ${name}\` (no bin field yet).`,
        audience: ["developer"],
        status: "partial",
        binds: [],
        placement: { current: match[1]!.split("/src/")[0] ?? ".", verdict: "correct" },
        provenance: prov("package.json", ["package.json", match[1]!], "high"),
      });
    }
    return result;
  },
};
