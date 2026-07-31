---
"product-map": minor
"@product-map/spec": minor
---

Extraction is now fault-isolated per adapter: an adapter that throws is recorded, reported on stderr and by `pmap doctor` as `adapter-failure`, and the remaining adapters still run — only the repo-local extractor keeps its deliberate fail-closed behavior. Config mistakes are louder: an `overrides` key naming an id that was not extracted is reported through `doctor` as a config error instead of vanishing, an invalid `canonicalPlacements.where` pattern fails with an error naming the config file, and `CanonicalPlacementRule.kinds` is narrowed from bare strings to the surface-type and capability-kind vocabularies so a typo fails to compile. Doctor also stops crying wolf: two adapters describing the same item (the designed enrichment path) is now a note, not a warning, while one adapter colliding with itself and cross-confidence collisions stay warnings. `ExtractResult` gains a required `adapterIssues` field and `SkippedItem` an optional collision record — type-level changes for consumers of `@product-map/spec`, made pre-release.
