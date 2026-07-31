import type { Adapter } from "../types";

import { commandStems, out, pkgName, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** reporters: reporting packages expose one capability per reporter module. */
export const reportersAdapter: Adapter = {
  name: "reporters",
  detect: (ctx) => ctx.packages.some((p) => /(^|\/)report(ing|ers)?$/.test(p.dir)),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!/(^|\/)report(ing|ers)?$/.test(pkg.dir)) continue;
      const scope = `${pkg.dir}/src`;
      const name = slugify(pkgName(pkg));
      result.sources.push(scope);
      for (const stem of commandStems(ctx.listFiles(scope, 1), scope)) {
        result.capabilities.push({
          id: `cap:reporter:${slugify(`${name}-${stem}`)}`,
          kind: "reporter",
          name: stem,
          surfaceArea: "cli",
          status: "live",
          reach: DEFAULT_REACH["reporter"],
          placement: { current: pkg.dir, verdict: "correct" },
          provenance: prov(scope, [scope], "medium"),
        });
      }
    }
    return result;
  },
};
