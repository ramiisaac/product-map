import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { slugify } from "@product-map/spec";

/**
 * supabase-functions: Deno edge functions are API route capabilities, and
 * external by construction — deploying one publishes an addressable HTTP
 * endpoint, unlike a route whose distribution depends on where it is served.
 */
export const supabaseFunctionsAdapter: Adapter = {
  name: "supabase-functions",
  detect: (ctx) => ctx.exists("supabase/functions"),
  extract(ctx) {
    const result = out();
    const names = new Set(
      ctx
        .listFiles("supabase/functions", 2)
        .map((f) => f.split("/")[2])
        .filter((n): n is string => n !== undefined && !n.startsWith("_")),
    );
    for (const name of [...names].sort()) {
      if (!ctx.exists(`supabase/functions/${name}/index.ts`) && !ctx.exists(`supabase/functions/${name}/index.js`))
        continue;
      result.sources.push(`supabase/functions/${name}`);
      result.capabilities.push({
        id: `cap:route:edge.${slugify(name)}`,
        kind: "route",
        name: `edge function ${name}`,
        surfaceArea: "api",
        status: "live",
        reach: "external",
        placement: { current: `supabase/functions/${name}`, verdict: "correct" },
        provenance: prov(`supabase/functions/${name}`, [`supabase/functions/${name}`], "high"),
      });
    }
    return result;
  },
};
