/**
 * product-map's own extractor.
 *
 * The pmap CLI dispatches from a typed handler table rather than a
 * `src/commands/` directory, so the generic cli-commands adapter cannot see
 * its commands and the repo's own map under-reported them. The authoritative
 * list is the registry in packages/engine/src/registry.ts — the same object
 * that renders `--help` and types dispatch — so this reads it directly and
 * emits one command capability per entry, bound to the CLI surface.
 *
 * Contract: print one JSON object to stdout, log nothing else there. Output
 * must be deterministic for a given commit; it participates in check-fresh.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.argv[2] ?? process.cwd();
const REGISTRY = "packages/engine/src/registry.ts";
const CLI_SURFACE = "surface:cli:pmap";
const CLI_PACKAGE = "packages/pmap";

/**
 * Each registry entry is `name: { args: "...", summary: "..." }`. Matching the
 * summary within a brace-free span keeps the pattern anchored to one entry, so
 * a malformed registry yields no commands rather than a scrambled pairing.
 */
function readCommands() {
  const source = readFileSync(join(repoRoot, REGISTRY), "utf8");
  const entries = [];
  for (const match of source.matchAll(/\n {2}"?([a-z][a-z0-9-]*)"?:\s*\{[^}]*?summary:\s*"((?:[^"\\]|\\.)*)"/g)) {
    entries.push({ name: match[1], summary: JSON.parse(`"${match[2]}"`) });
  }
  return entries.sort((a, b) => (a.name < b.name ? -1 : 1));
}

const commands = readCommands();
if (commands.length === 0) {
  // Loud rather than quiet: a silent empty result would look like a CLI with
  // no commands, which is exactly the failure this extractor exists to fix.
  throw new Error(`no commands parsed from ${REGISTRY} — has the registry's shape changed?`);
}

const provenance = { source: REGISTRY, evidence: [REGISTRY, `${CLI_PACKAGE}/src/cli.ts`], confidence: "high" };

const capabilities = commands.map(({ name, summary }) => ({
  id: `cap:command:pmap.${name}`,
  kind: "command",
  name: `pmap ${name}`,
  surfaceArea: "cli",
  status: "live",
  reach: "external",
  purpose: summary,
  placement: { current: CLI_PACKAGE, verdict: "correct" },
  provenance,
}));

// Same id as the generic bins/root-script adapters produce, which is what
// makes this supersede them instead of duplicating the surface.
const surfaces = [
  {
    id: CLI_SURFACE,
    surfaceType: "cli",
    name: "pmap CLI",
    entry: { kind: "bin", value: "pmap" },
    purpose:
      "Extract, validate, map, diff, render, and freshness-check product-map.v1 manifests for a repository, and ingest planned manifests returned by a design process.",
    audience: ["developer", "agent"],
    status: "live",
    binds: capabilities.map((capability) => ({
      capabilityId: capability.id,
      via: "explicit",
      note: "declared in the pmap command registry",
    })),
    placement: { current: CLI_PACKAGE, verdict: "correct" },
    provenance,
  },
  // The composite Action shells out to the CLI, so its binding lives in
  // action.yml's run block. No convention can see across that boundary, which
  // is exactly what a repo-local extractor is for.
  {
    id: "surface:github-action:product-map-freshness",
    surfaceType: "github-action",
    name: "product-map freshness Action",
    entry: { kind: "config-file", value: "integrations/github-action/action.yml" },
    purpose: "Run `pmap check-fresh` as a CI gate so a stale product map fails the build.",
    audience: ["developer"],
    status: "live",
    binds: ["check-fresh", "validate"]
      .filter((name) => commands.some((command) => command.name === name))
      .map((name) => ({
        capabilityId: `cap:command:pmap.${name}`,
        via: "explicit",
        note: "invoked by the Action's run block",
      })),
    placement: { current: "integrations/github-action", verdict: "correct" },
    provenance: {
      source: "integrations/github-action/action.yml",
      evidence: ["integrations/github-action/action.yml"],
      confidence: "high",
    },
  },
];

process.stdout.write(
  JSON.stringify({ surfaces, capabilities, sources: [REGISTRY, "integrations/github-action/action.yml"] }),
);
