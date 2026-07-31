import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { commandStems, out, pkgName, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** db-schema: drizzle schema modules become entity capabilities. */
export const dbSchemaAdapter: Adapter = {
  name: "db-schema",
  detect: (ctx) => ctx.packages.some((p) => depOf(p.manifest, "drizzle-orm")),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!depOf(pkg.manifest, "drizzle-orm")) continue;
      const schemaDir = ["src/schema", "src/db/schema", "schema"].find((d) => ctx.exists(`${pkg.dir}/${d}`));
      if (schemaDir === undefined) continue;
      const scope = `${pkg.dir}/${schemaDir}`;
      const name = slugify(pkgName(pkg));
      result.sources.push(scope);
      // schema module files that are wiring, not domain entities
      const NON_ENTITY = /^(enums?|relations?|migrations?|infra|core|schema|tables)$/;
      for (const stem of commandStems(ctx.listFiles(scope, 1), scope).filter((st) => !NON_ENTITY.test(st))) {
        result.capabilities.push({
          id: `cap:entity:${slugify(`${name}-${stem}`)}`,
          kind: "entity",
          name: stem,
          surfaceArea: "db",
          status: "live",
          reach: DEFAULT_REACH["entity"],
          placement: { current: pkg.dir, verdict: "correct" },
          provenance: prov(scope, [scope], "medium"),
        });
      }
    }
    return result;
  },
};
