import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { out, pkgName, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** tui: ink/clack packages — or apps literally named tui — are terminal UI surfaces. */
export const tuiAdapter: Adapter = {
  name: "tui",
  detect: (ctx) =>
    ctx.packages.some(
      (p) => depOf(p.manifest, "ink") || depOf(p.manifest, "@clack/prompts") || /^apps\/.*(^|\/)tui$/.test(p.dir),
    ),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      const ink = depOf(pkg.manifest, "ink");
      const clack = depOf(pkg.manifest, "@clack/prompts");
      // dedicated TUI app dirs count even when the prompt library arrives
      // through an internal wrapper package rather than a direct dependency
      const namedTui = /^apps\/.*(^|\/)tui$/.test(pkg.dir);
      if ((!ink && !clack && !namedTui) || pkg.dir === "" || pkg.dir.startsWith("config")) continue;
      // only app-level or application-layer packages count as TUI surfaces
      if (!/(^apps\/|\/tui$|\/tui\/|tui-)/.test(`${pkg.dir}/`)) continue;
      // a CLI package that bundles TUI deps is already covered by its cli
      // surface; the dedicated tui package is the TUI surface
      if (pkg.manifest["bin"] !== undefined) continue;
      result.sources.push(`${pkg.dir}/package.json`);
      result.surfaces.push({
        id: `surface:tui:${slugify(pkg.dir.replace(/^apps\//, ""))}`,
        surfaceType: "tui",
        name: `${pkgName(pkg)} terminal UI`,
        entry: { kind: "command", value: pkgName(pkg) },
        purpose: `${ink ? "Ink" : clack ? "@clack/prompts" : "Terminal"} UI in ${pkg.dir}.`,
        audience: ["developer"],
        status: "live",
        binds: [],
        placement: { current: pkg.dir, verdict: "correct" },
        provenance: prov(`${pkg.dir}/package.json`, [`${pkg.dir}/package.json`], ink || clack ? "high" : "medium"),
      });
    }
    return result;
  },
};
