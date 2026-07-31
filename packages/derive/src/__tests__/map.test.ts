import type { CapabilityManifest, SurfaceManifest } from "@product-map/spec";
import { finalizeManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { mapManifests, createDeriveContext } from "..";

const deriveContext = createDeriveContext({ name: "pmap", version: "0.0.0" });

function manifests(capabilityStatus: CapabilityManifest["items"][number]["status"] = "live"): {
  surfaces: SurfaceManifest;
  capabilities: CapabilityManifest;
} {
  const generatedFrom = { commit: "0123456789abcdef", workingTree: "clean" as const, sources: ["fixture"] };
  return {
    surfaces: finalizeManifest<SurfaceManifest>({
      schemaVersion: "product-map.v1",
      kind: "surface",
      stance: "existing",
      scope: "fixture",
      generatedFrom,
      generator: { name: "manual", version: "1.0.0" },
      items: [
        {
          id: "surface:dashboard:fixture",
          surfaceType: "dashboard",
          name: "Fixture",
          entry: { kind: "route", value: "/" },
          purpose: "Show fixture records.",
          audience: ["developer"],
          status: "live",
          binds: [{ capabilityId: "cap:query:records", via: "explicit" }],
          placement: { current: "apps/web", verdict: "correct" },
          provenance: { source: "fixture", evidence: [], confidence: "high" },
        },
      ],
    }),
    capabilities: finalizeManifest<CapabilityManifest>({
      schemaVersion: "product-map.v1",
      kind: "capability",
      stance: capabilityStatus === "planned" ? "planned" : "existing",
      scope: "fixture",
      generatedFrom,
      generator: { name: "manual", version: "1.0.0" },
      items: [
        {
          id: "cap:query:records",
          kind: "query",
          name: "records",
          surfaceArea: "api",
          status: capabilityStatus,
          reach: "external",
          placement: { current: "packages/api", verdict: "correct" },
          provenance: { source: "fixture", evidence: [], confidence: "high" },
        },
      ],
    }),
  };
}

describe("map contracts", () => {
  it("keeps a compatible binding supported", () => {
    const { surfaces, capabilities } = manifests();
    expect(mapManifests(surfaces, capabilities, deriveContext).items).toContainEqual(
      expect.objectContaining({ relationship: "bound" }),
    );
  });

  it.each(["absent", "deprecated"] as const)("reports a live surface over a %s capability as a conflict", (status) => {
    const { surfaces, capabilities } = manifests(status);
    expect(mapManifests(surfaces, capabilities, deriveContext).items).toContainEqual(
      expect.objectContaining({ relationship: "bound-conflict" }),
    );
  });

  it("reports a live surface over a planned capability as a conflict", () => {
    const { surfaces, capabilities } = manifests("planned");
    expect(mapManifests(surfaces, capabilities, deriveContext).items).toContainEqual(
      expect.objectContaining({ relationship: "bound-conflict" }),
    );
  });

  it("rejects manifests from different repositories", () => {
    const { surfaces, capabilities } = manifests();
    capabilities.scope = "other";
    expect(() => mapManifests(surfaces, capabilities, deriveContext)).toThrow(/different scopes/);
  });
});

describe("reach", () => {
  it("notes that an unreferenced internal capability is unexposed by construction", () => {
    const { surfaces, capabilities } = manifests();
    const withInternal = finalizeManifest<CapabilityManifest>({
      ...capabilities,
      items: [
        ...capabilities.items,
        {
          id: "cap:entity:record",
          kind: "entity",
          name: "record",
          surfaceArea: "db",
          status: "live",
          reach: "internal",
          placement: { current: "packages/db", verdict: "correct" },
          provenance: { source: "fixture", evidence: [], confidence: "high" },
        },
      ],
    });
    const map = mapManifests(surfaces, withInternal, deriveContext);
    const entry = map.items.find((e) => e.capabilityId === "cap:entity:record");

    expect(entry?.relationship).toBe("capability-unbound");
    expect(entry?.note).toContain("not externally consumable");
  });

  it("does not soften the note for an unreferenced capability of unknown reach", () => {
    const { surfaces, capabilities } = manifests();
    const orphaned = finalizeManifest<CapabilityManifest>({
      ...capabilities,
      items: [
        ...capabilities.items,
        {
          id: "cap:package:mystery",
          kind: "package",
          name: "mystery",
          surfaceArea: "sdk",
          status: "live",
          reach: "unknown",
          placement: { current: "packages/mystery", verdict: "correct" },
          provenance: { source: "fixture", evidence: [], confidence: "low" },
        },
      ],
    });
    const map = mapManifests(surfaces, orphaned, deriveContext);
    const entry = map.items.find((e) => e.capabilityId === "cap:package:mystery");

    expect(entry?.note).not.toContain("not externally consumable");
  });
});

describe("bound-conflict", () => {
  it("records why the two sides disagree rather than encoding it in the relationship", () => {
    const { surfaces, capabilities } = manifests("deprecated");
    const map = mapManifests(surfaces, capabilities, deriveContext);
    const entry = map.items.find((e) => e.capabilityId === "cap:query:records");

    expect(entry?.relationship).toBe("bound-conflict");
    expect(entry?.note).toBe("surface is live but the capability behind it is deprecated");
  });
});
