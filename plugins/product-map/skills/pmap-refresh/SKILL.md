---
name: pmap-refresh
description: This skill should be used when the user asks to "refresh product-map", "regenerate the product map", "regenerate manifests", "rebuild the launch bundle", or after a git pull when product-map data may be stale.
allowed-tools: ["Bash", "Read", "Grep", "Glob"]
---

# /product-map:refresh — regenerate manifests and bundle

Regenerate the repo's product-map data against the current tree and verify freshness.

## Steps

1. `pnpm exec pmap all --repo .` — capture the surface/capability counts and the create/update/unchanged summary. Report any `local-extractor:` warnings verbatim; they mean the repo's own extractor is broken and the output silently degraded to generic adapters.
2. If `docs/reference/product-map/assemble-launch-bundle.mjs` exists, run `node docs/reference/product-map/assemble-launch-bundle.mjs` so the bundle references the same extraction as the manifests.
3. `pnpm exec pmap check-fresh --repo .` — must report OK. If it reports drift immediately after regeneration, something feeding extraction is nondeterministic (usually an unsorted iteration in `extract.local.mjs`); investigate rather than re-running until green.
4. **Report deltas, not just totals**: compare the new counts against the previous manifest (git diff of the JSON, or the counts in the old `generated/README.generated.md`) and state what appeared/disappeared — new surfaces and capability-kind count changes are the signal the user cares about.
5. Do not commit; committing regenerated data follows the repo's own git discipline.
