import { basename } from "node:path";
import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** spec-yaml: repos whose doctrine is spec-first (YAML specs outrank code) expose specs as capabilities. */
export const specYamlAdapter: Adapter = {
  name: "spec-yaml",
  detect: (ctx) => ctx.listFiles("docs/specs", 4).some((f) => f.endsWith(".yaml") || f.endsWith(".yml")),
  extract(ctx) {
    const result = out();
    for (const file of ctx.listFiles("docs/specs", 4).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))) {
      const stem = basename(file).replace(/\.ya?ml$/, "");
      if (stem.startsWith("_")) continue;
      const content = ctx.read(file) ?? "";
      const title = content.match(/^(?:title|name):\s*["']?(.+?)["']?\s*$/m)?.[1];
      const isFeature = file.includes("/features/");
      result.sources.push(file);
      result.capabilities.push({
        id: `cap:${isFeature ? "action" : "schema"}:spec.${slugify(stem)}`,
        kind: isFeature ? "action" : "schema",
        reach: DEFAULT_REACH[isFeature ? "action" : "schema"],
        name: title ?? stem,
        surfaceArea: "other",
        status: "preview",
        doctrine: [`Normative ${isFeature ? "feature" : ""} spec at ${file}; spec outranks code in this repo.`],
        placement: { current: file, verdict: "correct" },
        provenance: prov(file, [file], "high"),
        ext: { "pmap.specFirst": true },
      });
    }
    return result;
  },
};
