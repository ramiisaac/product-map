import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadRepoContext } from "@product-map/discovery";

describe("repository filesystem boundary", () => {
  it("does not follow a directory symlink outside the repository", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-workspace-"));
    const outside = mkdtempSync(join(tmpdir(), "pmap-outside-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", private: true }));
    writeFileSync(join(outside, "package.json"), JSON.stringify({ name: "outside-package" }));
    mkdirSync(join(root, "packages"), { recursive: true });
    symlinkSync(outside, join(root, "packages", "outside"), "dir");

    const context = loadRepoContext(root);

    expect(context.packages.map((pkg) => pkg.manifest["name"])).not.toContain("outside-package");
    expect(context.listFiles("packages")).not.toContain("packages/outside/package.json");
  });
});
