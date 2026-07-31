import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { PackageInfo, RepoContext } from "@product-map/spec";
import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { ADAPTERS, extractRepo } from "..";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

function write(root: string, path: string, content = "export {};\n"): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function repoWith(packages: readonly { dir: string; name: string; private?: boolean }[]): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-package-exports-"));
  write(root, "package.json", `${JSON.stringify({ name: "fixture", private: true })}\n`);
  for (const { dir, name, private: isPrivate } of packages) {
    write(
      root,
      `${dir}/package.json`,
      `${JSON.stringify({ name, exports: { ".": "./index.js" }, ...(isPrivate === true ? { private: true } : {}) })}\n`,
    );
  }
  return root;
}

async function packageIds(root: string): Promise<Record<string, string>> {
  const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator, allowRepoCode: false });
  const byName: Record<string, string> = {};
  for (const item of result.capabilities.items) {
    if (item.kind === "package") byName[item.name] = item.id;
  }
  return byName;
}

function adapterIds(packages: PackageInfo[]): Record<string, string> {
  const ctx: RepoContext = {
    root: "/repo",
    repoName: "fixture",
    commit: null,
    workingTree: "clean",
    packages,
    read: () => null,
    exists: () => false,
    listFiles: () => [],
  };
  const adapter = ADAPTERS.find((entry) => entry.name === "package-exports")!;
  const byName: Record<string, string> = {};
  for (const item of adapter.extract(ctx).capabilities) byName[item.name] = item.id;
  return byName;
}

describe("package-exports short-id tiebreak", () => {
  it("gives the short id to the public package even when a private one is crawled first", async () => {
    const root = repoWith([
      { dir: "libs/spec", name: "@internal/spec", private: true },
      { dir: "packages/spec", name: "@acme/spec" },
    ]);
    expect(await packageIds(root)).toEqual({
      "@acme/spec": "cap:package:spec",
      "@internal/spec": "cap:package:spec-libs-spec",
    });
  });

  it("assigns the same ids regardless of which package the crawl reaches first", async () => {
    const privateFirst = await packageIds(
      repoWith([
        { dir: "libs/spec", name: "@internal/spec", private: true },
        { dir: "packages/spec", name: "@acme/spec" },
      ]),
    );
    const publicFirst = await packageIds(
      repoWith([
        { dir: "apps-lib/spec", name: "@acme/spec" },
        { dir: "zz/spec", name: "@internal/spec", private: true },
      ]),
    );
    expect(privateFirst["@acme/spec"]).toBe("cap:package:spec");
    expect(publicFirst["@acme/spec"]).toBe("cap:package:spec");
    expect(privateFirst["@internal/spec"]).toBe("cap:package:spec-libs-spec");
    expect(publicFirst["@internal/spec"]).toBe("cap:package:spec-zz-spec");
  });

  it("breaks a tie between equally private packages by directory, whichever order the adapter sees them in", () => {
    const forward = adapterIds([
      { dir: "libs/spec", manifest: { name: "@internal/spec", private: true } },
      { dir: "vendor/spec", manifest: { name: "@other/spec", private: true } },
    ]);
    const reversed = adapterIds([
      { dir: "vendor/spec", manifest: { name: "@other/spec", private: true } },
      { dir: "libs/spec", manifest: { name: "@internal/spec", private: true } },
    ]);
    const expected = {
      "@internal/spec": "cap:package:spec",
      "@other/spec": "cap:package:spec-vendor-spec",
    };
    expect(forward).toEqual(expected);
    expect(reversed).toEqual(expected);
  });

  it("gives the public package the short id whichever order the adapter sees them in", () => {
    const expected = {
      "@acme/spec": "cap:package:spec",
      "@internal/spec": "cap:package:spec-libs-spec",
    };
    expect(
      adapterIds([
        { dir: "libs/spec", manifest: { name: "@internal/spec", private: true } },
        { dir: "packages/spec", manifest: { name: "@acme/spec" } },
      ]),
    ).toEqual(expected);
    expect(
      adapterIds([
        { dir: "packages/spec", manifest: { name: "@acme/spec" } },
        { dir: "libs/spec", manifest: { name: "@internal/spec", private: true } },
      ]),
    ).toEqual(expected);
  });

  it("leaves a package with no name collision on the unsuffixed id", () => {
    expect(
      adapterIds([
        { dir: "packages/spec", manifest: { name: "@acme/spec" } },
        { dir: "packages/cli", manifest: { name: "@acme/cli" } },
      ]),
    ).toEqual({ "@acme/spec": "cap:package:spec", "@acme/cli": "cap:package:cli" });
  });
});
