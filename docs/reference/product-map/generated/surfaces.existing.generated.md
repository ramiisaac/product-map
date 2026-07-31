<!-- generated from surfaces.existing.json@5a11b73ed8974f74d9b8010a6febc01da7525f053a2bf529f66c9af6dc875e70 — do not edit -->

# product-map — product surfaces (existing)

Stance: **existing** · Commit: `bd77f38afbfd` (dirty) · Generator: pmap@0.1.1 · Items: 5

## At a glance

| Surface type | Count | Statuses |
| ------------ | ----- | -------- |
| agent-plugin | 1 | live |
| cli | 2 | live |
| github-action | 1 | live |
| registry | 1 | live |

## agent-plugin

### `surface:agent-plugin:product-map` — product-map plugin

Skills and commands for consuming-repo agents: inspect what any repo ships from the CLI, install and run pmap, keep product-map manifests fresh, author repo-local extractors, and run the Claude Design handoff loop.

- Status: **live** · Entry: `plugins/product-map/.claude-plugin/plugin.json` (config-file) · Audience: developer, agent
- Lives in: `plugins/product-map`
- Evidence: `plugins/product-map/.claude-plugin/plugin.json` (confidence: high)
- Bound capabilities (8): `cap:agent-skill:product-map.pmap-design-handoff`, `cap:agent-skill:product-map.pmap-guide-extractors`, `cap:agent-skill:product-map.pmap-guide-overview`, `cap:agent-skill:product-map.pmap-ingest`, `cap:agent-skill:product-map.pmap-refresh`, `cap:agent-skill:product-map.pmap-review`, `cap:agent-skill:product-map.pmap-setup`, `cap:agent-skill:product-map.pmap-validate`

## cli

### `surface:cli:pmap` — pmap CLI

Extract, validate, map, diff, render, and freshness-check product-map.v1 manifests for a repository, and ingest planned manifests returned by a design process.

- Status: **live** · Entry: `pmap` (bin) · Audience: developer, agent
- Lives in: `packages/pmap`
- Evidence: `packages/engine/src/registry.ts`, `packages/pmap/src/cli.ts` (confidence: high)
- Bound capabilities (16): `cap:command:pmap.all`, `cap:command:pmap.bundle`, `cap:command:pmap.check-fresh`, `cap:command:pmap.diff`, `cap:command:pmap.digest`, `cap:command:pmap.doctor`, `cap:command:pmap.explain`, `cap:command:pmap.extract`, `cap:command:pmap.fleet`, `cap:command:pmap.ingest`, `cap:command:pmap.init`, `cap:command:pmap.map` … and 4 more

### `surface:cli:product-map` — product-map CLI

Command-line entrypoint `product-map` from product-map.

- Status: **live** · Entry: `product-map` (bin) · Audience: developer
- Lives in: `packages/pmap`
- Evidence: `packages/pmap/package.json`, `packages/pmap/./dist/cli.js` (confidence: high)
- Bound capabilities (1): `cap:package:product-map`

## github-action

### `surface:github-action:product-map-freshness` — product-map freshness Action

Run `pmap check-fresh` as a CI gate so a stale product map fails the build.

- Status: **live** · Entry: `integrations/github-action/action.yml` (config-file) · Audience: developer
- Lives in: `integrations/github-action`
- Evidence: `integrations/github-action/action.yml` (confidence: high)
- Bound capabilities (2): `cap:command:pmap.check-fresh`, `cap:command:pmap.validate`

## registry

### `surface:registry:product-map` — ramiisaac plugin marketplace

Claude Code plugin marketplace distributing 1 plugin from this repository.

- Status: **live** · Entry: `.claude-plugin/marketplace.json` (config-file) · Audience: developer
- Lives in: `.`
- Evidence: `.claude-plugin/marketplace.json` (confidence: high)
- Bound capabilities: none declared (unbound)
