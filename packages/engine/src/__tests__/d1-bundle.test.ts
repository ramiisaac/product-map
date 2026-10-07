import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadInventory } from "../inventory";
import { EMPTY_OPTIONS } from "../options";
import { renderBundleCommand } from "../read-only";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;
const repoRootDir = resolve(import.meta.dirname, "../../../..");
const assets = {
  promptsDir: join(repoRootDir, "packages", "pmap", "prompts"),
  schemasDir: join(repoRootDir, "packages", "spec", "schemas"),
};
const INSTRUCTION = "Replace `<REPO>` before sending.";

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-bundle-"));
  write(join(root, "package.json"), JSON.stringify({ name: "fixture", private: true, bin: { fixture: "./cli.js" } }));
  write(join(root, "src", "commands", "scan.ts"), "export const scan = true;\n");
  return root;
}

async function bundleFor(scope: string): Promise<string> {
  const options = { ...EMPTY_OPTIONS, config: { repoName: scope } };
  const inventory = await loadInventory({
    repoRoot: fixtureRepo(),
    generator: toolGenerator,
    options,
    allowRepoCode: false,
  });
  return renderBundleCommand(inventory, assets, options);
}

describe("bundle scope substitution", () => {
  it("names the scope and drops the instruction to substitute it", async () => {
    const bundle = await bundleFor("acme-app");

    expect(bundle).toContain('for the repository "acme-app"');
    expect(bundle).toContain('"scope": "acme-app"');
    expect(bundle).not.toContain("<REPO>");
    expect(bundle).not.toContain(INSTRUCTION);
    expect(bundle).toContain("where indicated.\n");
  });

  it("leaves the instruction in the vendored template, where a hand-paste still needs it", () => {
    const template = readFileSync(join(assets.promptsDir, "claude-design-new-project.prompt.md"), "utf8");

    expect(template).toContain(` ${INSTRUCTION}`);
    expect(template).toContain("<REPO>");
  });

  it("substitutes a scope containing replacement metacharacters literally", async () => {
    const bundle = await bundleFor("a$&b");

    expect(bundle).toContain('for the repository "a$&b"');
    expect(bundle).toContain('"scope": "a$&b"');
    expect(bundle).not.toContain("a<REPO>b");
    expect(bundle).not.toContain("<REPO>");
  });
});
