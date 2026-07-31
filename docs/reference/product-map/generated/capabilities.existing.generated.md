<!-- generated from capabilities.existing.json@95881986b8eccb44759ac11717fcf59a353a797696e901c17c4044e71b5bc499 — do not edit -->

# product-map — capabilities (existing)

Stance: **existing** · Commit: `88632aeb8038` (dirty) · Generator: pmap@0.0.0 · Items: 31

## At a glance

| Kind | Count | Areas |
| ---- | ----- | ----- |
| agent-skill | 8 | agent |
| command | 15 | cli |
| package | 8 | sdk |

## agent-skill (8)

| Id | Name | Description | Area | Status | Lives in |
| -- | ---- | ----------- | ---- | ------ | -------- |
| `cap:agent-skill:product-map.pmap-design-handoff` | pmap-design-handoff | This skill should be used when the user asks to "prepare a launch bundle", "hand off to Claude Design", "assemble a design bundle", "ingest a design", "recon... | agent | live | `plugins/product-map` |
| `cap:agent-skill:product-map.pmap-guide-extractors` | pmap-guide-extractors | This skill should be used when the user asks to "write a local extractor", "add extract.local.mjs", "fix missing capabilities in product-map", "product-map i... | agent | live | `plugins/product-map` |
| `cap:agent-skill:product-map.pmap-guide-overview` | pmap-guide-overview | This skill should be used when the user or task mentions "product-map", "pmap", "surfaces manifest", "capabilities manifest", "surfaces.existing.json", "chec... | agent | live | `plugins/product-map` |
| `cap:agent-skill:product-map.pmap-ingest` | pmap-ingest | This skill should be used when the user asks to "ingest the design", "ingest planned manifests", "process the Claude Design export", "run the reconcile", or ... | agent | live | `plugins/product-map` |
| `cap:agent-skill:product-map.pmap-refresh` | pmap-refresh | This skill should be used when the user asks to "refresh product-map", "regenerate the product map", "regenerate manifests", "rebuild the launch bundle", or ... | agent | live | `plugins/product-map` |
| `cap:agent-skill:product-map.pmap-review` | pmap-review | This skill should be used when the user asks to "review the product map", "audit product-map output", "does the product map capture everything", "check produ... | agent | live | `plugins/product-map` |
| `cap:agent-skill:product-map.pmap-setup` | pmap-setup | This skill should be used when the user asks to "set up product-map", "adopt product-map", "install pmap in this repo", or "add product-map to this repo". On... | agent | live | `plugins/product-map` |
| `cap:agent-skill:product-map.pmap-validate` | pmap-validate | This skill should be used when the user asks to "validate product-map", "check product-map freshness", "is the product map stale", or wants the read-only CI-... | agent | live | `plugins/product-map` |

## command (15)

| Id | Name | Description | Area | Status | Lives in |
| -- | ---- | ----------- | ---- | ------ | -------- |
| `cap:command:pmap.all` | pmap all | extract + map + diff + render in one pass | cli | live | `packages/pmap` |
| `cap:command:pmap.bundle` | pmap bundle | Assemble the repo-reality bundle and design prompt for a Claude Design project | cli | live | `packages/pmap` |
| `cap:command:pmap.check-fresh` | pmap check-fresh | Regenerate in memory and byte-compare against disk (read-only, exit 1 on drift) | cli | live | `packages/pmap` |
| `cap:command:pmap.diff` | pmap diff | Derive diffs/ (requires planned manifests) | cli | live | `packages/pmap` |
| `cap:command:pmap.digest` | pmap digest | Print a dense, token-budgeted, path-first summary for an agent entering the repo | cli | live | `packages/pmap` |
| `cap:command:pmap.doctor` | pmap doctor | Report which adapters ran, what was skipped, and what looks suspiciously thin | cli | live | `packages/pmap` |
| `cap:command:pmap.explain` | pmap explain | Explain one item: which adapter emitted it, from what evidence, at what confidence | cli | live | `packages/pmap` |
| `cap:command:pmap.extract` | pmap extract | Extract surfaces.existing.json + capabilities.existing.json from the repo | cli | live | `packages/pmap` |
| `cap:command:pmap.fleet` | pmap fleet | Roll up several repos into fleet.json + fleet.generated.md in --out (--scan extracts live) | cli | live | `packages/pmap` |
| `cap:command:pmap.ingest` | pmap ingest | Finalize + validate raw planned manifests (e.g. pasted Claude Design JSON) and write them canonically | cli | live | `packages/pmap` |
| `cap:command:pmap.init` | pmap init | Vendor the prompt templates + JSON Schemas into the repo's product-map directory | cli | live | `packages/pmap` |
| `cap:command:pmap.map` | pmap map | Derive maps/ from the manifests on disk | cli | live | `packages/pmap` |
| `cap:command:pmap.render` | pmap render | Render generated/*.generated.md from the JSON manifests | cli | live | `packages/pmap` |
| `cap:command:pmap.show` | pmap show | Print what this repo ships as a terminal table (no committed manifests needed) | cli | live | `packages/pmap` |
| `cap:command:pmap.validate` | pmap validate | Validate every manifest under docs/reference/product-map/ (read-only) | cli | live | `packages/pmap` |

## package (8)

| Id | Name | Description | Area | Status | Lives in |
| -- | ---- | ----------- | ---- | ------ | -------- |
| `cap:package:derive` | @product-map/derive | Pure derivation of maps, diffs, and fleet roll-ups | sdk | live | `packages/derive` |
| `cap:package:discovery` | @product-map/discovery | Repository crawl, package graph, and git context | sdk | live | `packages/discovery` |
| `cap:package:emit` | @product-map/emit | Pure projections of manifests to human- and agent-readable text | sdk | live | `packages/emit` |
| `cap:package:engine` | @product-map/engine | Command orchestration, the manifest slot registry, and the transactional writer | sdk | live | `packages/engine` |
| `cap:package:extract` | @product-map/extract | Adapter contract, filesystem-convention adapters, deduplication, and the repository-local extractor protocol | sdk | live | `packages/extract` |
| `cap:package:product-map` | product-map | pmap — extract, validate, map, diff, render, and freshness-check product-map.v1 manifests | sdk | live | `packages/pmap` |
| `cap:package:runtime` | @product-map/runtime | Domain-free runtime primitives: logging, filesystem, caching, bounded concurrency, subprocesses | sdk | live | `packages/runtime` |
| `cap:package:spec` | @product-map/spec | product-map.v1 manifest schemas, canonical JSON serialization, and content hashing | sdk | live | `packages/spec` |
