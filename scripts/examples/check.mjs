import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { SOURCE_METADATA, repoRoot, run, snapshotDir, sources } from "./shared.mjs";

/**
 * The offline gate. It never touches the network or the gitignored checkouts,
 * so CI can enforce that the committed snapshots are real, pinned, and
 * canonical without cloning anything.
 */
for (const source of sources) {
  const metadataFile = join(snapshotDir(source), SOURCE_METADATA);
  if (!existsSync(metadataFile)) throw new Error(`${source.name}: committed snapshot is missing`);
  const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
  if (JSON.stringify(metadata) !== JSON.stringify(source)) {
    throw new Error(`${source.name}: source metadata does not match scripts/examples/sources.json`);
  }
}

run("pnpm", ["--filter", "@product-map/spec", "test"], { cwd: repoRoot });
console.log(`Validated ${sources.length} public example snapshots without network access.`);
