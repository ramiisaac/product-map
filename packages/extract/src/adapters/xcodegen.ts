import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** xcodegen: Apple app targets from project.yml (Swift repos are invisible to npm adapters). */
export const xcodegenAdapter: Adapter = {
  name: "xcodegen",
  detect: (ctx) => ctx.listFiles("apps", 5).some((f) => f.endsWith("project.yml")),
  extract(ctx) {
    const result = out();
    for (const file of ctx.listFiles("apps", 5).filter((f) => f.endsWith("project.yml"))) {
      const content = ctx.read(file);
      if (content === null || !/^targets:/m.test(content)) continue;
      result.sources.push(file);
      const targetsBlock = content.split(/^targets:\s*$/m)[1] ?? "";
      const dir = file.replace(/\/project\.yml$/, "");
      const seenTargets = new Set<string>();
      const targetMatches = [...targetsBlock.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
      for (const [ti, match] of targetMatches.entries()) {
        const target = match[1]!;
        if (seenTargets.has(target)) continue;
        seenTargets.add(target);
        const blockEnd = targetMatches[ti + 1]?.index ?? targetsBlock.length;
        const after = targetsBlock.slice(match.index, blockEnd);
        const platform = after.match(/platform:\s*(\w+)/)?.[1] ?? "unknown";
        if (/type:\s*bundle\.(unit-test|ui-test)/.test(after) || /Tests$/.test(target)) continue;
        const type = platform.toLowerCase() === "macos" ? "macos" : "other";
        result.surfaces.push({
          id: `surface:${type}:${slugify(`${dir.split("/").pop() ?? dir}-${target}`)}`,
          surfaceType: type,
          name: `${target} (${platform})`,
          entry: { kind: "extension-point", value: `${file}#${target}` },
          purpose: `Apple app target ${target} for ${platform}, defined in ${file}.`,
          audience: ["end-user"],
          status: "partial",
          binds: [],
          placement: { current: dir, verdict: "correct" },
          provenance: prov(file, [file], "medium"),
          ext: { "pmap.applePlatform": platform },
        });
      }
    }
    return result;
  },
};
