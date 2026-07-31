import { describe, expect, it } from "vitest";

import { createLogger, createMemoryLogger, SILENT_LOGGER } from "../logger";

describe("logger", () => {
  it("suppresses messages below the configured level", () => {
    const logger = createMemoryLogger("warn");

    logger.error("shown");
    logger.warn("shown");
    logger.info("hidden");
    logger.debug("hidden");

    expect(logger.lines).toEqual(["shown", "shown"]);
  });

  it("prefixes through nested children", () => {
    const lines: string[] = [];
    const logger = createLogger({ level: "debug", sink: (line) => lines.push(line) });

    logger.child("extract: ").child("adapters: ").info("ran");

    expect(lines).toEqual(["extract: adapters: ran"]);
  });

  it("emits nothing at the silent level", () => {
    const logger = createMemoryLogger("silent");

    logger.error("dropped");

    expect(logger.lines).toEqual([]);
    expect(() => SILENT_LOGGER.error("dropped")).not.toThrow();
  });

  it("routes to the given sink rather than stdout", () => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (line) => lines.push(line) });

    logger.info("diagnostic");

    expect(lines).toEqual(["diagnostic"]);
  });
});
