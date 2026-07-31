<!-- generated from maps/map.existing.json@a3d1eb99f467d233565522390bb26552641c119a3b2af2ee1cebc4413f30e4cf — do not edit -->

# shadcn-ui — gaps and follow-ups

Stance: **derived** · Commit: `4baadbc65170` (clean) · Generator: pmap@0.1.1 · Items: 25

## 1. Misplaced — move these to their canonical package

Nothing misplaced detected.

## 2. Unbound surfaces — declare what powers them

These surfaces have no capability bindings. Either the extractor cannot see the wiring (emit curated binds from `extract.local.mjs`) or the surface genuinely fronts nothing.

- `surface:mcp:shadcn` (mcp, live). Likely matches: `cap:command:shadcn.mcp` (0.5).

## 3. Orphan capabilities — nothing surfaces these

Split by reach and grouped by kind. 0 internal capabilities are unexposed by construction and not listed.

### Confirmed externally consumable — decide how they are exposed

Something outside this repository can consume these, and no surface fronts them. Front them and declare the bind, or stop distributing them.

- **package** (2): `cap:package:helpers`, `cap:package:react`

### Reach undetermined — record it, or report the adapter gap

None: every unbound capability has an observed reach.

## 4. Absent surface types worth considering

- **docs** — no rendered docs surface was detected
- **marketing** — no marketing surface was detected
- **email** — no email surface was detected

## 5. Next step

Author or export the planned stance (Claude Design Case A/B prompts in `prompts/`), drop `surfaces.planned.json` beside the existing manifests, and re-run `pmap all` — the planned-vs-existing map, diffs, and reconciliation plan light up from there.
