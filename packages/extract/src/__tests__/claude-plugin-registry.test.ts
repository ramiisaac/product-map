import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractRepo } from "..";
import { loadRepoContext } from "@product-map/discovery";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

function write(root: string, path: string, content: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

describe("plugin marketplace registry surface", () => {
  it("names the registry after the repository, not the marketplace owner", async () => {
    const root = join(mkdtempSync(join(tmpdir(), "pmap-marketplace-")), "widget-shop");
    mkdirSync(root);
    write(root, "package.json", '{"name":"fixture","private":true}\n');
    write(root, ".claude-plugin/marketplace.json", `${JSON.stringify({ name: "somehandle", plugins: [{}, {}] })}\n`);

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const registry = result.surfaces.items.find((item) => item.surfaceType === "registry");

    expect(registry?.id).toBe("surface:registry:widget-shop");
    expect(registry?.name).toBe("somehandle plugin marketplace");
  });
});
