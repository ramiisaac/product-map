---
name: pmap-guide-extractors
description: This skill should be used when the user asks to "write a local extractor", "add extract.local.mjs", "fix missing capabilities in product-map", "product-map is missing our commands/tools/routes", "add curated binds", "configure product-map.config.mjs", or when pmap output misses or fabricates items because the repo's truth lives in code registries instead of filesystem conventions.
---

# Authoring repo-local extractors and config

pmap's generic adapters read filesystem conventions (bins, `src/commands/`, Next app dirs, package manifests, migrations). When a repo's truth lives elsewhere — an operations registry, a switch-statement command dispatch, a single-file tool module, a generated capability matrix, frontmatter descriptions — the manifests under-report or fabricate. The fix is never to hand-edit the manifests: it is `docs/reference/product-map/extract.local.mjs` (emit items) or `product-map.config.mjs` (rules only).

## Decide: config or extractor

Use **`product-map.config.mjs`** (repo root, default-exported plain object) when only rules are needed:

```js
export default {
  nonProductDirs: ["scratch"], // extra dir segments to exclude
  canonicalPlacements: [{ where: "^apps/", canonical: "packages/email", kinds: ["email-contract"] }],
  overrides: { "surface:dashboard:web": { purpose: "...", audience: ["end-user"] } },
  renames: [{ fromId: "cap:command:old", toId: "cap:command:new" }], // the diff's only source of rename lineage
};
```

A `binds` or `overrides` key naming an item that was not extracted is reported by `pmap doctor` as an error rather than dropped, and a `renames` pair the diff cannot honor warns on stderr and falls back to added/removed — the reason to write any of these is that the map is already wrong, so a typo must be loud.

Use **`extract.local.mjs`** when items must be emitted or enriched: missing capabilities, curated binds, doctrine, registry-derived inventories.

## The extractor contract

- `node extract.local.mjs <repoRoot>` prints ONE JSON object to stdout: `{ "surfaces": [...], "capabilities": [...], "sources": [...] }`. Log to stderr only.
- Items are ordinary product-map.v1 items (schemas vendored by `pmap init` into `docs/reference/product-map/schemas/`). Repo-specific payloads go in each item's `ext` object with namespaced keys (`"myrepo.key"`).
- Ids follow the grammar `surface:<type>:<slug>` / `cap:<kind>:<slug>`, and the type/kind segment must equal the item's `surfaceType`/`kind` field.
- **Supersession**: emitting an item with the SAME id as a generic adapter's replaces it entirely — that is how to enrich (add binds, doctrine, views) rather than duplicate. The slug must match what the generic adapter produces (scope-stripped, lowercased, `[^a-z0-9.-]` → `-`); a near-miss slug creates a duplicate instead.
- Every item is schema-validated on ingest; an invalid item is dropped WITH a printed issue, and the run then FAILS CLOSED — a local extractor is the repo's authoritative voice, so pmap refuses to write manifests missing its items. `--allow-partial-local` accepts the degraded output explicitly. Watch pmap's `local-extractor:` lines; they name exactly which item failed.
- Reach is yours to state: you know your own repository, so record `external` or `internal` from what you know and keep `unknown` for real uncertainty. The generic adapters leave context-dependent kinds `unknown` because they must not guess — you are not guessing.
- Binds fail safe: a bind referencing a capability id that does not exist in the final extraction is silently dropped, so deriving bind lists from the same source the generic adapter reads keeps them self-maintaining.
- Read-only over the repo; 60 second timeout; runs as a child process with no shared runtime — every helper (`slug`, `prov`) must be defined in the file, and ALL imports must be top-level (a mid-file import silently degrades extraction).
- **Determinism is mandatory**: no timestamps, no randomness, `.sort()` every directory listing and iteration. The output participates in `pmap check-fresh`.

Test with: `node docs/reference/product-map/extract.local.mjs "$(pwd)" | head -c 400`, then `pnpm exec pmap all --repo . --dry-run` and check the `local-extractor:` lines and item counts.

## Proven patterns

1. **Registry 1:1** — read the repo's own generated registry/OpenAPI/capability-matrix and emit one capability per entry, with real summaries as `doctrine`.
2. **Contract parsing** — regex tool/command names out of the declaring source file (a protocol module, a dispatch `switch`), preserving namespace boundaries in ids.
3. **Frontmatter mining** — lift `description:` frontmatter from skills/agents/docs into capability doctrine.
4. **Metadata enrichment via supersession** — re-emit every workspace package with the repo's own manifest metadata as doctrine, using the generic adapter's exact ids.
5. **Curated binds** — re-emit an unbound surface verbatim plus explicit binds to the capabilities it actually fronts (grep-verify the wiring first: which API routes does the code call, which templates does it render).
6. **Curated semantics** — hand-written purposes/route descriptions where code cannot be parsed cheaply. VERIFY EVERY CLAIM AGAINST THE CODE; unverified guesses have shipped wrong six-at-a-time before.

## Pitfalls (each one earned)

- Slug mismatch with the generic adapter → duplicates instead of supersession (one repo gained 113 phantom packages this way).
- Unsorted `readdirSync` → nondeterministic hashes → flaky `check-fresh`.
- Helper files in a commands dir minted as commands by the generic adapter → supersede or use config `overrides`, never hand-edit output.
- Emitting `ext` keys without a namespace prefix → collides with future core fields.
- Forgetting the extractor participates in check-fresh: if it reads a file that other agents churn, the manifests churn with it.
- Repo formatters/pre-commit hooks rewriting the extractor, the config, or the canonical JSON → fence `docs/reference/product-map/` and `product-map.config.mjs` in the formatter's ignore file (a reformatted extractor may still produce identical output, but a reformatted manifest always fails the byte-compare).

## Additional Resources

### Reference Files

- **`references/authoring-guide.md`** — the repo's canonical authoring guide (contract summary + the real extractors these patterns come from).
