import { basename } from "node:path";
import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** github-action: any action.yml outside node_modules is a CI surface. */
export const githubActionAdapter: Adapter = {
  name: "github-action",
  detect: (ctx) => ctx.exists("action.yml") || ctx.listFiles(".", 4).some((f) => f.endsWith("/action.yml")),
  extract(ctx) {
    const result = out();
    const files = [
      ...(ctx.exists("action.yml") ? ["action.yml"] : []),
      ...ctx.listFiles(".", 4).filter((f) => f.endsWith("/action.yml")),
    ];
    for (const file of [...new Set(files)].sort()) {
      const content = ctx.read(file);
      const nameMatch = content?.match(/^name:\s*["']?(.+?)["']?\s*$/m);
      const slug =
        nameMatch?.[1] !== undefined
          ? slugify(nameMatch[1])
          : file === "action.yml"
            ? "root"
            : slugify(basename(file.replace(/\/action\.yml$/, "")));
      result.sources.push(file);
      result.surfaces.push({
        id: `surface:github-action:${slug}`,
        surfaceType: "github-action",
        name: nameMatch?.[1] ?? "GitHub Action",
        entry: { kind: "extension-point", value: file },
        purpose: `GitHub Action defined at ${file}.`,
        audience: ["ci"],
        status: "live",
        binds: [],
        placement: { current: file, verdict: "correct" },
        provenance: prov(file, [file], "high"),
      });
    }
    return result;
  },
};
