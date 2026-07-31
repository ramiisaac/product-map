import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { out, pkgName, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** desktop: Tauri and Electron apps. */
export const desktopAdapter: Adapter = {
  name: "desktop",
  detect: (ctx) =>
    ctx.packages.some((p) => ctx.exists(`${p.dir}/src-tauri/tauri.conf.json`) || depOf(p.manifest, "electron")),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      const tauriConf = `${pkg.dir}/src-tauri/tauri.conf.json`;
      const isTauri = ctx.exists(tauriConf);
      const isElectron = depOf(pkg.manifest, "electron");
      if (!isTauri && !isElectron) continue;
      const evidence = isTauri ? tauriConf : `${pkg.dir}/package.json`;
      result.sources.push(evidence);
      result.surfaces.push({
        id: `surface:desktop:${slugify(pkg.dir.replace(/^apps\//, "") || pkgName(pkg))}`,
        surfaceType: "desktop",
        name: `${pkgName(pkg)} desktop app`,
        entry: { kind: "extension-point", value: evidence },
        purpose: `${isTauri ? "Tauri" : "Electron"} desktop application at ${pkg.dir}.`,
        audience: ["end-user", "developer"],
        status: "live",
        binds: [],
        placement: { current: pkg.dir, verdict: "correct" },
        provenance: prov(evidence, [evidence], "high"),
      });
    }
    return result;
  },
};
