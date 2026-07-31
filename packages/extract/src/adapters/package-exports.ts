import type { Adapter } from "../types";

import { out, prov } from "./shared";
import { slugify } from "@product-map/spec";

/** Scopes that are workspace plumbing, never product packages. */
const INTERNAL_SCOPES = /^@(workspace|config|tooling|repo)\//;

/**
 * package-exports: workspace packages are SDK capabilities — for
 * library-first repos they ARE the product. Filtering is by SCOPE, not by
 * the `private` flag: many repos keep product packages private:true until a
 * publish latch flips (scmlayer's staged publisher, agent-kit's changesets
 * gate), and filtering those out hides the product.
 *
 * `private` sets `reach`, never `status`. An unpublished package is mature,
 * shipping code that simply is not distributed, so it stays `status: live`
 * and the map reports it as unbound-but-unreachable rather than as a gap.
 */
interface Candidate {
  dir: string;
  name: string;
  isPrivate: boolean;
  description: string;
  subpaths: number;
}

function outranks(candidate: Candidate, holder: Candidate): boolean {
  if (candidate.isPrivate !== holder.isPrivate) return !candidate.isPrivate;
  return candidate.dir < holder.dir;
}

export const packageExportsAdapter: Adapter = {
  name: "package-exports",
  detect: (ctx) => ctx.packages.some((p) => p.dir !== "" && typeof p.manifest["name"] === "string"),
  extract(ctx) {
    const result = out();
    const candidates: Candidate[] = [];
    for (const pkg of ctx.packages) {
      if (pkg.dir === "" || pkg.dir.startsWith("config")) continue;
      const name = pkg.manifest["name"];
      if (typeof name !== "string" || INTERNAL_SCOPES.test(name)) continue;
      // apps are surfaces, not SDK packages; unscoped unnamed dirs are noise
      if (pkg.dir.startsWith("apps/") && pkg.manifest["bin"] === undefined) continue;
      const exportsField = pkg.manifest["exports"];
      candidates.push({
        dir: pkg.dir,
        name,
        isPrivate: pkg.manifest["private"] === true,
        description: typeof pkg.manifest["description"] === "string" ? (pkg.manifest["description"] as string) : "",
        subpaths:
          exportsField !== null && typeof exportsField === "object"
            ? Object.keys(exportsField as Record<string, unknown>).length
            : 0,
      });
      result.sources.push(`${pkg.dir}/package.json`);
    }

    // Different packages sharing a short name must not collide into one id
    // (open-designer's v1..v4 trees shadowed 27 packages incl. the live SDK).
    // The short id is assigned after the whole crawl rather than to whoever
    // arrives first, so the winner does not depend on encounter order: a
    // public (publishable) package outranks a private one — the live SDK must
    // never carry the suffixed name — and among equals the lexicographically
    // smallest directory keeps it.
    const shortIdHolder = new Map<string, Candidate>();
    for (const candidate of candidates) {
      const slug = slugify(candidate.name);
      const holder = shortIdHolder.get(slug);
      if (holder === undefined || outranks(candidate, holder)) shortIdHolder.set(slug, candidate);
    }

    for (const candidate of candidates) {
      const { dir, name, isPrivate, description, subpaths } = candidate;
      const manifestPath = `${dir}/package.json`;
      const slug = slugify(name);
      const capId =
        shortIdHolder.get(slug)?.dir === dir
          ? `cap:package:${slug}`
          : `cap:package:${slugify(`${name}-${dir.split("/").slice(-2).join("-")}`)}`;
      const ext = {
        ...(subpaths > 0 ? { "pmap.exportSubpaths": subpaths } : {}),
        ...(isPrivate ? { "pmap.private": true } : {}),
      };
      result.capabilities.push({
        id: capId,
        kind: "package",
        name,
        surfaceArea: "sdk",
        status: "live",
        reach: isPrivate ? "internal" : "external",
        ...(description !== "" ? { purpose: description } : {}),
        placement: { current: dir, verdict: "correct" },
        provenance: prov(manifestPath, [manifestPath], "high"),
        ...(Object.keys(ext).length > 0 ? { ext } : {}),
      });
    }
    return result;
  },
};
