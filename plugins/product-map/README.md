# product-map plugin

Claude Code skills and commands for adopting and maintaining [product-map](https://github.com/ramiisaac/product-map): install the public `pmap` package, keep manifests fresh, author repository-local extractors, and run a design handoff loop.

## Install

```text
/plugin marketplace add ramiisaac/product-map
/plugin install product-map@ramiisaac
```

## What you get

- `pmap-guide-overview` — model, installation, commands, layout, and operating rules.
- `pmap-guide-extractors` — extension contract, patterns, and pitfalls.
- `pmap-design-handoff` — launch bundles, planned manifests, and reconciliation.
- `/product-map:setup`, `refresh`, `validate`, `review`, and `ingest` commands.

## Maintenance

The skills' `references/` documents are generated from `docs/SPEC.md` and `docs/AUTHORING-LOCAL-EXTRACTORS.md`. After editing either, run `pnpm generate` at the repository root; the pre-commit hook does it automatically and CI fails on drift.

The plugin version is locked to the CLI version by the release workflow. MIT licensed.
