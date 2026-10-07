---
"product-map": patch
---

The Drizzle schema adapter emits one entity per table instead of one per schema module, reading `pgTable`/`mysqlTable`/`sqliteTable` and `pgSchema(...).table(...)` declarations, with `purpose` taken from the JSDoc on the declaring export.
Schema receivers resolve through lexical bindings, so nested variables, parameters, and classes cannot hide unrelated tables or create false schema-qualified entities.
This rekeys Drizzle entities from `cap:entity:<package>-<module>` to `cap:entity:<package>.<table>`: regenerate with `pmap all`, and update any `overrides`, `binds`, or planned-manifest references keyed on the old ids (`pmap doctor` reports stale override and bind keys).
