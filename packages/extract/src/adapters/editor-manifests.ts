import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** editor-manifests: Zed extension.toml and JetBrains plugin.xml. */
export const editorManifestsAdapter: Adapter = {
  name: "editor-manifests",
  detect: (ctx) => ctx.listFiles("apps", 6).some((f) => f.endsWith("extension.toml") || f.endsWith("plugin.xml")),
  extract(ctx) {
    const result = out();
    const cleanSlug = (file: string): string => {
      const parts = file
        .split("/")
        .filter((s) => !["apps", "editors", "META-INF", "src", "main", "resources"].includes(s));
      return slugify(parts.slice(0, -1).join("-") || parts.join("-"));
    };
    for (const file of ctx.listFiles("apps", 7)) {
      if (file.endsWith("extension.toml")) {
        result.sources.push(file);
        result.surfaces.push({
          id: `surface:zed:${cleanSlug(file)}`,
          surfaceType: "zed",
          name: "Zed extension",
          entry: { kind: "extension-point", value: file },
          purpose: `Zed extension manifest at ${file}.`,
          audience: ["developer"],
          status: "partial",
          binds: [],
          placement: { current: file.split("/").slice(0, -1).join("/"), verdict: "correct" },
          provenance: prov(file, [file], "high"),
        });
      }
      if (file.endsWith("META-INF/plugin.xml")) {
        result.sources.push(file);
        result.surfaces.push({
          id: `surface:jetbrains:${cleanSlug(file)}`,
          surfaceType: "jetbrains",
          name: "JetBrains plugin",
          entry: { kind: "extension-point", value: file },
          purpose: `JetBrains plugin descriptor at ${file}.`,
          audience: ["developer"],
          status: "partial",
          binds: [],
          placement: { current: file.split("/").slice(0, 3).join("/"), verdict: "correct" },
          provenance: prov(file, [file], "high"),
        });
      }
    }
    return result;
  },
};
