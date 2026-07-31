# Reconcile — Claude Code pass after Claude Design manifests arrive

Use this prompt in a Claude Code session inside the target repo after pasting the design-side output (surfaces.planned.json, optional capabilities.planned.json, HANDOFF.md) into `docs/reference/product-map/`. Replace `<REPO>` before sending.

---

Reconcile the planned product-map manifests in docs/reference/product-map/ against repo reality for <REPO>. Follow this sequence exactly and do not skip the gates:

1. INGEST. The pasted planned manifests have an empty contentHash. Run finalize (sort items, stamp contentHash) and then `pmap validate` on every planned manifest. If validation fails, STOP: produce a bounce report listing every issue (path + message) formatted so I can paste it back into the Claude Design project for correction. Do not hand-fix design content beyond mechanical JSON repairs (trailing commas, key order); content errors belong to the design side.
2. EXTRACT. Run `pmap extract` (or refresh it if current) so surfaces.existing.json and capabilities.existing.json reflect HEAD. Record the commit.
3. MAP. Run the cross-stance joins: planned surfaces vs existing capabilities (the money file), and existing surfaces vs planned capabilities. For every planned surface classify: bound, bound-proposed, bound-conflict, or surface-unbound (when the surface names a capability that does not exist, keep the capabilityId on the entry and emit a planned-capability stub for it). Every existing capability no planned surface references is capability-unbound. Never bind on fuzzy matches — record candidates with score and reason and leave the binding unresolved.
4. DIFF. Run same-kind diffs across stances (surfaces.diff.json, capabilities.diff.json). Field-level changes, rename lineage only where evidence supports it.
5. PLACEMENT. Apply the repo's canonical-placement rules; emit misplaced-capability / surface-packaging-gap findings (e.g. email templates living inside a web app).
6. DOCTRINE GATE. Where the design contradicts recorded architecture decisions (ADRs, END-STATE docs, layer rules), flag doctrine-conflict for me. Do NOT auto-resolve these.
7. RENDER. `pmap render` all generated markdown, then write generated/reconciliation-plan.generated.md: implementation waves ordered missing capabilities first (surface-unbound entries that name a capabilityId), then surface builds, then packaging moves; every wave item must cite the map/diff entries that justify it; include a "not doing / needs owner decision" section for doctrine conflicts and low-confidence findings.
8. REPORT. Summarize for me: counts per relationship category, the top backend gaps, the top design gaps, any doctrine conflicts, and exactly what you wrote where. Do not commit anything — I review first.

Hard rules: write only inside docs/reference/product-map/; never modify product source in this pass; unknown is a valid state — never guess silently; if any step's inputs are stale (contentHash mismatch), stop and re-run the earlier step instead of proceeding.
