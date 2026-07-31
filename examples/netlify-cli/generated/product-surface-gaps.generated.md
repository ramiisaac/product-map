<!-- generated from maps/map.existing.json@5bd4de2e3d6e67d10c6637766d158f73e71d952d5c33a3e4225dbd0dbf342aff — do not edit -->

# netlify-cli — gaps and follow-ups

Stance: **derived** · Commit: `f214e69e4d8b` (clean) · Generator: pmap@0.1.1 · Items: 30

## 1. Misplaced — move these to their canonical package

Nothing misplaced detected.

## 2. Unbound surfaces — declare what powers them

These surfaces have no capability bindings. Either the extractor cannot see the wiring (emit curated binds from `extract.local.mjs`) or the surface genuinely fronts nothing.

- `surface:cli:ntl` (cli, live).

## 3. Orphan capabilities — nothing surfaces these

Split by reach and grouped by kind. 0 internal capabilities are unexposed by construction and not listed.

### Confirmed externally consumable — decide how they are exposed

Something outside this repository can consume these, and no surface fronts them. Front them and declare the bind, or stop distributing them.

- **package** (1): `cap:package:cli-docs-site`

### Reach undetermined — record it, or report the adapter gap

None: every unbound capability has an observed reach.

## 4. Absent surface types worth considering

- **docs** — no rendered docs surface was detected
- **marketing** — no marketing surface was detected
- **mcp** — no MCP server was detected — agent-facing repos usually want one
- **email** — no email surface was detected

## 5. Next step

Author or export the planned stance (Claude Design Case A/B prompts in `prompts/`), drop `surfaces.planned.json` beside the existing manifests, and re-run `pmap all` — the planned-vs-existing map, diffs, and reconciliation plan light up from there.
