import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { CanonicalPlacementRule, RepoConfig } from "@product-map/spec";
import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { ADAPTERS, extractRepo, loadRepoConfig, selectAdapters } from "..";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

function write(root: string, path: string, content = "export {};\n"): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-config-"));
  write(root, "package.json", `${JSON.stringify({ name: "fixture", private: true })}\n`);
  write(
    root,
    "packages/cli/package.json",
    `${JSON.stringify({ name: "@fixture/cli", bin: { fixture: "dist/cli.js" } })}\n`,
  );
  write(root, "packages/cli/src/commands/scan.ts");
  write(
    root,
    "packages/legacy/package.json",
    `${JSON.stringify({ name: "@fixture/legacy", exports: { ".": "./index.js" } })}\n`,
  );
  write(root, "packages/legacy/src/commands/dead.ts");
  return root;
}

async function extract(root: string, config: RepoConfig) {
  return extractRepo(loadRepoContext(root), { generator: toolGenerator, allowRepoCode: false, config });
}

describe("adapters.exclude", () => {
  it("removes only the named adapter", () => {
    const remaining = selectAdapters(ADAPTERS, { adapters: { exclude: ["cli-commands"] } });
    expect(remaining.map((adapter) => adapter.name)).not.toContain("cli-commands");
    expect(remaining.length).toBe(ADAPTERS.length - 1);
  });

  it("throws on a name no adapter provides, rather than silently doing nothing", () => {
    expect(() => selectAdapters(ADAPTERS, { adapters: { exclude: ["cli-command"] } })).toThrow(
      /adapters.exclude names "cli-command"/,
    );
  });

  it("stops the excluded adapter from contributing items", async () => {
    const root = fixtureRepo();
    const withAdapter = await extract(root, {});
    const withoutAdapter = await extract(root, { adapters: { exclude: ["cli-commands"] } });
    expect(withAdapter.adaptersRun).toContain("cli-commands");
    expect(withoutAdapter.adaptersRun).not.toContain("cli-commands");
    expect(withoutAdapter.capabilities.items.filter((item) => item.kind === "command")).toEqual([]);
  });
});

describe("ignore globs", () => {
  it("hides an ignored package from every adapter", async () => {
    const root = fixtureRepo();
    const all = await extract(root, {});
    const filtered = await extract(root, { ignore: ["packages/legacy/**"] });
    expect(all.capabilities.items.map((item) => item.id)).toContain("cap:package:legacy");
    expect(filtered.capabilities.items.map((item) => item.id)).not.toContain("cap:package:legacy");
    expect(filtered.capabilities.items.map((item) => item.id)).not.toContain("cap:command:legacy.dead");
    expect(filtered.capabilities.items.map((item) => item.id)).toContain("cap:package:cli");
  });
});

describe("declared binds", () => {
  it("binds a surface to a capability that no convention connects", async () => {
    const root = fixtureRepo();
    const result = await extract(root, {
      binds: [{ surface: "surface:cli:fixture", capability: "cap:package:legacy" }],
    });
    const surface = result.surfaces.items.find((item) => item.id === "surface:cli:fixture");
    expect(surface?.binds.map((bind) => bind.capabilityId)).toContain("cap:package:legacy");
  });

  it("records a bind naming an unextracted surface as skipped", async () => {
    const root = fixtureRepo();
    const result = await extract(root, {
      binds: [{ surface: "surface:cli:typo", capability: "cap:package:legacy" }],
    });
    expect(result.skipped).toContainEqual(expect.objectContaining({ adapter: "config", id: "surface:cli:typo" }));
  });

  it("records a bind naming an unextracted capability as skipped rather than asserting a dangling id", async () => {
    const root = fixtureRepo();
    const result = await extract(root, {
      binds: [{ surface: "surface:cli:fixture", capability: "cap:package:absent" }],
    });
    const surface = result.surfaces.items.find((item) => item.id === "surface:cli:fixture");
    expect(surface?.binds.map((bind) => bind.capabilityId)).not.toContain("cap:package:absent");
    expect(result.skipped).toContainEqual(expect.objectContaining({ adapter: "config", id: "cap:package:absent" }));
  });
});

