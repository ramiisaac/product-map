---
"product-map": patch
---

MCP tool capabilities are now named from the server's literal `registerTool`/`tool` registrations rather than from tool module filenames, so a tool's id follows the name clients call it by. Where a registered name differs from its module filename this rekeys the tool (`cap:mcp-tool:<package>.<registered-name>`): regenerate with `pmap all`, and update any `overrides`, `binds`, or planned-manifest references keyed on the old ids (`pmap doctor` reports stale override and bind keys). Registrations whose name is not static still fall back to tool modules, so no tool is dropped.
