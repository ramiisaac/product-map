<!-- generated from maps/map.existing.json@577cae2b2b0f74e440708f4ed2edfe8246d67e3914579b641387a02956a82af5 — do not edit -->

# mcp-inspector — surface ↔ capability map

Stance: **derived** · Commit: `ac3c1a122a5e` (clean) · Generator: pmap@0.1.1 · Items: 5

## Relationship counts

| Relationship | Count | Meaning |
| ------------ | ----- | ------- |
| bound | 3 | surface is backed by a capability that exists |
| surface-unbound | 2 | surface declares no capability, or names one that does not exist |

## surface-unbound (2)

- `surface:cli:mcp-inspector` — No declared capability bindings; candidates are proposals only.
- `surface:mcp:inspector-server` — No declared capability bindings; candidates are proposals only. Candidates: `cap:package:inspector-server` (0.6).

## bound (3)

<details><summary>Show all 3</summary>

- `surface:cli:mcp-inspector-cli` ↔ `cap:package:inspector-cli` — bin declared by this package
- `surface:cli:mcp-inspector-client` ↔ `cap:package:inspector-client` — bin declared by this package
- `surface:cli:mcp-inspector-server` ↔ `cap:package:inspector-server` — bin declared by this package

</details>
