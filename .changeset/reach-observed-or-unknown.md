---
"product-map": minor
"@product-map/spec": minor
---

Reach is now observed-or-unknown instead of guessed from kind priors. `DEFAULT_REACH` keeps `internal` only for the twelve kinds whose internality is definitional (entity, schema, service, config, diagnostic, job, queue-job, check, rule, reporter, report, artifact) and yields `unknown` for every context-dependent kind, honoring the spec's rule that tools never guess to avoid a first-class unknown. Adapters record `external` only where they observed distribution: the package adapter from `private`, the CLI command adapters from their owning package's publication, and the MCP, Claude-plugin, LSP, VS Code, and Supabase-functions adapters from manifests and deployment shapes that make the item reachable by construction. Committed manifests change where a prior was being stamped as fact — for example, extracted web-app route capabilities move from `external` to `unknown` unless something observes their exposure.
