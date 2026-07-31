---
name: pmap-guide-overview
description: This skill should be used when the user or task mentions "product-map", "pmap", "surfaces manifest", "capabilities manifest", "surfaces.existing.json", "check-fresh", "product surface", "design drift", or work under docs/reference/product-map/. Explains what product-map is, how to install and run the pmap CLI, the file layout, and the rules (write boundary, determinism, freshness) every agent must respect.
---

# Using product-map

product-map deterministically describes what a repo's product surfaces and capabilities ARE (extracted from code, stance `existing`), optionally what they are INTENDED to be (authored by a design process, stance `planned`), and the diff between them. That serves several distinct uses: seeing what any repo ships from the CLI in seconds (the LOOK commands need no adoption at all), committing an agent-readable product inventory for planning and onboarding, gating freshness in CI, comparing repos across a fleet, and running a full design-reconciliation loop — hosted Claude Design is the usual authoring partner for that last one, but the loop is one use case, not the tool's definition. The model is `(kind: surface | capability) x (stance: existing | planned | derived)`. A surface is anything a human or integration touches (routes, CLI commands, TUI screens, MCP tools, emails, IDE views, GitHub Actions, docs). A capability is anything the system can do (routes, commands, entities, jobs, packages, checks, reporters).

## Install (published package)

Install from the public npm registry with `pnpm add -D product-map` (or the repository's package manager). The spec package comes transitively; add it directly only when repository code imports `@product-map/spec`.

## Commands

Run everything as `pnpm exec pmap <command> [--repo <path>] [--dry-run|-n] [--no-repo-code]`. `--repo` defaults to cwd. Use `--no-repo-code` for untrusted checkouts so repository-local configuration and extractors are not executed.

The LOOK commands write nothing and need no committed manifests — they extract live, so they work in a repo that has never adopted product-map. Reach for them first.

| Command                   | What it does                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `digest`                  | dense, path-first, token-budgeted summary — read this first in an unfamiliar repo   |
| `show`                    | what the repo ships, as a terminal table                                            |
| `explain <id>`            | why one item exists: adapter, evidence paths, confidence, bindings                  |
| `doctor`                  | which adapters ran, what extraction skipped, what looks thin — each with a remedy   |
| `all`                     | extract + map + diff + render in one pass — the default regeneration command        |
| `extract`                 | write `surfaces.existing.json` + `capabilities.existing.json` from the repo         |
| `init`                    | vendor the prompt templates + JSON Schemas into the repo's product-map dir          |
| `validate`                | validate every manifest on disk (read-only)                                         |
| `check-fresh`             | regenerate in memory and byte-compare against disk; exit 1 on drift (read-only)     |
| `bundle`                  | assemble the repo-reality bundle + design prompt for a hosted Claude Design project |
| `ingest <files..>`        | finalize + validate pasted Claude Design planned manifests; bounces invalid ones    |
| `map` / `diff` / `render` | individual derivation steps (rarely needed alone)                                   |
| `fleet <repos..>`         | cross-repo matrix; `--scan` extracts each repo live instead of reading its map      |

Useful flags: `--dry-run` before the first write in any repo, `--json` (or `--format=json`) for machine-readable LOOK output, `--max-tokens <n>` to budget `digest`, `--quiet` to silence progress, `--config <path>` for a config file outside the repo root.

Diagnostics go to stderr and command output to stdout, so `pmap digest --json | jq` is safe.

## File layout (per repo)

Everything lives under `docs/reference/product-map/`:

- `surfaces.existing.json`, `capabilities.existing.json` — extracted reality (source of truth)
- `surfaces.planned.json`, `capabilities.planned.json` — design intent, written only by `pmap ingest`
- `maps/` — derived joins; `maps/planned-surfaces-vs-existing-capabilities.json` is the reconciliation input
- `diffs/` — same-kind cross-stance diffs
- `generated/*.generated.md` — human-readable renderings; NEVER edit by hand; `generated/README.generated.md` is the index
- `prompts/`, `schemas/` — vendored by `pmap init`
- `extract.local.mjs` (optional) — the repo's own extractor; see the pmap-guide-extractors skill
- `generated/digest.generated.md` — the agent-facing summary, committed so it can be read without running anything
- `product-map.config.mjs` at the REPO ROOT (optional) — exclusion/placement/override rules, plus `adapters.exclude`, `ignore` globs, and declared `binds`

## Rules that must never be broken

1. **Write boundary**: pmap writes only under `docs/reference/product-map/` (plus the optional root config file). Never hand-edit the JSON manifests or `generated/` files — regenerate them. Extraction never modifies repo source.
2. **Determinism**: manifests are canonical JSON (sorted keys, LF, trailing newline) with a sha256 `contentHash` over items. No timestamps anywhere — the commit SHA in `generatedFrom` is the time axis. Anything feeding extraction (local extractors included) must be deterministic or `check-fresh` breaks.
3. **Honesty**: `workingTree: "dirty"` in a manifest is a fact about the repo at extraction time, not a problem to fix. Unknown/unbound/orphan are first-class recorded states — tools never guess to avoid them.
4. **Freshness**: after the repo's product code changes materially (or after a `git pull`), manifests are stale. Run `pmap check-fresh` to detect it and `pmap all` to fix it. Committing regenerated manifests follows the repo's own git discipline — some repos gitignore the directory entirely.

## Where to go next

- Adopting product-map in a repo for the first time → run the `/product-map:setup` command.
- Regenerating after changes → `/product-map:refresh`. Verifying only → `/product-map:validate`.
- Manifests missing or misrepresenting things the repo actually ships → run `pmap doctor` first; it names which adapters stayed silent and what was skipped. Then the `pmap-guide-extractors` skill, or `/product-map:review` for a full fidelity audit.
- Design engagement with hosted Claude Design (launch bundles, ingest, reconciliation) → the `pmap-design-handoff` skill and `/product-map:ingest`.
- The full normative contract → `references/spec.md` (a copy of the repo's SPEC.md; envelope, ids, vocabularies, operation guarantees).

## Additional Resources

### Reference Files

- **`references/spec.md`** — the complete product-map.v1 specification: envelope shape, id grammar, the controlled vocabularies, determinism rules, and operation contracts. Vocabulary values and counts live there and in `packages/spec/src/vocab.ts`, never here.
