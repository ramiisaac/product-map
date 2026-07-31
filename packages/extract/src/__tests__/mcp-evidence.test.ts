import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractRepo } from "..";
import { loadRepoContext } from "@product-map/discovery";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

function write(root: string, path: string, content = "export {};\n"): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function repo(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `pmap-${label}-`));
  write(root, "package.json", '{"name":"fixture","private":true}\n');
  return root;
}

function sdkPkg(root: string, dir: string, name: string): void {
  write(
    root,
    `${dir}/package.json`,
    `${JSON.stringify({ name, dependencies: { "@modelcontextprotocol/sdk": "latest" } })}\n`,
  );
}

const mcpSurfaces = (items: Array<{ id: string; surfaceType: string }>): string[] =>
  items.filter((item) => item.surfaceType === "mcp").map((item) => item.id);

describe("mcp server evidence", () => {
  it("does not mint a surface for a package that merely depends on the SDK", async () => {
    const root = repo("mcp-dep-only");
    sdkPkg(root, "packages/plain", "@fixture/plain-sdk-dep");
    write(root, "packages/plain/src/index.ts", 'import { Client } from "@modelcontextprotocol/sdk/client/index.js";\n');

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(result.adaptersRun).toContain("mcp");
    expect(mcpSurfaces(result.surfaces.items)).toEqual([]);
  });

  it("mints a surface for a package whose source imports the SDK server entrypoint", async () => {
    const root = repo("mcp-server-import");
    sdkPkg(root, "packages/server", "@fixture/plain-server");
    write(
      root,
      "packages/server/src/mcp/index.ts",
      'import { Server } from "@modelcontextprotocol/sdk/server/index.js";\n',
    );

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(mcpSurfaces(result.surfaces.items)).toEqual(["surface:mcp:plain-server"]);
  });

  it("reads the schema shim as client evidence, not server evidence", async () => {
    const root = repo("mcp-zod-compat");
    sdkPkg(root, "packages/ui", "@fixture/plain-ui");
    write(
      root,
      "packages/ui/src/app.ts",
      'import type { SchemaOutput } from "@modelcontextprotocol/sdk/server/zod-compat.js";\n',
    );

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(mcpSurfaces(result.surfaces.items)).toEqual([]);
  });

  it("ignores a server built only inside test helpers", async () => {
    const root = repo("mcp-test-helper");
    sdkPkg(root, "packages/probe", "@fixture/plain-probe");
    write(root, "packages/probe/src/index.ts", 'import { Client } from "@modelcontextprotocol/sdk/client/index.js";\n');
    write(
      root,
      "packages/probe/__tests__/helpers/test-server.ts",
      'import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";\n',
    );

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(mcpSurfaces(result.surfaces.items)).toEqual([]);
  });

  it("mints a surface from a tools directory alone, binding each tool module", async () => {
    const root = repo("mcp-tools-dir");
    write(root, "packages/tracker/package.json", `${JSON.stringify({ name: "@fixture/tracker" })}\n`);
    write(root, "packages/tracker/src/mcp/tools/search.ts");
    write(root, "packages/tracker/src/mcp/tools/annotate.ts");

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const surface = result.surfaces.items.find((item) => item.surfaceType === "mcp");

    expect(surface?.id).toBe("surface:mcp:tracker");
    expect(surface?.binds.map((bind) => bind.capabilityId).sort()).toEqual([
      "cap:mcp-tool:tracker.annotate",
      "cap:mcp-tool:tracker.search",
    ]);
  });

  it("does not credit a workspace root with a nested package's server evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-mcp-workspace-"));
    write(
      root,
      "package.json",
      `${JSON.stringify({ name: "@fixture/workspace", dependencies: { "@modelcontextprotocol/sdk": "latest" } })}\n`,
    );
    sdkPkg(root, "server", "@fixture/workspace-server");
    write(root, "server/src/index.ts", 'import { Server } from "@modelcontextprotocol/sdk/server/index.js";\n');

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(mcpSurfaces(result.surfaces.items)).toEqual(["surface:mcp:workspace-server"]);
  });
});
