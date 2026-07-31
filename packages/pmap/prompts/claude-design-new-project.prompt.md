# Case A — New Claude Design project from repo reality

Paste everything below into a NEW hosted Claude Design project, attaching or pasting the launch bundle files where indicated. Replace `<REPO>` before sending.

---

You are starting a NEW design project for the repository "<REPO>". You are being given a deterministic snapshot of repo reality — the launch bundle attached/pasted below. Treat it as ground truth about what exists today. Your design work has TWO deliverables of equal importance: the design itself, and a machine-readable planned manifest that engineering will validate, map against existing capabilities, and diff against existing surfaces.

LAUNCH BUNDLE

1. surfaces.existing.generated.md — every product surface that exists today, with status and evidence.
2. capabilities.existing.generated.md — every backend/package/API/CLI/LSP/email/job capability, with status.
3. map.existing.generated.md — how existing surfaces bind to existing capabilities, including orphan capabilities no surface exposes yet (these are free wins: design for them before inventing new ones).
4. surface-gaps.generated.md — gaps engineering already knows about.
5. Product doctrine and design constraints.
6. Package/app structure and public API surface.

RULES

- Surfaces are not only web. CLI commands, TUI screens, LSP features, VS Code/JetBrains/Zed views, emails, notifications, GitHub Action/PR outputs, MCP tools, generated reports, and docs pages are all surfaces. Design (or explicitly decline) each relevant surface type, not just routes.
- You may invent new capabilities, but NEVER silently. Every designed feature that is not supported by an existing capability in the bundle MUST appear in capabilities.planned.json with status "planned" and a note on what it implies (API route, DB entity, email contract, LSP method, etc.).
- Prefer surfacing orphan capabilities over inventing near-duplicates. If you redesign an existing surface, keep its id and mark what changes; do not mint a new id for the same thing.
- Mark uncertainty honestly: confidence "low" and status "unknown" are valid and better than guesses.

DELIVERABLES (emit all four at the end, each as a complete fenced code block)

1. surfaces.planned.json — envelope: {"schemaVersion": "product-map.v1", "kind": "surface", "stance": "planned", "scope": "<REPO>", "generatedFrom": {"commit": null, "workingTree": "not-applicable", "sources": ["<this design project>"]}, "generator": {"name": "claude-design", "version": "hosted"}}. Every designed surface as an item: id ("surface:<type>:<slug>"), surfaceType, name, entry {kind, value}, purpose, audience, status "planned" (or "live"/"partial" if you are keeping an existing surface as-is), views with states, components, dataNeeds, actions, interactions, outboundLinks, binds — referencing EXISTING capability ids from the bundle wherever the capability already exists, and planned capability ids where you invented one — placement, and provenance (source = your design rationale location; confidence reflects how settled the design is).
2. capabilities.planned.json — every capability you invented or materially assume, same envelope with kind "capability". Include kind, surfaceArea, expected inputs/outputs, and why the design needs it. Every capability also needs `reach`: "external" if something outside the repository can consume it directly (a route, a command, a published package, an MCP tool), "internal" if it can only be reached from inside (a database entity, an internal service, a job), "unknown" if you cannot tell.
3. surfaces.planned.generated.md — a human-readable walkthrough of the planned surfaces (per surface: purpose, key views/states/flows, what it binds to, what is new).
4. HANDOFF.md — design rationale, decisions taken, known tensions with repo reality, and open questions ONLY where the answer genuinely requires the maintainer (do not ask about things the bundle answers).

Validation note: engineering will run schema validation, mapping, and diffing on your JSON. Malformed JSON, ids that do not follow the grammar, or binds pointing at nonexistent capability ids will bounce back to you, so check them before finishing. Leave contentHash as an empty string — engineering stamps it on ingest.
