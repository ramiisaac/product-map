import type { Bind } from "@product-map/spec";
import type { Adapter } from "../types";

import { hasVscodeEngine, out, pkgName, prov } from "./shared";
import { slugify } from "@product-map/spec";

/**
 * vscode: extension manifests with engines.vscode; contributed commands become
 * bound extension-api capabilities. A contribution is external by construction
 * — it exists to be invoked from the editor UI, outside this repository.
 */
export const vscodeAdapter: Adapter = {
  name: "vscode",
  detect: (ctx) => ctx.packages.some(hasVscodeEngine),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!hasVscodeEngine(pkg)) continue;
      const contributes = pkg.manifest["contributes"] as Record<string, unknown> | undefined;
      const commands = Array.isArray(contributes?.["commands"]) ? (contributes["commands"] as unknown[]) : [];
      const manifestPath = `${pkg.dir}/package.json`;
      result.sources.push(manifestPath);
      const extSlug = slugify(pkgName(pkg));
      const binds: Bind[] = [];
      for (const c of commands.slice(0, 60)) {
        const command = (c as Record<string, unknown>)["command"];
        const title = (c as Record<string, unknown>)["title"];
        if (typeof command !== "string") continue;
        const id = `cap:extension-api:${extSlug}.${slugify(command)}`;
        result.capabilities.push({
          id,
          kind: "extension-api",
          name: typeof title === "string" ? `${command} (${title})` : command,
          surfaceArea: "vscode",
          status: "live",
          reach: "external",
          placement: { current: pkg.dir, verdict: "correct" },
          provenance: prov(manifestPath, [manifestPath], "high"),
        });
        binds.push({ capabilityId: id, via: "explicit", note: "contributes.commands" });
      }
      result.surfaces.push({
        id: `surface:vscode:${extSlug}`,
        surfaceType: "vscode",
        name: `${pkgName(pkg)} VS Code extension`,
        entry: { kind: "extension-point", value: pkgName(pkg) },
        purpose: `VS Code extension at ${pkg.dir} (${commands.length} contributed commands).`,
        audience: ["developer"],
        status: pkg.manifest["private"] === true ? "partial" : "live",
        binds,
        placement: { current: pkg.dir, verdict: "correct" },
        provenance: prov(manifestPath, [manifestPath], "high"),
      });
    }
    return result;
  },
};
