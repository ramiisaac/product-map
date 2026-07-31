/**
 * The command registry — the single source of truth for what `pmap` can do.
 *
 * Help text is rendered from it, dispatch is typed against it (a command
 * without a handler is a compile error), and this repository's own
 * extract.local.mjs reads it so the product map lists the real command set
 * instead of a hand-maintained copy that drifts.
 */
export const COMMAND_GROUPS = {
  look: "LOOK — read-only, writes nothing",
  adopt: "ADOPT & MAINTAIN",
  design: "DESIGN LOOP — bundle sends, ingest receives",
  fleet: "MULTI-REPO",
  primitives: "PRIMITIVES — individual pipeline stages",
} as const;

export type CommandGroup = keyof typeof COMMAND_GROUPS;

export interface CommandSpec {
  /** Positional-argument hint shown in the usage block; empty when the command takes none. */
  args: string;
  group: CommandGroup;
  summary: string;
}

export const COMMANDS = {
  show: {
    args: "",
    group: "look",
    summary: "Print what this repo ships as a terminal table (no committed manifests needed)",
  },
  digest: {
    args: "",
    group: "look",
    summary: "Print a dense, token-budgeted, path-first summary for an agent entering the repo",
  },
  explain: {
    args: "<id>",
    group: "look",
    summary: "Explain one item: which adapter emitted it, from what evidence, at what confidence",
  },
  doctor: {
    args: "",
    group: "look",
    summary: "Report which adapters ran, what was skipped, and what looks suspiciously thin",
  },
  init: {
    args: "",
    group: "adopt",
    summary: "Vendor the prompt templates + JSON Schemas into the repo's product-map directory",
  },
  all: {
    args: "",
    group: "adopt",
    summary: "extract + map + diff + render in one pass",
  },
  "check-fresh": {
    args: "",
    group: "adopt",
    summary: "Regenerate in memory and byte-compare against disk (read-only, exit 1 on drift)",
  },
  validate: {
    args: "",
    group: "adopt",
    summary: "Validate every manifest under docs/reference/product-map/ (read-only)",
  },
  bundle: {
    args: "",
    group: "design",
    summary: "Assemble the repo-reality bundle and design prompt for a Claude Design project",
  },
  ingest: {
    args: "<f..>",
    group: "design",
    summary: "Finalize + validate raw planned manifests (e.g. pasted Claude Design JSON) and write them canonically",
  },
  fleet: {
    args: "<r...>",
    group: "fleet",
    summary: "Roll up several repos into fleet.json + fleet.generated.md in --out (--scan extracts live)",
  },
  extract: {
    args: "",
    group: "primitives",
    summary: "Extract surfaces.existing.json + capabilities.existing.json from the repo",
  },
  map: {
    args: "",
    group: "primitives",
    summary: "Derive maps/ from the manifests on disk",
  },
  diff: {
    args: "",
    group: "primitives",
    summary: "Derive diffs/ (requires planned manifests)",
  },
  render: {
    args: "",
    group: "primitives",
    summary: "Render generated/*.generated.md from the JSON manifests",
  },
} as const satisfies Record<string, CommandSpec>;

export type CommandName = keyof typeof COMMANDS;

export function isCommandName(value: string): value is CommandName {
  return Object.hasOwn(COMMANDS, value);
}

/**
 * Renders the `Commands:` block grouped by intent. The grouping is the
 * documentation: someone who wants to look at a repo without changing it
 * should not have to infer that from a flat alphabetised list.
 */
export function renderCommandList(): string {
  const entries = Object.entries(COMMANDS).map(
    ([name, spec]) => [spec.group, spec.args === "" ? name : `${name} ${spec.args}`, spec.summary] as const,
  );
  const width = Math.max(...entries.map(([, label]) => label.length));
  return Object.entries(COMMAND_GROUPS)
    .map(([group, heading]) => {
      const lines = entries
        .filter(([entryGroup]) => entryGroup === group)
        .map(([, label, summary]) => `    ${label.padEnd(width)}  ${summary}`);
      return [`  ${heading}`, ...lines].join("\n");
    })
    .join("\n\n");
}
