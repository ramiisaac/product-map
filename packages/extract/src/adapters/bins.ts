import type { Adapter } from "../types";
import { out, pkgName, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** bins: every package.json `bin` entry is a CLI distribution surface. */
export const binsAdapter: Adapter = {
  name: "bins",
  detect: (ctx) => ctx.packages.some((p) => p.manifest["bin"] !== undefined),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      const bin = pkg.manifest["bin"];
      if (bin === undefined) continue;
      const entries = typeof bin === "string" ? { [slugify(pkgName(pkg))]: bin } : (bin as Record<string, string>);
      const manifestPath = pkg.dir === "" ? "package.json" : `${pkg.dir}/package.json`;
      result.sources.push(manifestPath);
      for (const [name, target] of Object.entries(entries)) {
        result.surfaces.push({
          id: `surface:cli:${slugify(name)}`,
          surfaceType: "cli",
          name: `${name} CLI`,
          entry: { kind: "bin", value: name },
          purpose: `Command-line entrypoint \`${name}\` from ${pkgName(pkg)}.`,
          audience: ["developer"],
          status: pkg.manifest["private"] === true ? "partial" : "live",
          binds: [],
          placement: { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" },
          provenance: prov(manifestPath, [manifestPath, `${pkg.dir === "" ? "" : `${pkg.dir}/`}${target}`], "high"),
        });
      }
    }
    return result;
  },
};
