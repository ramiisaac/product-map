import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { out, pkgName, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** app-frameworks: Mintlify, Storybook, react-email preview, Prisma Studio — apps without Next app dirs or bins. */
export const appFrameworksAdapter: Adapter = {
  name: "app-frameworks",
  detect: (ctx) =>
    ctx.packages.some(
      (p) =>
        p.dir.startsWith("apps/") &&
        (depOf(p.manifest, "mintlify") ||
          depOf(p.manifest, "storybook") ||
          depOf(p.manifest, "react-email") ||
          /\b(mintlify|storybook|react-email|prisma studio)\b/.test(JSON.stringify(p.manifest["scripts"] ?? {}))),
    ),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!pkg.dir.startsWith("apps/")) continue;
      const scripts = JSON.stringify(pkg.manifest["scripts"] ?? {});
      const kind =
        depOf(pkg.manifest, "mintlify") || scripts.includes("mintlify")
          ? (["docs", "Mintlify docs site"] as const)
          : depOf(pkg.manifest, "storybook") || scripts.includes("storybook")
            ? (["other", "Storybook component gallery"] as const)
            : depOf(pkg.manifest, "react-email") || scripts.includes("react-email") || scripts.includes("email dev")
              ? (["email", "react-email template preview app"] as const)
              : scripts.includes("prisma studio")
                ? (["other", "Prisma Studio database browser"] as const)
                : null;
      if (kind === null) continue;
      const manifestPath = `${pkg.dir}/package.json`;
      result.sources.push(manifestPath);
      result.surfaces.push({
        id: `surface:${kind[0]}:${slugify(pkg.dir.replace(/^apps\//, ""))}`,
        surfaceType: kind[0],
        name: `${pkgName(pkg)} (${kind[1]})`,
        entry: { kind: "generated-artifact", value: pkg.dir },
        purpose: `${kind[1]} at ${pkg.dir}.`,
        audience: ["developer"],
        status: "partial",
        binds: [],
        placement: { current: pkg.dir, verdict: "correct" },
        provenance: prov(manifestPath, [manifestPath], "high"),
      });
    }
    return result;
  },
};
