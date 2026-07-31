import { execFileSync } from "node:child_process";

import { repoRoot } from "./lib.mjs";

const EMITTER = "packages/spec/scripts/emit-json-schemas.ts";

/**
 * The JSON Schemas are a projection of the Zod schemas, which are TypeScript,
 * so the emitter runs under tsx in a child process and hands its artifacts
 * back as JSON. Writing, formatting, and drift-checking stay here with every
 * other generated artifact instead of forking into a second mechanism.
 */
export default {
  name: "spec-schemas",
  generate() {
    const stdout = execFileSync("pnpm", ["exec", "tsx", EMITTER], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
    const artifacts = JSON.parse(stdout);
    if (!Array.isArray(artifacts) || artifacts.length === 0) {
      throw new Error(`${EMITTER} produced no artifacts`);
    }
    return artifacts;
  },
};
