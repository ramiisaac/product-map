<!-- generated index for the product-map directory — do not edit -->

# netlify-cli — product map

Extracted at commit `f214e69e4d8b` (clean tree) by pmap@0.1.0.

- **2 surfaces** across 1 types — [inventory](./surfaces.existing.generated.md)
- **29 capabilities** across 2 kinds — [inventory](./capabilities.existing.generated.md)
- **Map**: 28 bound · 1 capability-unbound · 1 surface-unbound — [details](./map.existing.generated.md), [gaps report](./product-surface-gaps.generated.md)
- **Planned stance**: not yet authored — run the Claude Design prompts in this repo's prompts/ (or product-map's) to produce surfaces.planned.json

## Files

| File | What it is |
| ---- | ---------- |
| `surfaces.existing.json` | machine-readable surface inventory (source of truth) |
| `capabilities.existing.json` | machine-readable capability inventory (source of truth) |
| `maps/map.existing.json` | surface ↔ capability join with relationship classification |
| `generated/*.generated.md` | human-readable renderings of the JSON (never edit) |

Regenerate with `pmap all --repo <this repo>`; verify freshness with `pmap check-fresh`.
