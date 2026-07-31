import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** supabase-migrations: CREATE TABLE statements are entity capabilities (drizzle-independent). */
export const supabaseMigrationsAdapter: Adapter = {
  name: "supabase-migrations",
  detect: (ctx) => ctx.listFiles("supabase/migrations", 1).some((f) => f.endsWith(".sql")),
  extract(ctx) {
    const result = out();
    const tables = new Map<string, string>();
    for (const file of ctx
      .listFiles("supabase/migrations", 1)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const content = ctx.read(file);
      if (content === null) continue;
      for (const match of content.matchAll(
        /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?([a-z0-9_]+)"?\.)?"?([a-z0-9_]+)"?/gi,
      )) {
        const schema = match[1]?.toLowerCase();
        const table = match[2]!.toLowerCase();
        if (["if", "not", "exists", "table"].includes(table)) continue;
        const key = schema !== undefined && schema !== "public" ? `${schema}.${table}` : table;
        if (!tables.has(key)) tables.set(key, file);
      }
    }
    for (const [table, file] of [...tables.entries()].sort()) {
      result.sources.push(file);
      result.capabilities.push({
        id: `cap:entity:supabase.${slugify(table)}`,
        kind: "entity",
        name: table,
        surfaceArea: "db",
        status: "live",
        reach: DEFAULT_REACH["entity"],
        placement: { current: "supabase/migrations", verdict: "correct" },
        provenance: prov(file, [file], "high"),
      });
    }
    return result;
  },
};
