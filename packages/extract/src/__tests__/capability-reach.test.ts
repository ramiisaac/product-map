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

async function reachOf(root: string, id: string): Promise<string | undefined> {
  const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
  return result.capabilities.items.find((item) => item.id === id)?.reach;
}

describe("cli-commands reach", () => {
  it("calls a command of a published package external", async () => {
    const root = repo("reach-public-cli");
    write(root, "packages/tool/package.json", '{"name":"tool","bin":{"tool":"dist/cli.js"}}\n');
    write(root, "packages/tool/src/commands/build.ts");

    expect(await reachOf(root, "cap:command:tool.build")).toBe("external");
  });

  it("calls a command of a private package internal", async () => {
    const root = repo("reach-private-cli");
    write(root, "packages/tool/package.json", '{"name":"tool","private":true,"bin":{"tool":"dist/cli.js"}}\n');
    write(root, "packages/tool/src/commands/build.ts");

    expect(await reachOf(root, "cap:command:tool.build")).toBe("internal");
  });
});

describe("mcp reach", () => {
  it("calls a tool of an observed server external, since any client can call it", async () => {
    const root = repo("reach-mcp");
    write(
      root,
      "packages/server/package.json",
      `${JSON.stringify({ name: "server", dependencies: { "@modelcontextprotocol/sdk": "latest" } })}\n`,
    );
    write(root, "packages/server/src/mcp/tools/search.ts");

    expect(await reachOf(root, "cap:mcp-tool:server.search")).toBe("external");
  });
});

describe("lsp reach", () => {
  it("calls an LSP method external, since only an editor outside the repo can call it", async () => {
    const root = repo("reach-lsp");
    write(
      root,
      "packages/server/package.json",
      `${JSON.stringify({ name: "langserver", dependencies: { "vscode-languageserver": "latest" } })}\n`,
    );
    write(root, "packages/server/src/index.ts", "connection.onHover(() => null);\n");

    expect(await reachOf(root, "cap:lsp-method:langserver.onhover")).toBe("external");
  });
});

describe("vscode reach", () => {
  it("calls a contributed command external, since it exists to be invoked from the editor", async () => {
    const root = repo("reach-vscode");
    write(
      root,
      "packages/ext/package.json",
      `${JSON.stringify({
        name: "ext",
        engines: { vscode: "^1.90.0" },
        contributes: { commands: [{ command: "ext.doThing", title: "Do Thing" }] },
      })}\n`,
    );

    expect(await reachOf(root, "cap:extension-api:ext.ext.dothing")).toBe("external");
  });
});

describe("supabase-functions reach", () => {
  it("calls an edge function external, since deploying one publishes an HTTP endpoint", async () => {
    const root = repo("reach-edge");
    write(root, "supabase/functions/hello/index.ts", "Deno.serve(() => new Response('hi'));\n");

    expect(await reachOf(root, "cap:route:edge.hello")).toBe("external");
  });
});

describe("claude-plugin reach", () => {
  it("calls a plugin's command component external, since the plugin distributes it", async () => {
    const root = repo("reach-plugin");
    write(root, "plugins/kit/.claude-plugin/plugin.json", '{"name":"kit"}\n');
    write(root, "plugins/kit/commands/review.md", "---\nname: review\n---\n\nReview.\n");

    expect(await reachOf(root, "cap:command:kit.review")).toBe("external");
  });
});
