import { describe, expect, it } from "vitest";

import { COMMAND_GROUPS, COMMANDS, isCommandName, renderCommandList } from "../registry";

describe("command registry", () => {
  it("renders every registered command exactly once, under its group heading", () => {
    const rendered = renderCommandList();
    for (const [name, spec] of Object.entries(COMMANDS)) {
      expect(rendered).toContain(name);
      expect(rendered).toContain(spec.summary);
    }
    const commandLines = rendered.split("\n").filter((line) => line.startsWith("    "));
    expect(commandLines).toHaveLength(Object.keys(COMMANDS).length);
  });

  it("groups by intent, so a reader can find the read-only commands without reading them all", () => {
    const rendered = renderCommandList();
    for (const heading of Object.values(COMMAND_GROUPS)) expect(rendered).toContain(heading);
    expect(rendered.indexOf("show")).toBeLessThan(rendered.indexOf("extract"));
  });

  it("assigns every command to a declared group", () => {
    for (const spec of Object.values(COMMANDS)) {
      expect(Object.keys(COMMAND_GROUPS)).toContain(spec.group);
    }
  });

  it("recognizes registered command names and rejects others", () => {
    expect(isCommandName("all")).toBe(true);
    expect(isCommandName("check-fresh")).toBe(true);
    expect(isCommandName("bogus")).toBe(false);
    expect(isCommandName("")).toBe(false);
  });
});
