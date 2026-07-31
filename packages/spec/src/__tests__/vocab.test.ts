import { describe, expect, it } from "vitest";

import { capabilityId } from "../ids";
import { CapabilityItemSchema } from "../items";
import type { CapabilityKind } from "../vocab";
import { CAPABILITY_KINDS, DEFAULT_REACH, SURFACE_AREAS, SURFACE_TYPES } from "../vocab";

/** Nothing outside a repository addresses one of these directly, whatever the repository is. */
const DEFINITIONALLY_INTERNAL: CapabilityKind[] = [
  "entity",
  "schema",
  "service",
  "config",
  "diagnostic",
  "job",
  "queue-job",
  "check",
  "rule",
  "reporter",
  "report",
  "artifact",
];

/** Distribution depends on the repository, so only an adapter's observation can settle it. */
const CONTEXT_DEPENDENT: CapabilityKind[] = [
  "route",
  "query",
  "mutation",
  "action",
  "command",
  "event",
  "stream",
  "package",
  "extension-api",
  "email-contract",
  "lsp-method",
  "webhook",
  "mcp-tool",
  "plugin-api",
  "agent-skill",
  "agent-subagent",
];

describe("catch-all vocabulary values", () => {
  it("gives capability kinds the same escape hatch as surface types and areas", () => {
    expect(SURFACE_TYPES).toContain("other");
    expect(SURFACE_AREAS).toContain("other");
    expect(CAPABILITY_KINDS).toContain("other");
  });

  it("mints a valid id for the other kind", () => {
    expect(capabilityId("other", "unclassified.thing")).toBe("cap:other:unclassified.thing");
  });

  it("defaults the other kind's reach to unknown", () => {
    expect(DEFAULT_REACH.other).toBe("unknown");
  });

  it("defaults reach to internal only where internality is definitional", () => {
    for (const kind of DEFINITIONALLY_INTERNAL) expect(DEFAULT_REACH[kind]).toBe("internal");
  });

  it("defaults every context-dependent kind's reach to unknown", () => {
    for (const kind of CONTEXT_DEPENDENT) expect(DEFAULT_REACH[kind]).toBe("unknown");
  });

  it("never defaults a reach to external, which no kind implies on its own", () => {
    expect(Object.values(DEFAULT_REACH)).not.toContain("external");
  });

  it("classifies every capability kind, so a new one forces the decision", () => {
    expect([...DEFINITIONALLY_INTERNAL, ...CONTEXT_DEPENDENT, "other"].sort()).toEqual([...CAPABILITY_KINDS].sort());
  });

  it("accepts a capability item of kind other", () => {
    const result = CapabilityItemSchema.safeParse({
      id: "cap:other:unclassified.thing",
      kind: "other",
      name: "Unclassified thing",
      surfaceArea: "other",
      status: "unknown",
      reach: DEFAULT_REACH.other,
      placement: { current: "packages/thing", verdict: "unknown" },
      provenance: { source: "packages/thing", evidence: [], confidence: "low" },
    });
    expect(result.success).toBe(true);
  });
});
