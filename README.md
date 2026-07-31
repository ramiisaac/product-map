# product-map

[![npm](https://img.shields.io/npm/v/product-map)](https://www.npmjs.com/package/product-map) [![spec](https://img.shields.io/npm/v/%40product-map%2Fspec?label=%40product-map%2Fspec)](https://www.npmjs.com/package/@product-map/spec) [![CI](https://github.com/ramiisaac/product-map/actions/workflows/ci.yml/badge.svg)](https://github.com/ramiisaac/product-map/actions/workflows/ci.yml)

Deterministic product-surface and capability mapping for software repositories. `pmap` extracts what a repository exposes today, accepts planned manifests from a design process, and derives maps, diffs, Markdown summaries, and reconciliation guidance without inventing relationships.

The model is `(surface | capability) × (existing | planned | derived)`. Canonical JSON manifests live under `docs/reference/product-map/`, carry content hashes, and can be byte-checked for freshness in CI.

## What it looks like

Point it at [shadcn-ui/ui](https://github.com/shadcn-ui/ui) and `pmap digest` prints the repository's product surface in a few hundred tokens, leading with paths — a live extraction, with no setup in the target repository:

<!-- generated:example-digest — injected from examples/shadcn-ui/generated/digest.generated.md; do not edit -->

```text
# shadcn-ui — product map (pmap 0.1.1 @ 4baadbc6, clean)
3 surfaces · 24 capabilities · 22 bound · 2 capability-unbound · 1 surface-unbound

SURFACES
  surface:cli:shadcn    packages/shadcn  live  -> 14 bound
  surface:dashboard:v4  apps/v4          live  -> 8 bound
  surface:mcp:shadcn    packages/shadcn  live  UNBOUND

CAPABILITIES
  command  shadcn add, shadcn apply, shadcn build, shadcn diff, shadcn docs, shadcn eject … (13)  packages/shadcn (1)
  package  @shadcn/helpers, @shadcn/react, shadcn (3)                                             packages/helpers, packages/react, packages/shadcn (3)
  route    /api/search, /init, /init/md, /init/v0, /llm/slug-catchall, /r/registries.json … (8)   apps/v4 (1)

GAPS
  capability-unbound  cap:package:helpers
  capability-unbound  cap:package:react
  surface-unbound  surface:mcp:shadcn
```

<!-- /generated:example-digest -->

`pmap all` writes the manifests that digest summarises, plus this index ([full output](examples/shadcn-ui/generated/README.generated.md)):

<!-- generated:example-index — injected from examples/shadcn-ui/generated/README.generated.md; do not edit -->

```text
# shadcn-ui — product map

Extracted at commit `4baadbc65170` (clean tree) by pmap@0.1.1.

- **3 surfaces** across 3 types — inventory
- **24 capabilities** across 3 kinds — inventory
- **Map**: 22 bound · 2 capability-unbound · 1 surface-unbound — details, gaps report
- **Planned stance**: not yet authored — run the Claude Design prompts in this repo's prompts/ (or product-map's) to produce surfaces.planned.json
```

<!-- /generated:example-index -->

The gaps report is the part you act on. It names what is unaccounted for and what to do about it, and it never guesses:

<!-- generated:example-gaps — injected from examples/shadcn-ui/generated/product-surface-gaps.generated.md; do not edit -->

```text
## 2. Unbound surfaces — declare what powers them

These surfaces have no capability bindings. Either the extractor cannot see the wiring (emit curated binds from `extract.local.mjs`) or the surface genuinely fronts nothing.

- `surface:mcp:shadcn` (mcp, live). Likely matches: `cap:command:shadcn.mcp` (0.5).
```

<!-- /generated:example-gaps -->

That similarity score is a proposal, not a binding. Nothing in this toolchain converts a guess into a recorded fact.

## Use it for

**"I want an agent to understand this repo."** The manifests are deliberately verbose — provenance, evidence paths, content hashes — which is right for tooling and wrong for a context window. The digest is the same extraction budgeted for one. It does not replace reading code for a specific task; it replaces the expensive discovery phase before that.

```bash
pmap digest
```

**"I want to see what we ship."** A terminal table of every surface and capability, from a live extraction, with no committed manifests required.

```bash
pmap show
```

**"My map looks wrong."** Which adapters ran, which stayed silent, which one failed and why the rest carried on without it, what extraction skipped and why, and which surface types came out suspiciously thin — each finding paired with the remedy that fixes it.

```bash
pmap doctor
pmap explain surface:cli:pmap
```

**"I want to catch drift in CI."** `check-fresh` regenerates in memory and byte-compares against what is committed, so a code change nobody reflected in the map fails the build. The [GitHub Action](integrations/github-action/README.md) is one step.

```bash
pmap check-fresh
```

**"I want to run a design engagement."** `bundle` assembles repo reality plus the design prompt to paste into a hosted Claude Design project; `ingest` validates what comes back and writes it canonically, bouncing anything malformed with the reason.

```bash
pmap bundle > handoff.md
pmap ingest surfaces.planned.json
```

**"I have thirty repositories."** `fleet` rolls them into one derived manifest and matrix. `--scan` extracts each one live, so it works across repositories that have never adopted product-map.

```bash
pmap fleet ../service-a ../service-b --scan --out ./estate
```

## Scope

pmap is opinionated about what it reads: its extractors understand JavaScript and TypeScript repositories — package manifests and bins, Next.js and Hono apps, tRPC routers, Prisma and Drizzle schemas, Supabase functions and migrations, MCP servers, language servers, editor extensions, GitHub Actions, Electron and XcodeGen targets, and Claude Code plugins. Point it at a Go or Django repository and it will find very little.

That floor is deliberate rather than permanent. Everything a repository knows about itself that filesystem conventions cannot express — a command registry, a generated OpenAPI document, an operations table — is emitted by a repository-local [`extract.local.mjs`](docs/AUTHORING-LOCAL-EXTRACTORS.md), which supersedes the generic extractors and is schema-validated on the way in. This repository maps its own CLI that way.

## Install

Installing the CLI is all you need — `@product-map/spec` comes with it automatically as a dependency:

```bash
pnpm add -D product-map
pnpm exec pmap init
pnpm exec pmap all
pnpm exec pmap check-fresh
```

Install `@product-map/spec` directly only if you want the contract on its own — schema validation, canonical serialization, and content hashing without the extraction engine.

## What is included

- `product-map` — the CLI, installed under both names: `pmap` and `product-map` run the same binary. Internally it is a one-directional stack of layers (runtime, discovery, extract, derive, emit, engine) bundled into one published package; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), which is generated from the package manifests and gates the layering in CI.
- `@product-map/spec` — the `product-map.v1` Zod contract and emitted JSON Schemas. Installed automatically with the CLI.
- `docs/SPEC.md` — normative format and behavior documentation.
- `packages/pmap/prompts/` — design handoff and reconciliation prompt templates, vendored into a consuming repo by `pmap init`.
- [`plugins/product-map`](plugins/product-map/README.md) — a Claude Code plugin for adopting and maintaining product maps.
- [`integrations/github-action`](integrations/github-action/README.md) — a composite Action that runs `pmap check-fresh` as a CI gate.
- [`examples/`](examples/README.md) — product maps extracted from pinned MIT-licensed public repositories, committed exactly as `pmap` wrote them. `pnpm examples:setup` clones the pinned commits into a gitignored `fixtures/`, `pnpm examples:generate` rebuilds the snapshots, and `pnpm examples:check` validates them offline.

## CLI

<!-- generated:cli-help — injected from `pmap --help`; do not edit -->

```text
pmap — product-map.v1 toolchain

Usage: pmap <command> [--repo <path>] [--dry-run|-n] [--no-repo-code]

Commands:
  LOOK — read-only, writes nothing
    show          Print what this repo ships as a terminal table (no committed manifests needed)
    digest        Print a dense, token-budgeted, path-first summary for an agent entering the repo
    explain <id>  Explain one item: which adapter emitted it, from what evidence, at what confidence
    doctor        Report which adapters ran, what was skipped, and what looks suspiciously thin

  ADOPT & MAINTAIN
    init          Vendor the prompt templates + JSON Schemas into the repo's product-map directory
    all           extract + map + diff + render in one pass
    check-fresh   Regenerate in memory and byte-compare against disk (read-only, exit 1 on drift)
    validate      Validate every manifest under docs/reference/product-map/ (read-only)

  DESIGN LOOP — bundle sends, ingest receives
    bundle        Assemble the repo-reality bundle and design prompt for a Claude Design project
    ingest <f..>  Finalize + validate raw planned manifests (e.g. pasted Claude Design JSON) and write them canonically

  MULTI-REPO
    fleet <r...>  Roll up several repos into fleet.json + fleet.generated.md in --out (--scan extracts live)

  PRIMITIVES — individual pipeline stages
    extract       Extract surfaces.existing.json + capabilities.existing.json from the repo
    map           Derive maps/ from the manifests on disk
    diff          Derive diffs/ (requires planned manifests)
    render        Render generated/*.generated.md from the JSON manifests

Flags:
  --repo <path>          Target repo root (default: cwd)
  --out <path>           Output directory for fleet (default: cwd)
  --dry-run, -n          Report every file that WOULD be written; write nothing
  --no-repo-code         Do not import product-map.config.mjs or extract.local.mjs
  --allow-partial-local  Write partial output if the repo-local extractor fails
  --config <path>        Read product-map.config.mjs from an explicit path (not with --no-repo-code)
  --quiet, -q            Suppress progress diagnostics; leave errors and output
  --format <f>           Output format for the LOOK commands: text|json
  --json                 Shorthand for --format=json
  --max-tokens <n>       Budget for digest on stdout (the committed digest uses config)
  --scan                 fleet only: extract each repo live instead of reading committed maps
  --version, -v          Print the pmap version
  --help                 Show this help
```

<!-- /generated:cli-help -->

## Customization

Four rungs, in order. Most repositories never leave the first.

1. **Nothing.** Zero-config on a conventional repository.
2. **Flags.** One-off behavior: `--format`, `--max-tokens`, `--no-repo-code`, `--config`. Flags change what reaches your terminal; they never change committed bytes.
3. **`product-map.config.mjs`.** Declarative rules, at the repository root.
4. **[`extract.local.mjs`](docs/AUTHORING-LOCAL-EXTRACTORS.md).** Imperative, for truth no convention can express. It supersedes the generic adapters and is schema-validated on the way in.

```js
/** @type {import('@product-map/spec').RepoConfig} */
export default {
  repoName: "my-product",
  nonProductDirs: ["scratch"],
  adapters: { exclude: ["email"] }, // silence a misfiring adapter
  ignore: ["packages/legacy/**"], // hide paths from every adapter
  binds: [{ surface: "surface:cli:tool", capability: "cap:command:tool.run" }],
  renames: [{ fromId: "cap:command:tool.old", toId: "cap:command:tool.run" }], // declared lineage for the diff
  canonicalPlacements: [{ where: "^apps/", canonical: "packages/core", kinds: ["service"] }],
  overrides: { "surface:cli:tool": { status: "partial" } },
  outputs: { markdown: true, digest: true },
  mapping: { candidateThreshold: 0.5, maxCandidates: 3 },
  render: { descriptionLimit: 160, collapseThreshold: 15 },
  digest: { maxTokens: 1200 },
  concurrency: 4,
};
```

`adapters.exclude` throws on a name no adapter provides, and a `binds` or `overrides` entry naming an item that was not extracted is reported by `pmap doctor` rather than silently dropped — the reason to reach for any of these fields is that the map is already wrong, so none of them may fail quietly. `renames` is the diff's only source of rename lineage: a declared pair is honored when `fromId` exists on one side and `toId` on the other and neither appears on both, and a declaration that does not line up warns on stderr and falls back to added/removed.

### Multiple repositories

`pmap fleet <repo...> --out <dir>` reads each repository's committed manifests and writes `fleet.json` — a derived `product-map.v1` manifest with one entry per repository — plus a rendered `fleet.generated.md`. A repository that has not run `pmap all` appears as a row with a state, never as an omission. Pass `--scan` to extract each repository live instead; rows say which source they came from, so the matrix cannot claim a committed map that is not there. With no paths it reads a roster from `product-map.fleet.json`:

```json
{ "name": "my-estate", "repos": ["../service-a", "../service-b"] }
```

Repository-local `product-map.config.mjs` and `extract.local.mjs` extensions are supported. They are executable repository code; use `--no-repo-code` when inspecting an untrusted checkout — see [SECURITY.md](SECURITY.md).

## Development

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm examples:check
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [docs/PUBLISHING.md](docs/PUBLISHING.md). Licensed under the [MIT License](LICENSE).
