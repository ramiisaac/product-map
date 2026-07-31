<!-- generated from surfaces.existing.json@994bbfcda5d4715993e883256f29944ee3930978e2607aae880e06681f5a749d — do not edit -->

# mcp-inspector — product surfaces (existing)

Stance: **existing** · Commit: `ac3c1a122a5e` (clean) · Generator: pmap@0.0.0 · Items: 5

## At a glance

| Surface type | Count | Statuses |
| ------------ | ----- | -------- |
| cli | 4 | live |
| mcp | 1 | live |

## cli

### `surface:cli:mcp-inspector` — mcp-inspector CLI

Command-line entrypoint `mcp-inspector` from @modelcontextprotocol/inspector.

- Status: **live** · Entry: `mcp-inspector` (bin) · Audience: developer
- Lives in: `.`
- Evidence: `package.json`, `cli/build/cli.js` (confidence: high)
- Bound capabilities: none declared (unbound)

### `surface:cli:mcp-inspector-cli` — mcp-inspector-cli CLI

Command-line entrypoint `mcp-inspector-cli` from @modelcontextprotocol/inspector-cli.

- Status: **live** · Entry: `mcp-inspector-cli` (bin) · Audience: developer
- Lives in: `cli`
- Evidence: `cli/package.json`, `cli/build/cli.js` (confidence: high)
- Bound capabilities (1): `cap:package:inspector-cli`

### `surface:cli:mcp-inspector-client` — mcp-inspector-client CLI

Command-line entrypoint `mcp-inspector-client` from @modelcontextprotocol/inspector-client.

- Status: **live** · Entry: `mcp-inspector-client` (bin) · Audience: developer
- Lives in: `client`
- Evidence: `client/package.json`, `client/./bin/start.js` (confidence: high)
- Bound capabilities (1): `cap:package:inspector-client`

### `surface:cli:mcp-inspector-server` — mcp-inspector-server CLI

Command-line entrypoint `mcp-inspector-server` from @modelcontextprotocol/inspector-server.

- Status: **live** · Entry: `mcp-inspector-server` (bin) · Audience: developer
- Lives in: `server`
- Evidence: `server/package.json`, `server/build/index.js` (confidence: high)
- Bound capabilities (1): `cap:package:inspector-server`

## mcp

### `surface:mcp:inspector-server` — @modelcontextprotocol/inspector-server MCP server

MCP server implemented in server.

- Status: **live** · Entry: `@modelcontextprotocol/inspector-server` (mcp-tool) · Audience: agent
- Lives in: `server`
- Evidence: `server/package.json` (confidence: high)
- Bound capabilities: none declared (unbound)
