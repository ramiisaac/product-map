---
name: pmap-design-handoff
description: This skill should be used when the user asks to "prepare a launch bundle", "hand off to Claude Design", "assemble a design bundle", "ingest a design", "reconcile a design export", mentions Case A / Case B prompts, surfaces.planned.json, or a reconciliation plan. Covers the full loop: repo reality bundle out to hosted Claude Design, planned manifests back in, reconciliation plan generated.
---

# The Claude Design handoff loop

The design handoff is one of product-map's use cases — the map also serves plain CLI inspection, planning, CI freshness gating, and fleet views — and this skill covers that one loop: (1) assemble a repo-reality bundle and paste it into a hosted Claude Design project (Case A for never-designed repos, Case B to export an existing unsynchronized design project), (2) the designer returns `surfaces.planned.json` (+ optionally `capabilities.planned.json`), (3) `pmap ingest` validates them, (4) `pmap all` derives the planned-vs-existing map, diffs, and `generated/reconciliation-plan.generated.md` — the implementation queue. The prompt templates live in `docs/reference/product-map/prompts/` after `pmap init`.

## Outbound: the launch bundle (Case A)

Start with `pnpm exec pmap bundle --repo . > launch-bundle.md`. That gives you the Case A prompt with `<REPO>` substituted plus the rendered surface and capability inventories, deterministically, from the same extraction the manifests came from. Everything below is what you add on top of it by hand — the parts no tool can know. Structure that has worked across real engagements:

1. **The Case A prompt and generated inventories** — `pmap bundle` produces both.
2. **FILE 0 — designer brief** (hand-authored, the highest-leverage part): what the product IS, glossary, personas, user journeys, what exists today, the design ask/scope, and the CURRENT VISUAL IDENTITY with explicit intent framing ("keep, evolve, or replace — state which and why in HANDOFF.md; silence is an error").
3. **Specs/corpus** where the repo has them — include them verbatim; thin bundles undersell the product and produce shallow designs.
4. **Export & handoff requirements** — make the port mechanical, not interpretive:
   - Decompose: shadcn primitives BY NAME with real props → named composites with prop contracts → screens; emit a component inventory.
   - Frozen primitives: if the repo vendors shadcn primitives, say they are frozen — restyle via tokens + composition only.
   - Tokens in the repo's ACTUAL Tailwind idiom. For Tailwind v4 repos demand `@theme` variables (`--color-*`, `--font-*`, `--animate-*` + top-level `@keyframes`) and BAN v3 slots (bare `--background` channels, `hsl(var(--x))`, JS configs) — every v3-shaped export has required hand-translation. Verify the repo's `globals.css` before writing this section.
   - Export layout keyed to manifest ids: `design-export/{tokens.css, HANDOFF.md, components/<Name>.html, screens/<surface-or-view-id>.html, states/<screen>.<state>.html}`; `data-surface-id`/`data-view-id` on screen roots; `data-cap-id` on interactive elements.
   - HANDOFF.md mapping table (screen → surface/view id → composites → capability ids); annotate every faked interaction with the real capability id; no CDN deps; lucide icon names.
5. **The map and gaps renderings** — `generated/map.existing.generated.md` and `generated/product-surface-gaps.generated.md`, which `pmap bundle` does not include because they are only meaningful once `pmap all` has run.
6. **Prior-design gate**: if an earlier design project exists, make its Case B export a precondition, or require HANDOFF.md to record it was inaccessible.

**Standing step: resident-agent review.** Before pasting, have the repo's own agent review the bundle for factual errors — this has caught batches of wrong semantic claims every time it has run. Fix findings at the source (assembler/brief), never with a corrections appendix.

Rebuild the bundle whenever manifests regenerate — run `pmap bundle` right after `pmap all` so both reference the same extraction.

## Inbound: ingest and reconcile

1. Save the returned JSON to files (contentHash may be empty/absent — ingest stamps it).
2. `pnpm exec pmap ingest <files..> --repo .` — on failure it prints an `INGEST BOUNCE` report formatted for pasting back into the design project. Bounce it; do NOT hand-fix design content beyond mechanical JSON repair.
3. `pnpm exec pmap all --repo .` — derives maps, diffs, and the reconciliation plan.
4. Read `generated/reconciliation-plan.generated.md`: Wave 1 missing capabilities (build first), Wave 2 surface builds/changes with binding counts and blockage, Wave 3 packaging moves, Wave 4 exposure decisions (capabilities the design ignores), then needs-owner items (doctrine conflicts, low-confidence design claims). Report counts per relationship and the top gaps to the user — the plan is reviewed before anything is implemented.
5. Re-run `pmap all` after each implemented wave; done-conditions are falsifiable (no surface-unbound entry still names a missing capabilityId, empty scheduled diffs, no items left with placement.verdict misplaced).

The `/product-map:ingest` command automates steps 1–4.
