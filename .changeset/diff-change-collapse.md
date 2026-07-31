---
"product-map": minor
"@product-map/spec": minor
---

Pre-release contract change to product-map.v1, made now precisely because nothing has shipped against it: the diff change vocabulary collapses from 13 values to 4 (`added`, `removed`, `changed`, `renamed`). The seven category values (`status-changed`, `shape-changed`, `route-changed`, `copy-changed`, `state-coverage-changed`, `interaction-changed`, `binding-changed`) were lossy restatements of the `fieldChanges` JSON pointers each entry already carries, and `split`/`merged` had no producer. `renamed` gains its first real producer: a `renames` field in `product-map.config.mjs` that `diff` consumes deterministically, emitting one `renamed` entry with cross-item `fieldChanges` when the declared pair matches present-and-absent on the two sides, and falling back to `added`/`removed` with a stderr warning otherwise. Capability diffs now also cover `reach`, and the diff field lists are compile-time checked against the item schemas so a future field cannot silently escape diffing.
