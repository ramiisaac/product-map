# product-map

The `pmap` CLI extracts product surfaces and capabilities from a repository, validates planned manifests, derives maps and diffs, renders Markdown, and checks committed artifacts for deterministic drift.

```bash
pnpm add -D product-map
pnpm exec pmap init
pnpm exec pmap all
pnpm exec pmap check-fresh
```

All generated artifacts are scoped to `docs/reference/product-map/`. Use `--dry-run` to preview writes. A target repository may opt into executable `product-map.config.mjs` and `extract.local.mjs` extensions; pass `--no-repo-code` when analyzing an untrusted checkout.

See the [repository documentation](https://github.com/ramiisaac/product-map#readme) for the format, workflows, public examples, and contribution guide. MIT licensed.
