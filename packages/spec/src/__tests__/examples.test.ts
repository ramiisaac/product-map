import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalStringify } from "../canonical";
import { validateManifest } from "../manifest";

const repoRoot = join(__dirname, "..", "..", "..", "..");
const examplesRoot = join(repoRoot, "examples");
const SOURCE_METADATA = "source.json";

interface ExampleSource {
  name: string;
  repository: string;
  commit: string;
  license: "MIT";
}

const sources = JSON.parse(
  readFileSync(join(repoRoot, "scripts", "examples", "sources.json"), "utf8"),
) as ExampleSource[];

/** Every JSON file in a snapshot is a manifest except its provenance metadata. */
function collectManifests(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectManifests(full));
    } else if (entry.endsWith(".json") && entry !== SOURCE_METADATA) {
      files.push(full);
    }
  }
  return files;
}

describe("public repository examples", () => {
  it("uses pinned, permissively licensed public sources without private project data", () => {
    expect(sources.length).toBeGreaterThanOrEqual(3);
    for (const source of sources) {
      expect(source.repository).toMatch(/^https:\/\/github\.com\//);
      expect(source.commit).toMatch(/^[a-f0-9]{40}$/);
      expect(source.license).toBe("MIT");
    }
  });

  for (const source of sources) {
    const snapshotDir = join(examplesRoot, source.name);

    it(`${source.name} records its exact source revision`, () => {
      const metadata = JSON.parse(readFileSync(join(snapshotDir, SOURCE_METADATA), "utf8")) as ExampleSource;
      expect(metadata).toEqual(source);
    });

    it(`${source.name} contains generated product-map artifacts`, () => {
      expect(existsSync(snapshotDir)).toBe(true);
      expect(collectManifests(snapshotDir).length).toBeGreaterThanOrEqual(3);
    });

    if (existsSync(snapshotDir)) {
      for (const file of collectManifests(snapshotDir)) {
        it(`${file.split("/examples/")[1]} validates and is canonical on disk`, () => {
          const raw = readFileSync(file, "utf8");
          const parsed: unknown = JSON.parse(raw);
          const result = validateManifest(parsed);
          expect(result.issues).toEqual([]);
          expect(result.ok).toBe(true);
          expect(raw).toBe(canonicalStringify(parsed));
        });
      }

      it(`${source.name} demonstrates at least one surface bound to a capability`, () => {
        const map = JSON.parse(readFileSync(join(snapshotDir, "maps", "map.existing.json"), "utf8")) as {
          items: Array<{ relationship: string }>;
        };
        // An example whose map is entirely unbound teaches nothing about what
        // the tool is for; it is a bad example, not merely a thin one.
        expect(map.items.filter((entry) => entry.relationship === "bound").length).toBeGreaterThan(0);
      });
    }
  }
});
