---
"product-map": minor
"@product-map/spec": minor
---

Reduce map relationships to five, and give capabilities a `reach`.

`MAP_RELATIONSHIPS` is now `bound`, `bound-proposed`, `bound-conflict`, `surface-unbound`, and `capability-unbound`. Every value describes the link between a surface and a capability and nothing else. The thirteen it replaces encoded three other things: the stance, which the manifest envelope already records; item-level facts, which `placement.verdict` and `reach` carry on the item itself; and two values reserved for hand annotation of a file that `pmap map` rewrites on every run, so no annotation could survive.

Nothing is lost. A `surface-unbound` entry that carries a `capabilityId` named a capability that does not exist; without one it declared no binding at all. An unreferenced capability is a design gap or an exposure gap depending on the manifest's stance. Misplacement is read from the items, where it was always recorded.

`CapabilityItem` gains a required `reach`: `external`, `internal`, or `unknown` — whether anything outside the repository can consume the capability directly. It is independent of `status`, the same way placement is, so an unpublished package is now `status: live` + `reach: internal` rather than being mislabelled `status: preview`. Adapters default it from the capability's kind through `DEFAULT_REACH` and override where they observe better. This is what makes an unreferenced capability worth reading: unreferenced-and-unreachable is expected, unreferenced-and-published is a finding, and `digest`, `doctor`, and the gaps report now report only the second.

The non-product directory filter also matched scaffolding words only as whole path segments, so `__fixtures__` and `functions-templates` were extracted as product. Matching is now on a suffix and tolerates surrounding underscores, while a product whose name merely contains the word — `templates-engine` — is untouched.

Upgrading: `reach` is required, so a repository-local `extract.local.mjs` that emits capabilities must set it. Extraction fails closed on the missing field rather than guessing.
