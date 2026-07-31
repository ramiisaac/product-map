# Case B — Export an existing (unsynchronized) Claude Design project as planned manifests

Paste everything below into the EXISTING hosted Claude Design project. Replace `<REPO>` before sending. This is the primary drift-recovery prompt: it extracts the design side's model of the product so engineering can reconcile it against the repo.

---

This design project has evolved separately from its repository, and I need to reconcile the two sides deterministically. Your task is NOT to summarize the design visually and NOT to produce new design work. Your task is to EXPORT your current design-side model of the product as structured manifests that engineering tooling will validate, map against the repo's actual capabilities, and diff against the repo's actual surfaces.

Describe what THIS PROJECT currently believes the product is — including anything you designed that may not exist in the repo, and anything you assumed the backend provides. Completeness beats polish: a surface you half-designed three iterations ago still belongs in the export, marked with low confidence.

COVER EVERY DESIGNED SURFACE, not just web routes:

- pages/routes/views (marketing, docs, dashboards, admin, settings, onboarding, auth)
- CLI commands and TUI screens you designed or implied
- IDE/editor surfaces (VS Code panels/commands, LSP-driven features, JetBrains/Zed)
- email and notification templates or copy
- GitHub/CI outputs (PR comments, checks, badges, reports)
- MCP tools or agent-facing surfaces
- generated artifacts (reports, exports, embeds)

For each: major components, states (empty/loading/error/success/degraded), interactions and flows, data needs, actions, and what backend/API behavior it assumes.

DELIVERABLES (emit each as a complete fenced code block)

1. surfaces.planned.json — envelope: {"schemaVersion": "product-map.v1", "kind": "surface", "stance": "planned", "scope": "<REPO>", "generatedFrom": {"commit": null, "workingTree": "not-applicable", "sources": ["<this design project>"]}, "generator": {"name": "claude-design", "version": "hosted"}, "contentHash": "", "items": [...]}. One item per designed surface with:
   - id: "surface:<type>:<slug>" — lowercase, stable; type must be one of: marketing, docs, dashboard, admin, playground, explorer, report, vscode, jetbrains, zed, lsp, cli, tui, email, notification, github-action, github-app, mcp, api-docs, sdk-docs, registry, build-plugin, lint-plugin, desktop, macos, browser-extension, other
   - surfaceType (same value as the id's type segment), name, entry {kind: route|command|panel|view|extension-point|email-template|mcp-tool|api-doc|generated-artifact|bin|config-file, value}, purpose, audience[]
   - status: "planned", or "unknown" if you cannot tell whether it shipped
   - views[] with states, components[], dataNeeds[], actions[], interactions[], outboundLinks[]
   - binds: [] — leave EMPTY rather than guess repo capability ids you have not been given
   - placement {current: "<where you assume it lives>", verdict: "unknown"}
   - provenance {source: "<where in this project the design lives>", evidence: [], confidence: high|medium|low}
2. surfaces.planned.generated.md — human-readable walkthrough of every exported surface.
3. capabilities.planned.json — REQUIRED if the design implies ANY backend/API/data/email/LSP/CLI/TUI behavior you were not told exists: one item per implied capability (id "cap:<kind>:<slug>"; kind one of: route, query, mutation, action, command, event, stream, entity, schema, service, package, config, extension-api, email-contract, lsp-method, diagnostic, webhook, job, queue-job, mcp-tool, check, rule, reporter, plugin-api, report, artifact) with surfaceArea, expected shape, why the design needs it, and confidence. Every capability also needs `reach`: "external" if something outside the repository can consume it directly (a route, a command, a published package, an MCP tool), "internal" if it can only be reached from inside (a database entity, an internal service, a job), "unknown" if you cannot tell. If truly nothing is implied, emit it with an empty items array and say so.
4. HANDOFF.md — (a) design decisions and rationale worth preserving, (b) every place you KNOW or suspect the design conflicts with repo reality, (c) invented/assumed backend behavior in prose, (d) parts of the design you consider stale or superseded, (e) open questions ONLY where genuinely necessary — prefer stating an assumption you made over asking.

RULES

- Do not omit surfaces because they seem obvious, small, or unfinished.
- Do not invent NEW design in this export; export what exists in this project.
- Never guess bindings to repo internals; unknown is a valid, preferred answer over a wrong guess.
- Valid JSON, stable ids, one item per surface. Engineering will validate mechanically and bounce malformed output back to you. Leave contentHash as an empty string — engineering stamps it on ingest.
