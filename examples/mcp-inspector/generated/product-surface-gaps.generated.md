<!-- generated from maps/map.existing.json@577cae2b2b0f74e440708f4ed2edfe8246d67e3914579b641387a02956a82af5 — do not edit -->

# mcp-inspector — gaps and follow-ups

Stance: **derived** · Commit: `ac3c1a122a5e` (clean) · Generator: pmap@0.0.0 · Items: 5

## 1. Misplaced — move these to their canonical package

Nothing misplaced detected.

## 2. Unbound surfaces — declare what powers them

These surfaces have no capability bindings. Either the extractor cannot see the wiring (emit curated binds from `extract.local.mjs`) or the surface genuinely fronts nothing.

- `surface:cli:mcp-inspector` (cli, live).
- `surface:mcp:inspector-server` (mcp, live). Likely matches: `cap:package:inspector-server` (0.6).

## 3. Orphan capabilities — nothing surfaces these

Split by reach and grouped by kind. 0 internal capabilities are unexposed by construction and not listed.

### Confirmed externally consumable — decide how they are exposed

None: nothing observed as externally consumable is unexposed.

### Reach undetermined — record it, or report the adapter gap

None: every unbound capability has an observed reach.

## 4. Absent surface types worth considering

- **docs** — no rendered docs surface was detected
- **marketing** — no marketing surface was detected
- **email** — no email surface was detected

## 5. Next step

Author or export the planned stance (Claude Design Case A/B prompts in `prompts/`), drop `surfaces.planned.json` beside the existing manifests, and re-run `pmap all` — the planned-vs-existing map, diffs, and reconciliation plan light up from there.
