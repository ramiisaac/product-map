---
"product-map": patch
---

Fewer false items from the generic adapters. Migration scanning reads SQL as tokens, so `CREATE TABLE` inside a comment, string, function body, or `DO` block no longer becomes an entity, and temporary tables are skipped. A Hono module counts as a route only when it registers one, so shared-types modules under `src/routes` stop appearing as routes. An MCP surface now requires server evidence — an import of the SDK server entrypoint or an `src/mcp/tools` directory — so a model tool set in a generic `src/tools` directory is no longer read as an MCP server; SDK v2 servers (`@modelcontextprotocol/server`) are now detected, and tools are named from literal `registerTool`/`tool` registrations, falling back to tool modules when a registration name is not static. Command helpers imported by a sibling command module are no longer listed as commands.
