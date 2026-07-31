import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ADDITIVE_VOCABULARIES,
  CAPABILITY_ID_GRAMMAR,
  SURFACE_ID_GRAMMAR,
  VOCABULARY_VALUE_GRAMMAR,
  relaxForReaders,
} from "../json-schema";
import {
  CapabilityManifestSchema,
  DiffManifestSchema,
  FleetManifestSchema,
  MapManifestSchema,
  SurfaceManifestSchema,
} from "../manifest";
import { SURFACE_TYPES } from "../vocab";

const emitted = [
  ["surface", SurfaceManifestSchema],
  ["capability", CapabilityManifestSchema],
  ["map", MapManifestSchema],
  ["diff", DiffManifestSchema],
  ["fleet", FleetManifestSchema],
] as const;

function relaxed(schema: z.ZodTypeAny): Record<string, unknown> {
  return relaxForReaders(z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" })) as Record<string, unknown>;
}

function collect(node: unknown, key: string, found: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const entry of node) {
      collect(entry, key, found);
    }
    return found;
  }
  if (node === null || typeof node !== "object") {
    return found;
  }
  for (const [name, value] of Object.entries(node)) {
    if (name === key) {
      found.push(value);
    }
    collect(value, key, found);
  }
  return found;
}

function findByPath(root: Record<string, unknown>, path: readonly string[]): Record<string, unknown> {
  let node: unknown = root;
  for (const segment of path) {
    node = (node as Record<string, unknown>)[segment];
  }
  return node as Record<string, unknown>;
}

describe("emitted JSON Schemas — reader tolerance", () => {
  for (const [name, schema] of emitted) {
    it(`${name} interpolates no vocabulary into any pattern`, () => {
      const patterns = collect(relaxed(schema), "pattern");
      expect(patterns.length).toBeGreaterThan(0);
      for (const pattern of patterns) {
        expect(pattern).not.toContain("route|query");
        expect(pattern).not.toContain("marketing|docs");
      }
      const serialized = JSON.stringify(relaxed(schema));
      expect(serialized).not.toContain("route|query");
      expect(serialized).not.toContain("marketing|docs");
    });

    it(`${name} relaxes every additive vocabulary enum away`, () => {
      const enums = collect(relaxed(schema), "enum") as string[][];
      for (const values of enums) {
        expect(values).not.toContain("marketing");
        expect(values).not.toContain("agent-subagent");
        expect(values).not.toContain("bound-proposed");
      }
    });
  }

  it("relaxes id patterns to the id grammar only", () => {
    const surface = relaxed(SurfaceManifestSchema);
    expect(findByPath(surface, ["properties", "items", "items", "properties", "id"])).toEqual({
      pattern: SURFACE_ID_GRAMMAR,
      type: "string",
    });
    const capability = relaxed(CapabilityManifestSchema);
    expect(findByPath(capability, ["properties", "items", "items", "properties", "id"])).toEqual({
      pattern: CAPABILITY_ID_GRAMMAR,
      type: "string",
    });
  });

  it("relaxes an additive vocabulary field to a documented pattern", () => {
    const surfaceType = findByPath(relaxed(SurfaceManifestSchema), [
      "properties",
      "items",
      "items",
      "properties",
      "surfaceType",
    ]);
    expect(surfaceType["type"]).toBe("string");
    expect(surfaceType["pattern"]).toBe(VOCABULARY_VALUE_GRAMMAR);
    expect(surfaceType["enum"]).toBeUndefined();
    expect(surfaceType["description"]).toContain("known values:");
    expect(surfaceType["description"]).toContain("marketing");
    expect(surfaceType["description"]).toContain("other");
  });

  it("relaxes a vocabulary used as record keys", () => {
    const byKind = findByPath(relaxed(FleetManifestSchema), [
      "properties",
      "items",
      "items",
      "properties",
      "capabilitiesByKind",
      "propertyNames",
    ]);
    expect(byKind["enum"]).toBeUndefined();
    expect(byKind["pattern"]).toBe(VOCABULARY_VALUE_GRAMMAR);
  });

  it("keeps every additive vocabulary value inside the relaxed grammar", () => {
    const grammar = new RegExp(VOCABULARY_VALUE_GRAMMAR);
    for (const [name, members] of ADDITIVE_VOCABULARIES) {
      for (const member of members) {
        expect(`${name}:${member}`).toBe(`${name}:${grammar.test(member) ? member : "<outside the grammar>"}`);
      }
    }
  });

  it("keeps an existing description when relaxing", () => {
    const node = relaxForReaders({ enum: [...SURFACE_TYPES], type: "string", description: "What it is." }) as Record<
      string,
      unknown
    >;
    expect(node["description"]).toBe(
      `What it is. product-map.v1 surfaceType; known values: ${SURFACE_TYPES.join(", ")}`,
    );
  });

  it("keeps the structural vocabularies closed", () => {
    const surface = relaxed(SurfaceManifestSchema);
    expect(findByPath(surface, ["properties", "stance"])["enum"]).toEqual(["existing", "planned", "derived"]);
    expect(findByPath(surface, ["properties", "kind"])["const"]).toBe("surface");
    expect(findByPath(surface, ["properties", "schemaVersion"])["const"]).toBe("product-map.v1");
    expect(findByPath(surface, ["properties", "generatedFrom", "properties", "workingTree"])["enum"]).toEqual([
      "clean",
      "dirty",
      "not-applicable",
    ]);
  });
});
