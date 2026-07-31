<!-- generated index for the product-map directory — do not edit -->

# mcp-inspector — product map

Extracted at commit `ac3c1a122a5e` (clean tree) by pmap@0.1.1.

- **5 surfaces** across 2 types — [inventory](./surfaces.existing.generated.md)
- **3 capabilities** across 1 kinds — [inventory](./capabilities.existing.generated.md)
- **Map**: 3 bound · 2 surface-unbound — [details](./map.existing.generated.md), [gaps report](./product-surface-gaps.generated.md)
- **Planned stance**: not yet authored — run the Claude Design prompts in this repo's prompts/ (or product-map's) to produce surfaces.planned.json

## Files

| File | What it is |
| ---- | ---------- |
| `surfaces.existing.json` | machine-readable surface inventory (source of truth) |
| `capabilities.existing.json` | machine-readable capability inventory (source of truth) |
| `maps/map.existing.json` | surface ↔ capability join with relationship classification |
| `generated/*.generated.md` | human-readable renderings of the JSON (never edit) |

Regenerate with `pmap all --repo <this repo>`; verify freshness with `pmap check-fresh`.
