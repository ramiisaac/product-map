---
"product-map": patch
---

Implicit bindings now respect the final, post-override status: a capability overridden to `absent` is no longer bound by containment, and inferred bindings to it are pruned before declared bindings apply, so an explicit declaration still surfaces as a genuine conflict. `pmap bundle` no longer rewrites the template's "replace the placeholder" instruction into a false sentence naming the repository, and substitutes the repository name literally. `pmap doctor` notes surfaces whose views include a catch-all route segment, which may serve more pages than the view list shows.
