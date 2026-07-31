import type { Adapter } from "../types";

import { out, pkgName, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** workers: worker/daemon apps are service capabilities. */
export const workersAdapter: Adapter = {
  name: "workers",
  detect: (ctx) =>
    ctx.packages.some(
      (p) => /worker|daemon|scheduler|webhooks?$|sandbox|(^|\/)edge(\/|$)/.test(p.dir) && p.dir.startsWith("apps"),
    ),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!pkg.dir.startsWith("apps") || !/worker|daemon|scheduler|webhooks?$|sandbox|(^|\/)edge(\/|$)/.test(pkg.dir))
        continue;
      result.sources.push(`${pkg.dir}/package.json`);
      result.capabilities.push({
        id: `cap:service:${slugify(pkgName(pkg))}`,
        kind: "service",
        name: pkgName(pkg),
        surfaceArea: "worker",
        status: "live",
        reach: DEFAULT_REACH["service"],
        placement: { current: pkg.dir, verdict: "correct" },
        provenance: prov(`${pkg.dir}/package.json`, [`${pkg.dir}/package.json`], "high"),
      });
    }
    return result;
  },
};
