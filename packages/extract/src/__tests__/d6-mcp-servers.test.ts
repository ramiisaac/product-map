import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { mcpAdapter } from "../adapters/mcp";

const V1 = "@modelcontextprotocol/sdk";
const V2 = "@modelcontextprotocol/server";

function write(root: string, path: string, content = "export {};\n"): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function repo(manifest: Record<string, unknown>, files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-d6-"));
  write(root, "package.json", '{"name":"fixture","private":true}\n');
  write(root, "packages/server/package.json", `${JSON.stringify(manifest)}\n`);
  for (const [path, content] of Object.entries(files)) write(root, `packages/server/${path}`, content);
  return root;
}

function run(root: string) {
  const ctx = loadRepoContext(root);
  const detected = mcpAdapter.detect(ctx);
  const output = mcpAdapter.extract(ctx);
  return {
    detected,
    surfaces: output.surfaces.map((item) => item.id),
    tools: output.capabilities.map((item) => item.id),
    binds: output.surfaces.flatMap((item) => item.binds.map((bind) => bind.capabilityId)),
    output,
  };
}

describe("mcp recognizes servers of both SDK generations", () => {
  it("mints a v2 server and names its tools from literal registerTool calls", () => {
    const root = repo(
      { name: "@fixture/notes-server", dependencies: { [V2]: "^2.3.1" } },
      {
        "src/index.ts": [
          `import { McpServer } from "${V2}";`,
          `import { StdioServerTransport } from "${V2}/stdio";`,
          'const server = new McpServer({ name: "notes", version: "1.0.0" });',
          'server.registerTool("search_notes", { description: "Search notes" }, async () => ({ content: [] }));',
          'server.registerTool("create-note", { description: "Create a note" }, async () => ({ content: [] }));',
          "await server.connect(new StdioServerTransport());",
          "",
        ].join("\n"),
      },
    );
    const result = run(root);

    expect(result.detected).toBe(true);
    expect(result.surfaces).toEqual(["surface:mcp:notes-server"]);
    expect(result.tools).toEqual(["cap:mcp-tool:notes-server.create-note", "cap:mcp-tool:notes-server.search-notes"]);
    expect(result.binds).toEqual(result.tools);
    expect(result.output.capabilities.map((item) => [item.name, item.provenance.confidence])).toEqual([
      ["create-note", "high"],
      ["search_notes", "high"],
    ]);
  });

  it("mints a v1 server from its server subpath import and reads a literal tool() registration", () => {
    const root = repo(
      { name: "@fixture/lookup-server", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/server.ts": [
          `import { McpServer } from "${V1}/server/mcp.js";`,
          'const server = new McpServer({ name: "lookup", version: "1.0.0" });',
          'server.tool("lookup", async () => ({ content: [] }));',
          "",
        ].join("\n"),
      },
    );
    const result = run(root);

    expect(result.surfaces).toEqual(["surface:mcp:lookup-server"]);
    expect(result.tools).toEqual(["cap:mcp-tool:lookup-server.lookup"]);
  });

  it("accepts dynamic import and require of a server entrypoint", () => {
    const dynamic = repo(
      { name: "@fixture/lazy-server", dependencies: { [V1]: "^1.20.0" } },
      { "src/main.ts": `const { McpServer } = await import("${V1}/server/mcp.js");\n` },
    );
    const required = repo(
      { name: "@fixture/cjs-server", dependencies: { [V2]: "^2.3.1" } },
      { "src/main.js": `const { McpServer } = require("${V2}");\n` },
    );

    expect(run(dynamic).surfaces).toEqual(["surface:mcp:lazy-server"]);
    expect(run(required).surfaces).toEqual(["surface:mcp:cjs-server"]);
  });
});

describe("mcp does not mistake other packages for servers", () => {
  it("ignores an AI SDK tool set in src/tools with no MCP import", () => {
    const root = repo(
      { name: "@fixture/agent", dependencies: { ai: "^5.0.0" } },
      {
        "src/tools/weather.ts":
          'import { tool } from "ai";\nexport const weather = tool({ description: "Weather", execute: async () => "sunny" });\n',
        "src/index.ts": 'export { weather } from "./tools/weather";\n',
      },
    );
    const result = run(root);

    expect(result.detected).toBe(false);
    expect(result.surfaces).toEqual([]);
    expect(result.tools).toEqual([]);
  });

  it("ignores src/tools in an SDK client package", () => {
    const root = repo(
      { name: "@fixture/agent-client", dependencies: { [V1]: "^1.20.0", ai: "^5.0.0" } },
      {
        "src/client.ts": `import { Client } from "${V1}/client/index.js";\n`,
        "src/tools/weather.ts":
          'import { tool } from "ai";\nexport const weather = tool({ description: "Weather" });\n',
      },
    );

    expect(run(root).surfaces).toEqual([]);
  });

  it("reads the zod-compat shim as client evidence only", () => {
    const root = repo(
      { name: "@fixture/schema-client", dependencies: { [V1]: "^1.20.0" } },
      { "src/schema.ts": `import type { SchemaOutput } from "${V1}/server/zod-compat.js";\n` },
    );

    expect(run(root).surfaces).toEqual([]);
  });

  it("matches a module specifier, not the same text elsewhere", () => {
    const root = repo(
      { name: "@fixture/docs-only", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/docs.ts": `export const SERVER_ENTRY = "${V1}/server/mcp.js";\n`,
        "src/example.ts": 'import { serve } from "@modelcontextprotocol/server-everything";\n',
      },
    );

    expect(run(root).surfaces).toEqual([]);
  });
});

