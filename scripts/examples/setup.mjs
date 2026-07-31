import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { fixtureDir, fixturesRoot, run, sources } from "./shared.mjs";

mkdirSync(fixturesRoot, { recursive: true });

for (const source of sources) {
  const checkout = fixtureDir(source);
  if (!existsSync(join(checkout, ".git"))) {
    mkdirSync(checkout, { recursive: true });
    run("git", ["init", "--quiet", checkout]);
    run("git", ["-C", checkout, "remote", "add", "origin", source.repository]);
  }

  const origin = run("git", ["-C", checkout, "remote", "get-url", "origin"], {
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  if (origin !== source.repository) {
    throw new Error(`${source.name}: origin is ${origin}; expected ${source.repository}`);
  }

  console.log(`Fetching ${source.name}@${source.commit.slice(0, 12)}...`);
  run("git", ["-C", checkout, "fetch", "--quiet", "--depth=1", "origin", source.commit]);
  run("git", ["-C", checkout, "checkout", "--quiet", "--detach", source.commit]);
}

console.log(`Prepared ${sources.length} pinned example repositories in fixtures/.`);