describe("canonical placements", () => {
  it("marks a matching item misplaced against the doctrine", async () => {
    const root = fixtureRepo();
    const result = await extract(root, {
      canonicalPlacements: [{ where: "^packages/legacy", canonical: "packages/core", kinds: ["package"] }],
    });
    const item = result.capabilities.items.find((entry) => entry.id === "cap:package:legacy");
    expect(item?.placement).toMatchObject({ canonical: "packages/core", verdict: "misplaced" });
  });

  it("reports nothing for a rule that matches no item — doctrine may describe a directory yet to exist", async () => {
    const root = fixtureRepo();
    const result = await extract(root, {
      canonicalPlacements: [{ where: "^services/", canonical: "packages/services" }],
    });
    expect(result.skipped.filter((item) => item.adapter === "config")).toEqual([]);
  });

  it("names the config file and the pattern when `where` is not a valid regex", async () => {
    const root = fixtureRepo();
    await expect(
      extract(root, { canonicalPlacements: [{ where: "packages/(", canonical: "packages" }] }),
    ).rejects.toThrow(
      /product-map\.config\.mjs: canonicalPlacements entry has an invalid `where` pattern "packages\/\("/,
    );
  });

  it("rejects a kind outside the vocabulary at compile time", () => {
    const rule: CanonicalPlacementRule = {
      where: "^src/",
      canonical: "packages",
      // @ts-expect-error the vocabulary has "command", not "commands"; under the `readonly string[]`
      // this replaced, that typo compiled and then matched nothing, silently.
      kinds: ["commands"],
    };
    expect(rule.kinds).toEqual(["commands"]);
  });
});

describe("overrides", () => {
  it("records an override key that matches no extracted id as skipped", async () => {
    const root = fixtureRepo();
    const result = await extract(root, { overrides: { "cap:command:absent": { status: "live" } } });
    expect(result.skipped).toContainEqual(expect.objectContaining({ adapter: "config", id: "cap:command:absent" }));
  });

  it("reports nothing for an override that an extracted item consumed", async () => {
    const root = fixtureRepo();
    const result = await extract(root, { overrides: { "cap:package:legacy": { status: "deprecated" } } });
    expect(result.skipped.filter((item) => item.adapter === "config")).toEqual([]);
    expect(result.capabilities.items.find((item) => item.id === "cap:package:legacy")?.status).toBe("deprecated");
  });
});

describe("loadRepoConfig", () => {
  it("returns empty config when the conventional file is absent", async () => {
    await expect(loadRepoConfig(fixtureRepo())).resolves.toEqual({});
  });

  it("throws when an explicitly named config file does not exist", async () => {
    await expect(loadRepoConfig(fixtureRepo(), "/nonexistent/product-map.config.mjs")).rejects.toThrow(
      /no such config file/,
    );
  });

  it("reads the default export of the conventional file", async () => {
    const root = fixtureRepo();
    write(root, "product-map.config.mjs", 'export default { repoName: "renamed" };\n');
    await expect(loadRepoConfig(root)).resolves.toEqual({ repoName: "renamed" });
  });
});

describe("non-product directories", () => {
  it("excludes underscore-wrapped and prefixed scaffolding directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-nonproduct-"));
    write(root, "package.json", `${JSON.stringify({ name: "fixture", private: true })}\n`);
    for (const [dir, name] of [
      ["packages/real", "@fixture/real"],
      ["tests/integration/__fixtures__/next-app", "@fixture/next-app"],
      ["functions-templates/typescript/hello-world", "@fixture/hello-world"],
      ["packages/templates-engine", "@fixture/templates-engine"],
    ] as const) {
      write(root, `${dir}/package.json`, `${JSON.stringify({ name, exports: { ".": "./index.js" } })}\n`);
    }
    const ids = (await extract(root, {})).capabilities.items.map((item) => item.id);

    expect(ids).toContain("cap:package:real");
    // a product that merely has "templates" in its name is not scaffolding
    expect(ids).toContain("cap:package:templates-engine");
    expect(ids).not.toContain("cap:package:next-app");
    expect(ids).not.toContain("cap:package:hello-world");
  });
});
