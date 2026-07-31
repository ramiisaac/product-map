import { execFileSync } from "node:child_process";

import { readRoot, repoRoot } from "./lib.mjs";

const README = "README.md";
const EXAMPLE = "shadcn-ui";

/**
 * The README shows real tool output. Pasting it by hand drifted within two
 * commits — a version bump rewrote the example while the README kept claiming
 * the old one — which is exactly the failure this project exists to catch, so
 * the samples are injected from the committed example instead.
 *
 * Only the marked regions are generated; the rest of the README is written by
 * hand as normal.
 */
const SAMPLES = [
  {
    marker: "example-digest",
    file: `examples/${EXAMPLE}/generated/digest.generated.md`,
    from: /^# /m,
    to: /$(?![\s\S])/,
  },
  {
    marker: "example-index",
    file: `examples/${EXAMPLE}/generated/README.generated.md`,
    from: /^# /m,
    to: /^## Files/m,
  },
  { marker: "cli-help" },
  {
    marker: "example-gaps",
    file: `examples/${EXAMPLE}/generated/product-surface-gaps.generated.md`,
    from: /^## 2\. Unbound surfaces/m,
    to: /^## 3\./m,
  },
];

/** The CLI's own help output, so the documented command set cannot drift from the registry that defines it. */
function cliHelp() {
  return execFileSync("pnpm", ["--silent", "pmap", "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

/** Link targets are relative to the example directory and would not resolve from the README. */
function excerpt({ file, from, to }) {
  const source = readRoot(file);
  const start = from.exec(source)?.index;
  const end = to.exec(source)?.index;
  if (start === undefined || end === undefined || end <= start) {
    throw new Error(`${file}: could not locate the excerpt between ${from} and ${to}`);
  }
  return source
    .slice(start, end)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export default {
  name: "readme-samples",
  generate() {
    let content = readRoot(README);
    for (const sample of SAMPLES) {
      const source = sample.file ?? "`pmap --help`";
      const open = `<!-- generated:${sample.marker} — injected from ${source}; do not edit -->`;
      const close = `<!-- /generated:${sample.marker} -->`;
      const region = new RegExp(`<!-- generated:${sample.marker}[\\s\\S]*?${close}`);
      if (!region.test(content)) throw new Error(`${README}: missing the ${sample.marker} markers`);
      const body = sample.file === undefined ? cliHelp() : excerpt(sample);
      const block = ["```text", body, "```"].join("\n");
      content = content.replace(region, `${open}\n\n${block}\n\n${close}`);
    }
    return [{ path: README, content }];
  },
};
