---
name: pmap-review
description: This skill should be used when the user asks to "review the product map", "audit product-map output", "does the product map capture everything", "check product-map fidelity", or suspects manifests miss or fabricate what the repo actually ships.
allowed-tools: ["Bash", "Read", "Grep", "Glob", "Task"]
---

# /product-map:review — fidelity audit against repo reality

Adversarially verify that the manifests fully and truthfully capture the repo. The output is a findings report — do not fix anything without the user's go-ahead.

## Method

1. **Freshness precondition.** Run `pnpm exec pmap check-fresh --repo .`; auditing stale manifests wastes the whole pass. If stale, refresh first (with the user's consent).
2. **Read the manifests** (`surfaces.existing.json`, `capabilities.existing.json`, `maps/map.existing.json`) and build an expectation list from the repo itself: package.json bins and scripts, command registration sites (dirs AND code-registered dispatch), route trees, MCP tool declarations, email templates, DB schemas/migrations, editor extension manifests, worker/service entrypoints, docs/marketing apps.
3. **Hunt both failure modes:**
   - **Misses** — things the repo ships that no item records (code-registered commands, single-file tool modules, scoped packages excluded by scope rules, surfaces with zero binds that actually front many capabilities).
   - **Fabrications** — items that do not correspond to product reality (helper files minted as commands, vendored/template trees leaking in, duplicate ids shadowing real items).
4. **Check the map**: unbound surfaces and orphan capabilities in `maps/map.existing.json` are the cheapest fidelity signals — verify each unbound surface truly fronts nothing.
5. For a large repo, delegate scoped read-only sweeps to subagents (one per subsystem), instructing them: read-only, no build/typecheck/lint/test/git commands, no nested subagents.
6. **Report** findings ranked by severity, each with evidence paths, and the recommended remedy per finding: `extract.local.mjs` (emit/enrich items — see the pmap-guide-extractors skill), `product-map.config.mjs` (rules/overrides), or an upstream pmap adapter gap worth reporting to the product-map repo owner.
