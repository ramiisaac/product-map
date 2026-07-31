# @product-map/spec

The runtime and type contract for `product-map.v1` manifests. It provides Zod schemas, identifier validation, canonical JSON serialization, SHA-256 content hashing, and helpers for finalizing and validating manifests.

```bash
pnpm add @product-map/spec
```

```ts
import { finalizeManifest, validateManifest } from "@product-map/spec";
```

Emitted JSON Schemas are included in the package under `schemas/`. See the [normative specification](https://github.com/ramiisaac/product-map/blob/main/docs/SPEC.md). MIT licensed.
