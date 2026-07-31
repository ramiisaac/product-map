import { describe, expect, it } from "vitest";

import { diagnose, renderDiagnosis } from "../doctor";
import { buildExplanation, renderExplanation } from "../explain";
import { buildShow, renderShow } from "../show";
import { capabilities, capability, map, surface, surfaces } from "./fixtures";

const mapping = map([
  { surfaceId: "surface:cli:fixture", capabilityId: "cap:command:fixture.scan", relationship: "bound" },
]);

describe("show", () => {
  it("summarises surfaces individually and capabilities by kind", () => {
    const data = buildShow({ surfaces: surfaces(), capabilities: capabilities(), map: mapping });

    expect(data.surfaces).toHaveLength(1);
    expect(data.capabilities).toEqual([{ kind: "command", count: 1, statuses: ["live"], paths: ["packages/cli"] }]);
    expect(renderShow(data)).toContain("surface:cli:fixture");
  });

  it("omits the map section when there is no map", () => {
    const data = buildShow({ surfaces: surfaces(), capabilities: capabilities(), map: null });

    expect(renderShow(data)).not.toContain("MAP");
  });
});

describe("explain", () => {
  it("resolves a surface to its provenance and binds", () => {
    const data = buildExplanation({
      id: "surface:cli:fixture",
      surfaces: surfaces(),
      capabilities: capabilities(),
      map: mapping,
    });

    expect(data?.kind).toBe("surface");
    expect(data?.provenance.source).toBe("packages/cli/package.json");
    expect(data?.binds).toEqual([{ capabilityId: "cap:command:fixture.scan", via: "explicit" }]);
    expect(renderExplanation(data as NonNullable<typeof data>)).toContain("WHY IT EXISTS");
  });

  it("resolves a capability to the surfaces that front it", () => {
    const data = buildExplanation({
      id: "cap:command:fixture.scan",
      surfaces: surfaces(),
      capabilities: capabilities(),
      map: mapping,
    });

    expect(data?.kind).toBe("capability");
    expect(data?.boundBy).toEqual(["surface:cli:fixture"]);
    expect(data?.relations).toEqual([{ relationship: "bound", counterpartId: "surface:cli:fixture" }]);
  });

  it("returns null for an unknown id instead of inventing an answer", () => {
    expect(
      buildExplanation({ id: "cap:command:absent", surfaces: surfaces(), capabilities: capabilities(), map: null }),
    ).toBeNull();
  });
});

