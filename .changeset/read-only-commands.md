---
"product-map": minor
"@product-map/spec": minor
---

Add the read-only commands, a configurable option surface, and a GitHub Action.

`pmap digest` prints a dense, path-first, token-budgeted summary of a repository — the same extraction the manifests hold, rendered for a context window instead of for tooling. It is also written to `docs/reference/product-map/generated/digest.generated.md`, so an agent finds it without running anything. `pmap show` prints a terminal table of what a repository ships, `pmap explain <id>` answers why one item exists (adapter, evidence paths, confidence, bindings), `pmap doctor` reports which adapters ran, what extraction skipped and why, and which surface types came out thin — each finding paired with its remedy — and `pmap bundle` assembles the outbound leg of the design handoff. None of them write anything, and all of them extract live, so they work in a repository that has never adopted product-map.

`pmap fleet --scan` extracts each repository live instead of reading its committed manifests, so a fleet view works across repositories that have not adopted product-map. Scanned rows are labelled, so the matrix cannot claim a committed map that is not there.

`product-map.config.mjs` gains `adapters.exclude`, `ignore` globs, declared `binds`, `outputs`, `localExtractor`, `concurrency`, and per-layer `mapping` / `render` / `digest` / `discovery` overrides for values that were previously hard-coded. `RepoConfig` is exported from `@product-map/spec`, so a config file can be type-checked against the published package. `adapters.exclude` throws on an unknown adapter name and a `binds` entry naming an unextracted item is reported by `doctor` rather than dropped silently.

New flags: `--format=text|json`, `--json`, `--max-tokens`, `--config <path>`, `--quiet`, and `--scan`. Diagnostics now go to stderr rather than stdout, so command output is pipeable; `--max-tokens` deliberately does not affect the committed digest, so passing it can never make `check-fresh` report drift. `--help` is grouped by intent.

The composite GitHub Action at `integrations/github-action` runs `pmap check-fresh` as a CI gate in one step.
