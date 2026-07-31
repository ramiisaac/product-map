---
name: pmap-setup
description: This skill should be used when the user asks to "set up product-map", "adopt product-map", "install pmap in this repo", or "add product-map to this repo". One-time adoption: install the public package, vendor prompts/schemas, and perform the first extraction.
argument-hint: "[--dry-run]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob"]
disable-model-invocation: true
---

# /product-map:setup — adopt product-map in this repo

Perform one-time adoption of product-map in the current repo. Idempotent: skip any step already done.

## Steps

1. **Install.** `pnpm add -D product-map` (use the repo's actual package manager if not pnpm). The spec package arrives transitively.
2. **Vendor templates.** `pnpm exec pmap init --repo .` — writes `prompts/` and `schemas/` into `docs/reference/product-map/`.
3. **Fence from formatters BEFORE committing anything.** Manifests are canonical JSON byte-compared by check-fresh, and `extract.local.mjs`/`product-map.config.mjs` are operator-curated. Add `docs/reference/product-map/` and `product-map.config.mjs` to the formatter ignore file (`.prettierignore`, Biome `files.ignore`, or equivalent).
4. **First extraction, dry-run first.** `pnpm exec pmap all --repo . --dry-run`, show the user what would be written, then run it for real (skip the real run if the user passed `--dry-run`). Use `--no-repo-code` if the checkout is untrusted.
5. **Report.** Surface/capability counts, the adapters that ran, any `local-extractor:` warnings, and the path to `docs/reference/product-map/generated/README.generated.md`.
6. **Git posture.** Remind the user that committing (or gitignoring) `docs/reference/product-map/` is their repository's decision; do not run git commands.

## Quality checks

- If counts look thin for what the repo obviously ships (a CLI with 0 command capabilities, an MCP server with 0 tools), say so and point at the pmap-guide-extractors skill or `/product-map:review` rather than presenting thin output as complete.