describe("mcp tool coverage", () => {
  it("mints a surface from src/mcp/tools without an SDK dependency", () => {
    const root = repo({ name: "@fixture/tracker" }, { "src/mcp/tools/search.ts": "export {};\n" });
    const result = run(root);

    expect(result.detected).toBe(true);
    expect(result.surfaces).toEqual(["surface:mcp:tracker"]);
    expect(result.tools).toEqual(["cap:mcp-tool:tracker.search"]);
  });

  it("keeps both literal registrations and tools-dir modules when a registration name is computed", () => {
    const root = repo(
      { name: "@fixture/mixed-server", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/server.ts": [
          `import { McpServer } from "${V1}/server/mcp.js";`,
          'import { tools } from "./tools";',
          'const server = new McpServer({ name: "mixed", version: "1.0.0" });',
          'server.registerTool("status", { description: "Status" }, async () => ({ content: [] }));',
          "for (const entry of tools) server.registerTool(entry.name, entry.config, entry.handler);",
          "",
        ].join("\n"),
        "src/tools/search.ts": "export const search = { name: dynamicName() };\n",
        "src/tools/annotate.ts": "export {};\n",
      },
    );
    const result = run(root);

    expect(result.tools).toEqual([
      "cap:mcp-tool:mixed-server.annotate",
      "cap:mcp-tool:mixed-server.search",
      "cap:mcp-tool:mixed-server.status",
    ]);
    expect(result.binds).toEqual(result.tools);
  });

  it("does not add tools-dir modules when every registration is literal", () => {
    const root = repo(
      { name: "@fixture/literal-server", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/server.ts": [
          `import { McpServer } from "${V1}/server/mcp.js";`,
          'import { describeTool } from "./tools/describe";',
          'const server = new McpServer({ name: "literal", version: "1.0.0" });',
          'server.registerTool("status", describeTool("status"), async () => ({ content: [] }));',
          "",
        ].join("\n"),
        "src/tools/describe.ts": "export const describeTool = (name: string) => ({ title: name });\n",
      },
    );

    expect(run(root).tools).toEqual(["cap:mcp-tool:literal-server.status"]);
  });

  it("ignores commented-out registrations", () => {
    const root = repo(
      { name: "@fixture/quiet-server", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/server.ts": `import { McpServer } from "${V1}/server/mcp.js";\n// server.registerTool("old_tool", {}, handler);\n`,
      },
    );
    const result = run(root);

    expect(result.surfaces).toEqual(["surface:mcp:quiet-server"]);
    expect(result.tools).toEqual([]);
  });
});

describe("mcp reads registrations from a real parse", () => {
  const server = (lines: string[]): string =>
    [`import { McpServer } from "${V1}/server/mcp.js";`, ...lines, ""].join("\n");

  it("treats a concatenated name as computed and keeps the tools directory speaking for it", () => {
    const root = repo(
      { name: "@fixture/prefixed-server", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/server.ts": server(['server.registerTool("notes_" + action, config, handler);']),
        "src/tools/archive.ts": "export {};\n",
      },
    );

    expect(run(root).tools).toEqual(["cap:mcp-tool:prefixed-server.archive"]);
  });

  it("does not read a registration out of JSX text", () => {
    const root = repo(
      { name: "@fixture/docs-server", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/server.ts": server(['server.registerTool("status", config, handler);']),
        "src/help.tsx": 'export const Help = () => <p>Call server.registerTool("fake_tool", config) to add one</p>;\n',
      },
    );

    expect(run(root).tools).toEqual(["cap:mcp-tool:docs-server.status"]);
  });

  it("keeps two names that slugify alike as two tools with distinct ids and matching binds", () => {
    const root = repo(
      { name: "@fixture/twin-server", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/server.ts": server([
          'server.registerTool("search_notes", config, handler);',
          'server.registerTool("search-notes", config, handler);',
          'server.registerTool("search_notes", config, handler);',
        ]),
      },
    );
    const result = run(root);

    expect(result.output.capabilities.map((item) => [item.id, item.name])).toEqual([
      ["cap:mcp-tool:twin-server.search-notes", "search-notes"],
      ["cap:mcp-tool:twin-server.search-notes-2", "search_notes"],
    ]);
    expect(result.binds).toEqual(result.tools);
  });

  it("reads nothing from a module that does not parse, and lets the tools directory speak for it", () => {
    const root = repo(
      { name: "@fixture/broken-server", dependencies: { [V1]: "^1.20.0" } },
      {
        "src/server.ts": server(['server.registerTool("status", config, handler);']),
        "src/more.ts": 'server.registerTool("unterminated, config, handler);\n',
        "src/tools/archive.ts": "export {};\n",
      },
    );

    expect(run(root).tools).toEqual(["cap:mcp-tool:broken-server.archive", "cap:mcp-tool:broken-server.status"]);
  });
});
