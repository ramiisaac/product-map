/**
 * Projects the Zod manifest schemas to JSON Schema and prints the resulting
 * artifacts to stdout as `[{ path, content }]`. Writing is deliberately not
 * done here: scripts/generate.mjs owns it, along with drift-checking and
 * staging, so every generated file in the repo goes through one mechanism.
 */
import { z } from "zod";

import { canonicalStringify } from "../src/canonical";
import { relaxForReaders } from "../src/json-schema";
import {
  CapabilityManifestSchema,
  DiffManifestSchema,
  FleetManifestSchema,
  MapManifestSchema,
  SurfaceManifestSchema,
} from "../src/manifest";

const targets: Array<[string, z.ZodTypeAny]> = [
  ["surface-manifest", SurfaceManifestSchema],
  ["capability-manifest", CapabilityManifestSchema],
  ["map-manifest", MapManifestSchema],
  ["diff-manifest", DiffManifestSchema],
  ["fleet-manifest", FleetManifestSchema],
];

const artifacts = targets.map(([name, schema]) => ({
  path: `packages/spec/schemas/${name}.schema.json`,
  content: canonicalStringify({
    $id: `https://product-map.dev/schemas/product-map.v1/${name}.schema.json`,
    ...(relaxForReaders(z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" })) as Record<string, unknown>),
  }),
}));

process.stdout.write(JSON.stringify(artifacts));
