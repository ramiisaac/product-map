import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const scriptsRoot = resolve(dirname(fileURLToPath(import.meta.url)));
export const repoRoot = resolve(scriptsRoot, "..", "..");
/** Pinned checkouts of the public source repositories. Gitignored: reproducible, never committed. */
export const fixturesRoot = join(repoRoot, "fixtures");
/** Committed snapshots, one directory per example. */
export const examplesRoot = join(repoRoot, "examples");

export const sources = JSON.parse(readFileSync(join(scriptsRoot, "sources.json"), "utf8"));

/** Provenance file inside each snapshot. Not a manifest, so manifest collection must exclude it. */
export const SOURCE_METADATA = "source.json";

export function fixtureDir(source) {
  return join(fixturesRoot, source.name);
}

export function snapshotDir(source) {
  return join(examplesRoot, source.name);
}

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "inherit",
  });
}
