# Authoring a repo-local extractor

For resident agents of repos consuming product-map. Full contract: SPEC.md section 7.

## When to write one

The generic adapters read filesystem conventions (bins, src/commands, Next app dirs, manifests). Write `docs/reference/product-map/extract.local.mjs` when your repo's truth lives elsewhere: an operations/command registry, a generated OpenAPI/capability-matrix document, plugin trees, tool contracts, frontmatter descriptions, or scoped packages the generic scope rules misread.

## The contract

- `node extract.local.mjs <repoRoot>` prints ONE JSON object to stdout: `{ "surfaces": [...], "capabilities": [...], "sources": [...] }`.
- Node is only the default. `localExtractor` in `product-map.config.mjs` replaces the command, so the extractor can be written in any language — see "Any language" below.
- Items are ordinary product-map.v1 items (see `schemas/` vendored by `pmap init`); repo-specific payloads go in each item's `ext` object (namespace your keys: `"myrepo.key"`).
- Every capability needs `reach`: `"external"` when something outside the repository can consume it directly (a route, a command, a published package, an MCP tool), `"internal"` when it is only reachable from inside (a database entity, an internal service, a job), `"unknown"` when you genuinely cannot tell. You are writing about your own repository, so record what you know: the generic adapters leave a route `unknown` because no heuristic can tell a public API's routes from an internal admin dashboard's, but you can, and reserving `unknown` for real uncertainty is the whole reason a local extractor beats them here. It is independent of `status` — an unpublished package is `status: "live"` with `reach: "internal"`.
- Ids follow the grammar (`surface:<type>:<slug>`, `cap:<kind>:<slug>`); reusing a generic adapter's id SUPERSEDES its item — that is how you enrich (add doctrine/binds/views) rather than duplicate.
- Every item is schema-validated on ingest, and the run FAILS CLOSED if any item is invalid or the extractor errors: a repo-local extractor is authoritative, so silently writing manifests without its items would be worse than writing nothing. `--allow-partial-local` opts into the degraded output explicitly. Test with: `node extract.local.mjs "$(pwd)" | head -c 400`.
- DETERMINISM IS MANDATORY: no timestamps, no randomness, sorted iteration (`readdirSync(...).sort()`) — your output participates in `pmap check-fresh`.
- Read-only over the repo; 60s timeout; stdout is the only channel (log to stderr). Both the timeout and the output buffer limit are configurable.

## A minimal capability

```js
{
  id: "cap:command:acme.deploy",
  kind: "command",
  name: "acme deploy",
  surfaceArea: "cli",
  status: "live",
  reach: "external",
  purpose: "Ship the current build to production.",
  placement: { current: "packages/cli", verdict: "correct" },
  provenance: { source: "src/registry.ts", evidence: ["src/registry.ts"], confidence: "high" },
}
```

## Patterns that work

- Registry 1:1: read a generated OpenAPI document or command registry and emit one capability for each declared operation, with CLI/MCP surfaces bound to the same ids.
- Contract parsing: parse tool or command names from the declaring source file while preserving namespace boundaries in ids.
- Frontmatter mining: lift each skill or plugin description into capability doctrine.
- Metadata enrichment: re-emit workspace packages with domain/layer metadata as doctrine, reusing generic adapter ids so curated entries supersede heuristics.
- Curated semantics: add route descriptions when code cannot be parsed cheaply, but verify every description against the implementation.

## Any language

The default invocation is `node <repoRoot>/docs/reference/product-map/extract.local.mjs <repoRoot>`. Override it when the truth is easier to read from another runtime — the repo root is always appended as the final argument, and the JSON contract, schema validation, supersession, and determinism rules are unchanged:

```js
export default {
  localExtractor: {
    command: "python3",
    args: ["tools/product_map_extract.py"],
    timeoutMs: 120_000,
    maxBufferBytes: 64 * 1024 * 1024,
  },
};
```

A non-zero exit, a timeout, or unparseable stdout fails the run closed — the local extractor is the repository's authoritative voice, so degrading silently would rewrite the manifests without it. `--allow-partial-local` is the explicit opt-out.

## Prefer product-map.config.mjs when you only need rules

If you just need to exclude directories, fix a surface type/purpose, or declare canonical placements (misplacement doctrine), use `product-map.config.mjs` at the repo root instead: `export default { nonProductDirs: [], canonicalPlacements: [{ where: "^apps/", canonical: "packages/email", kinds: ["email-contract"] }], overrides: { "surface:dashboard:web": { purpose: "..." } } }`. It also carries `adapters.exclude` for a misfiring adapter, `ignore` globs, `binds` for a wiring no convention reveals, and `renames` for the `fromId`/`toId` lineage a diff cannot infer — all cheaper than an extractor. A `binds` or `overrides` key naming an item that was not extracted is reported by `pmap doctor` rather than silently dropped, so a typo in either is loud. `RepoConfig` is exported from `@product-map/spec`, so `/** @type {import('@product-map/spec').RepoConfig} */` type-checks the file.
