import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** prisma: schema.prisma models are entity capabilities (parallel to drizzle). */
export const prismaAdapter: Adapter = {
  name: "prisma-schema",
  detect: (ctx) => ctx.packages.some((p) => ctx.exists(`${p.dir === "" ? "" : `${p.dir}/`}prisma/schema.prisma`)),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      const file = `${pkg.dir === "" ? "" : `${pkg.dir}/`}prisma/schema.prisma`;
      if (!ctx.exists(file)) continue;
      const content = ctx.read(file) ?? "";
      result.sources.push(file);
      for (const match of content.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{/gm)) {
        result.capabilities.push({
          id: `cap:entity:prisma.${slugify(match[1]!)}`,
          kind: "entity",
          name: match[1]!,
          surfaceArea: "db",
          status: "live",
          reach: DEFAULT_REACH["entity"],
          placement: { current: pkg.dir === "" ? "prisma" : pkg.dir, verdict: "correct" },
          provenance: prov(file, [file], "high"),
        });
      }
    }
    return result;
  },
};