describe("doctor", () => {
  function diagnosis(overrides: Partial<Parameters<typeof diagnose>[0]> = {}) {
    return diagnose({
      surfaces: surfaces(),
      capabilities: capabilities(),
      adaptersAvailable: ["bins", "cli-commands", "mcp"],
      adaptersRun: ["bins"],
      adaptersExcluded: [],
      skipped: [],
      localIssues: [],
      adapterIssues: [],
      ...overrides,
    });
  }

  it("separates the adapters that ran from the ones that stayed silent", () => {
    expect(diagnosis().adaptersSilent).toEqual(["cli-commands", "mcp"]);
  });

  it("surfaces the skipped array that extraction records and everything else discards", () => {
    const data = diagnosis({
      skipped: [{ adapter: "bins", id: "surface:cli:fixture", reason: "duplicate of root-script-cli" }],
    });

    expect(data.findings).toContainEqual(expect.objectContaining({ severity: "warning", code: "duplicate-id" }));
    expect(renderDiagnosis(data)).toContain("duplicate of root-script-cli");
  });

  it("treats two adapters describing one item at equal confidence as a note, not a warning", () => {
    const data = diagnosis({
      skipped: [
        {
          adapter: "bins",
          id: "surface:cli:fixture",
          reason: "superseded by cli-commands",
          collision: { winner: "cli-commands", resolvedBy: "richness" },
        },
      ],
    });

    expect(data.findings[0]?.severity).toBe("note");
    expect(data.findings[0]?.code).toBe("adapter-overlap");
  });

  it("keeps a collision between adapters of differing confidence a warning", () => {
    const data = diagnosis({
      skipped: [
        {
          adapter: "cli-commands",
          id: "surface:cli:fixture",
          reason: "duplicate of bins",
          collision: { winner: "bins", resolvedBy: "confidence" },
        },
      ],
    });

    expect(data.findings[0]?.severity).toBe("warning");
    expect(data.findings[0]?.code).toBe("duplicate-id");
  });

  it("warns with an adapter-scoped remedy when one adapter emitted the id twice", () => {
    const data = diagnosis({
      skipped: [
        {
          adapter: "bins",
          id: "surface:cli:fixture",
          reason: "superseded by bins",
          collision: { winner: "bins", resolvedBy: "same-adapter" },
        },
      ],
    });

    expect(data.findings[0]?.severity).toBe("warning");
    expect(data.findings[0]?.code).toBe("adapter-duplicate");
    expect(data.findings[0]?.remedy).toContain("adapters.exclude");
  });

  it("keeps a generic adapter losing to the local extractor a benign note", () => {
    const data = diagnosis({
      skipped: [
        {
          adapter: "bins",
          id: "surface:cli:fixture",
          reason: "superseded by local",
          collision: { winner: "local", resolvedBy: "local-authority" },
        },
      ],
    });

    expect(data.findings[0]?.severity).toBe("note");
    expect(data.findings[0]?.code).toBe("superseded");
  });

  it("warns when the local extractor emits the same id twice", () => {
    const data = diagnosis({
      skipped: [
        {
          adapter: "local",
          id: "surface:cli:fixture",
          reason: "superseded by local",
          collision: { winner: "local", resolvedBy: "local-duplicate" },
        },
      ],
    });

    expect(data.findings[0]?.severity).toBe("warning");
    expect(data.findings[0]?.code).toBe("duplicate-id");
  });

  it("reports an adapter that threw as a warning naming the workaround", () => {
    const data = diagnosis({ adapterIssues: [{ adapter: "bins", message: "boom" }] });

    expect(data.findings).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "adapter-failure", detail: "bins: boom" }),
    );
    expect(renderDiagnosis(data)).toContain("adapters.exclude");
  });

  it("does not call an adapter that threw silent", () => {
    const data = diagnosis({ adapterIssues: [{ adapter: "mcp", message: "boom" }] });

    expect(data.adaptersSilent).toEqual(["cli-commands"]);
  });

  it("treats a config reference typo as an error, not a warning", () => {
    const data = diagnosis({
      skipped: [{ adapter: "config", id: "cap:command:typo", reason: "product-map.config.mjs: binds entry" }],
    });

    expect(data.findings[0]?.severity).toBe("error");
    expect(data.findings[0]?.remedy).toContain("product-map.config.mjs");
  });

  it("treats an overrides key matching no extracted item as an error too", () => {
    const data = diagnosis({
      skipped: [
        {
          adapter: "config",
          id: "cap:command:typo",
          reason: "product-map.config.mjs: overrides entry names an item that was not extracted",
        },
      ],
    });

    expect(data.findings[0]).toMatchObject({ severity: "error", code: "config-reference" });
    expect(data.findings[0]?.remedy).toContain("product-map.config.mjs");
  });

  it("flags a surface type whose expected capability kind is entirely missing", () => {
    const data = diagnosis({
      surfaces: surfaces([surface({ id: "surface:mcp:fixture", surfaceType: "mcp", binds: [] })]),
      capabilities: capabilities([capability()]),
    });

    expect(data.findings).toContainEqual(
      expect.objectContaining({ code: "thin-extraction", detail: "1 mcp surface(s) but zero mcp-tool capabilities" }),
    );
  });

  it("calls out an unbound capability that is confirmed externally consumable", () => {
    const data = diagnosis({
      surfaces: surfaces([surface({ binds: [] })]),
      capabilities: capabilities([capability({ id: "cap:command:orphan", reach: "external" })]),
    });
    const finding = data.findings.find((entry) => entry.code === "unexposed-capability");

    expect(finding?.severity).toBe("note");
    expect(finding?.detail).toContain("cap:command:orphan");
    expect(finding?.remedy).not.toBe(data.findings.find((entry) => entry.code === "undetermined-reach")?.remedy ?? "");
  });

  it("separates an unbound capability whose reach was never observed", () => {
    const data = diagnosis({
      surfaces: surfaces([surface({ binds: [] })]),
      capabilities: capabilities([capability({ id: "cap:command:orphan", reach: "unknown" })]),
    });
    const finding = data.findings.find((entry) => entry.code === "undetermined-reach");

    expect(finding?.severity).toBe("note");
    expect(finding?.detail).toContain("cap:command:orphan");
    expect(finding?.remedy).toContain("extract.local.mjs");
    expect(data.findings.some((entry) => entry.code === "unexposed-capability")).toBe(false);
  });

  it("stays quiet about an unbound internal capability, which is normal plumbing", () => {
    const data = diagnosis({
      surfaces: surfaces([surface({ binds: [] })]),
      capabilities: capabilities([capability({ id: "cap:service:orphan", kind: "service", reach: "internal" })]),
    });

    expect(data.findings.some((entry) => entry.detail.includes("cap:service:orphan"))).toBe(false);
  });

  it("names a remedy for every finding", () => {
    const data = diagnosis({
      localIssues: ["local extractor failed: boom"],
      skipped: [{ adapter: "bins", id: "surface:cli:fixture", reason: "duplicate" }],
    });

    expect(data.findings.every((finding) => finding.remedy.length > 0)).toBe(true);
  });
});
