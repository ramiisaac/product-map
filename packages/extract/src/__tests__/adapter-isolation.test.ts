import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Adapter } from "@product-map/spec";
import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { ADAPTERS, extractRepo } from "..";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

function write(root: string, path: string, content = "export {};\n"): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-isolation-"));
  write(root, "package.json", `${JSON.stringify({ name: "fixture", private: true })}\n`);
  write(
    root,
    "packages/cli/package.json",
    `${JSON.stringify({ name: "@fixture/cli", bin: { fixture: "dist/cli.js" } })}\n`,
  );
  write(root, "packages/cli/src/commands/scan.ts");
  return root;
}

function throwingAdapter(name: string, where: "detect" | "extract"): Adapter {
  return {
    name,
    detect: () => {
      if (where === "detect") throw new Error(`${name} detect exploded`);
      return true;
    },
    extract: () => {
      throw new Error(`${name} extract exploded`);
    },
  };
}

async function extractWith(adapters: readonly Adapter[]) {
  return extractRepo(loadRepoContext(fixtureRepo()), { generator: toolGenerator, allowRepoCode: false }, adapters);
}

describe("per-adapter fault isolation", () => {
  it("keeps the other adapters' items when one adapter's extract throws", async () => {
    const result = await extractWith([...ADAPTERS, throwingAdapter("boom", "extract")]);

    expect(result.capabilities.items.map((item) => item.id)).toContain("cap:package:cli");
    expect(result.adaptersRun).not.toContain("boom");
    expect(result.adapterIssues).toContainEqual({
      adapter: "boom",
      message: expect.stringContaining("boom extract exploded"),
    });
  });

  it("keeps the other adapters' items when one adapter's detect throws", async () => {
    const result = await extractWith([...ADAPTERS, throwingAdapter("boom", "detect")]);

    expect(result.surfaces.items.map((item) => item.id)).toContain("surface:cli:fixture");
    expect(result.adapterIssues).toContainEqual({
      adapter: "boom",
      message: expect.stringContaining("boom detect exploded"),
    });
  });

  it("records nothing when every adapter behaves", async () => {
    expect((await extractWith(ADAPTERS)).adapterIssues).toEqual([]);
  });
});
