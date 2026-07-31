import { existsSync } from "node:fs";
import { join } from "node:path";

import { banner, bodyFromFirstSection, readRoot, repoRoot } from "./lib.mjs";

const SOURCE = "CLAUDE.md";

/**
 * AGENTS.md is the vendor-neutral name other coding agents look for. Rather
 * than maintain two drifting copies of the same guidance, CLAUDE.md is the
 * single source and this step republishes its body under a fresh heading.
 * Only the preamble is regenerated, so no per-line rewriting can rot.
 *
 * Both files are deliberately untracked: they are maintainer-machine guidance,
 * not part of the published repository. The step skips when the source is
 * absent — the normal state in CI and in a public clone — mirroring how the
 * examples step skips without fixtures/.
 */
export default {
  name: "agents-md",
  generate() {
    if (!existsSync(join(repoRoot, SOURCE))) return [];
    const header = [
      "# AGENTS.md",
      "",
      banner(SOURCE),
      "",
      `This file provides guidance to coding agents working in this repository. It is generated from [${SOURCE}](${SOURCE}), which is the file to edit.`,
      "",
      "",
    ].join("\n");
    return [{ path: "AGENTS.md", content: header + bodyFromFirstSection(readRoot(SOURCE)) }];
  },
};
