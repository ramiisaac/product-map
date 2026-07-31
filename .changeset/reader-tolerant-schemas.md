---
"product-map": minor
"@product-map/spec": minor
---

The emitted JSON Schemas are now reader-tolerant: id patterns validate the id grammar instead of enumerating the vocabularies, and additive vocabulary enums are relaxed to a value-grammar pattern with the known values documented in the description. This makes the v1 compatibility promise — vocabulary additions are backward compatible — true for readers holding vendored schemas, not just for writers. Structural vocabularies (manifest kind, stance, working-tree state, schema version) stay closed. The Zod schemas inside the tool remain strict. `CAPABILITY_KINDS` gains an `other` escape hatch with default reach `unknown`, and `RepoConfig.overrides` is now typed as a union of the two item shapes so capability-only statuses like `deprecated` type-check in consumer configs.
