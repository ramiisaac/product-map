<!-- generated from surfaces.existing.json@bd71ae420a63ee23a87f29ff8b734095ec5b4db3bf6b6d056b8d3e7c35740749 — do not edit -->

# shadcn-ui — product surfaces (existing)

Stance: **existing** · Commit: `4baadbc65170` (clean) · Generator: pmap@0.0.0 · Items: 3

## At a glance

| Surface type | Count | Statuses |
| ------------ | ----- | -------- |
| cli | 1 | live |
| dashboard | 1 | live |
| mcp | 1 | live |

## cli

### `surface:cli:shadcn` — shadcn CLI

Command-line entrypoint `shadcn` from shadcn.

- Status: **live** · Entry: `shadcn` (bin) · Audience: developer
- Lives in: `packages/shadcn`
- Evidence: `packages/shadcn/package.json`, `packages/shadcn/src/commands` (confidence: high)
- Bound capabilities (14): `cap:command:shadcn.add`, `cap:command:shadcn.apply`, `cap:command:shadcn.build`, `cap:command:shadcn.diff`, `cap:command:shadcn.docs`, `cap:command:shadcn.eject`, `cap:command:shadcn.info`, `cap:command:shadcn.init`, `cap:command:shadcn.mcp`, `cap:command:shadcn.migrate`, `cap:command:shadcn.preset`, `cap:command:shadcn.search` … and 2 more

## dashboard

### `surface:dashboard:v4` — v4

Next.js app at apps/v4 (19 page routes).

- Status: **live** · Entry: `/` (route) · Audience: developer
- Lives in: `apps/v4`
- Evidence: `apps/v4/app` (confidence: medium)
- Bound capabilities (8): `cap:route:v4-api-search`, `cap:route:v4-init`, `cap:route:v4-init-md`, `cap:route:v4-init-v0`, `cap:route:v4-llm-slug-catchall`, `cap:route:v4-r-registries.json`, `cap:route:v4-rss.xml`, `cap:route:v4-typeset.css`
- Views (19): `/`, `/blocks`, `/blocks/[...categories]`, `/charts/[type]`, `/colors`, `/create`, `/docs/[[...slug]]`, `/docs/changelog`, `/examples/[base]/[name]`, `/examples/authentication`, `/examples/dashboard`, `/examples/playground`, `/examples/rtl`, `/examples/tasks`, `/preview/[base]/[name]` …

## mcp

### `surface:mcp:shadcn` — shadcn MCP server

MCP server implemented in packages/shadcn.

- Status: **live** · Entry: `shadcn` (mcp-tool) · Audience: agent
- Lives in: `packages/shadcn`
- Evidence: `packages/shadcn/package.json` (confidence: high)
- Bound capabilities: none declared (unbound)
