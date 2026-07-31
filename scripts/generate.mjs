#!/usr/bin/env node
/**
 * The single entry point for every generated artifact in this repository.
 *
 * Most steps declare what they would write and this file owns formatting,
 * drift detection, writing, and staging. That split is what lets one registry
 * serve three callers — `pnpm generate`, the lefthook pre-commit hook, and the
 * CI drift gate — so a new generator is wired into all three at once.
 *
 * A step exports exactly one of:
 *
 *   generate() -> [{ path, content }]
 *     Declarative. Paths are relative to the repo root. Preferred.
 *
 *   apply({ check }) -> { changed: string[] }
 *     For artifacts whose own writer already provides atomicity and drift
 *     detection, where reproducing them here would be a weaker second copy.
 *     In check mode the step throws if its output is stale.
 *
 *   node scripts/generate.mjs           write stale artifacts and report
 *   node scripts/generate.mjs --check   exit 1 if any artifact is stale
 *   node scripts/generate.mjs --stage   write, then `git add` what changed
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { format, getFileInfo, resolveConfig } from "prettier";

import agentsMd from "./generate/agents-md.mjs";
import dependencyGraph from "./generate/dependency-graph.mjs";
import examples from "./generate/examples.mjs";
import pluginReferences from "./generate/plugin-references.mjs";
import readmeSamples from "./generate/readme-samples.mjs";
import selfProductMap from "./generate/self-product-map.mjs";
import specSchemas from "./generate/spec-schemas.mjs";
import { fromRoot, repoRoot } from "./generate/lib.mjs";

const STEPS = [agentsMd, dependencyGraph, pluginReferences, readmeSamples, specSchemas, selfProductMap, examples];

const declarativeSteps = STEPS.filter((step) => typeof step.generate === "function");
const managedSteps = STEPS.filter((step) => typeof step.apply === "function");

/**
 * Run generated content through Prettier the same way `pnpm format` would,
 * honouring .prettierignore. The ignore list is load-bearing: canonical JSON
 * manifests and vendored schema copies are fenced there precisely because
 * their bytes are content-hashed, and reformatting them would break freshness
 * checks in every consuming repo.
 */
async function formatContent(absPath, content) {
  const info = await getFileInfo(absPath, { ignorePath: fromRoot(".prettierignore") });
  if (info.ignored || info.inferredParser === null) return content;
  const config = await resolveConfig(absPath);
  return format(content, { ...config, filepath: absPath });
}

async function collect() {
  const byPath = new Map();
  for (const step of declarativeSteps) {
    for (const artifact of await step.generate()) {
      const claimed = byPath.get(artifact.path);
      if (claimed !== undefined) {
        throw new Error(`steps "${claimed.step}" and "${step.name}" both generate ${artifact.path}`);
      }
      const absPath = fromRoot(artifact.path);
      byPath.set(artifact.path, {
        step: step.name,
        path: artifact.path,
        absPath,
        content: await formatContent(absPath, artifact.content),
      });
    }
  }
  return [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const { values } = parseArgs({
  options: { check: { type: "boolean", default: false }, stage: { type: "boolean", default: false } },
});

const artifacts = await collect();
const stale = artifacts.filter(
  (artifact) => !existsSync(artifact.absPath) || readFileSync(artifact.absPath, "utf8") !== artifact.content,
);

if (values.check) {
  const failures = [];
  for (const step of managedSteps) {
    try {
      step.apply({ check: true });
    } catch (error) {
      failures.push(`${step.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (stale.length === 0 && failures.length === 0) {
    console.log(`generate --check: ${artifacts.length} artifacts and ${managedSteps.length} managed steps up to date`);
    process.exit(0);
  }
  console.error("generate --check: stale generated output — run `pnpm generate` and commit the result:");
  for (const artifact of stale) console.error(`  ${artifact.path} (${artifact.step})`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

const written = [];
for (const artifact of stale) {
  mkdirSync(dirname(artifact.absPath), { recursive: true });
  writeFileSync(artifact.absPath, artifact.content, "utf8");
  console.log(`  wrote ${artifact.path}`);
  written.push(artifact.path);
}
for (const step of managedSteps) {
  const { changed } = step.apply({ check: false });
  for (const path of changed) console.log(`  wrote ${path} (${step.name})`);
  written.push(...changed);
}
console.log(`generate: ${written.length} files written across ${STEPS.length} steps`);

if (values.stage && written.length > 0) {
  // AGENTS.md regenerates locally but is gitignored (maintainer-machine
  // guidance); `git add` refuses ignored paths, so staging filters them out
  // instead of crashing the pre-commit hook.
  const stageable = written.filter((path) => {
    try {
      execFileSync("git", ["-C", repoRoot, "check-ignore", "--quiet", "--", path]);
      return false;
    } catch {
      return true;
    }
  });
  if (stageable.length > 0) {
    execFileSync("git", ["-C", repoRoot, "add", "--", ...stageable], { stdio: "inherit" });
  }
}
