<!-- generated from maps/map.existing.json@67e6afbd6ac8c75a24be0cccdb747878939145a02b80ed9b9bf6b542a63f4511 — do not edit -->

# product-map — surface ↔ capability map

Stance: **derived** · Commit: `88632aeb8038` (dirty) · Generator: pmap@0.0.0 · Items: 35

## Relationship counts

| Relationship | Count | Meaning |
| ------------ | ----- | ------- |
| bound | 27 | surface is backed by a capability that exists |
| capability-unbound | 7 | no surface references this capability |
| surface-unbound | 1 | surface declares no capability, or names one that does not exist |

## surface-unbound (1)

- `surface:registry:product-map` — No declared capability bindings; candidates are proposals only.

## capability-unbound (7)

- `cap:package:derive` — Not referenced by any surface, and not externally consumable.
- `cap:package:discovery` — Not referenced by any surface, and not externally consumable.
- `cap:package:emit` — Not referenced by any surface, and not externally consumable.
- `cap:package:engine` — Not referenced by any surface, and not externally consumable.
- `cap:package:extract` — Not referenced by any surface, and not externally consumable.
- `cap:package:runtime` — Not referenced by any surface, and not externally consumable.
- `cap:package:spec` — Not referenced by any surface binding.

## bound (27)

<details><summary>Show all 27</summary>

- `surface:agent-plugin:product-map` ↔ `cap:agent-skill:product-map.pmap-design-handoff` — shipped by the product-map plugin
- `surface:agent-plugin:product-map` ↔ `cap:agent-skill:product-map.pmap-guide-extractors` — shipped by the product-map plugin
- `surface:agent-plugin:product-map` ↔ `cap:agent-skill:product-map.pmap-guide-overview` — shipped by the product-map plugin
- `surface:agent-plugin:product-map` ↔ `cap:agent-skill:product-map.pmap-ingest` — shipped by the product-map plugin
- `surface:agent-plugin:product-map` ↔ `cap:agent-skill:product-map.pmap-refresh` — shipped by the product-map plugin
- `surface:agent-plugin:product-map` ↔ `cap:agent-skill:product-map.pmap-review` — shipped by the product-map plugin
- `surface:agent-plugin:product-map` ↔ `cap:agent-skill:product-map.pmap-setup` — shipped by the product-map plugin
- `surface:agent-plugin:product-map` ↔ `cap:agent-skill:product-map.pmap-validate` — shipped by the product-map plugin
- `surface:cli:pmap` ↔ `cap:command:pmap.all` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.bundle` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.check-fresh` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.diff` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.digest` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.doctor` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.explain` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.extract` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.fleet` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.ingest` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.init` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.map` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.render` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.show` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:command:pmap.validate` — declared in the pmap command registry
- `surface:cli:pmap` ↔ `cap:package:product-map` — bin declared by this package
- `surface:cli:product-map` ↔ `cap:package:product-map` — bin declared by this package
- `surface:github-action:product-map-freshness` ↔ `cap:command:pmap.check-fresh` — invoked by the Action's run block
- `surface:github-action:product-map-freshness` ↔ `cap:command:pmap.validate` — invoked by the Action's run block

</details>
