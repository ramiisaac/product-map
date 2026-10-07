import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { validateManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { ADAPTERS } from "..";
import { extractRepo } from "..";
import { loadRepoContext } from "@product-map/discovery";

const toolGenerator = { name: "pmap", version: "0.0.0" } as const;

function write(root: string, path: string, content = "export {};\n"): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function pkg(root: string, dir: string, manifest: Record<string, unknown>): void {
  write(root, `${dir}/package.json`, `${JSON.stringify(manifest)}\n`);
}

function allAdaptersFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-adapters-"));
  write(
    root,
    "package.json",
    `${JSON.stringify({ name: "fixture", private: true, scripts: { tool: "tsx packages/tools/src/cli.ts" } })}\n`,
  );
  write(root, "packages/tools/src/cli.ts");

  pkg(root, "packages/cli", { name: "@fixture/cli", bin: { fixture: "dist/cli.js" } });
  write(root, "packages/cli/src/commands/scan.ts");

  pkg(root, "apps/web", { name: "@fixture/web", dependencies: { next: "latest" } });
  write(root, "apps/web/app/page.tsx");
  write(root, "apps/web/app/api/health/route.ts");

  pkg(root, "apps/api", { name: "@fixture/api", dependencies: { hono: "latest" } });
  write(root, "apps/api/src/routes/users.ts", 'export const users = new Hono().get("/", (c) => c.json([]));\n');

  pkg(root, "packages/lsp", { name: "@fixture/lsp", dependencies: { "vscode-languageserver": "latest" } });
  write(root, "packages/lsp/src/server.ts", "connection.onHover(() => null);\n");

  pkg(root, "packages/vscode", {
    name: "@fixture/vscode",
    engines: { vscode: "^1.90.0" },
    contributes: { commands: [{ command: "fixture.hello", title: "Hello" }] },
  });
  write(root, "apps/editors/zed/extension.toml", 'id = "fixture"\n');
  write(root, "apps/editors/jetbrains/src/main/resources/META-INF/plugin.xml", "<idea-plugin />\n");
  write(root, "action.yml", "name: Fixture Action\nruns:\n  using: node24\n");

  pkg(root, "packages/email", { name: "@fixture/email", dependencies: { resend: "latest" } });
  write(root, "packages/email/src/templates/welcome.tsx");
  pkg(root, "packages/reporters", { name: "@fixture/reporters" });
  write(root, "packages/reporters/src/html.ts");
  pkg(root, "packages/db", { name: "@fixture/db", dependencies: { "drizzle-orm": "latest" } });
  write(root, "packages/db/src/schema/users.ts", 'export const users = pgTable("users", { id: uuid("id") });\n');

  pkg(root, "apps/tui", { name: "@fixture/tui", dependencies: { ink: "latest" } });
  pkg(root, "apps/worker", { name: "@fixture/worker" });
  pkg(root, "packages/mcp", { name: "@fixture/mcp", dependencies: { "@modelcontextprotocol/sdk": "latest" } });
  write(root, "packages/mcp/src/server.ts", 'import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";\n');
  write(root, "packages/mcp/src/tools/search.ts");
  pkg(root, "packages/sdk", { name: "@fixture/sdk", exports: { ".": "./dist/index.js" } });

  pkg(root, "apps/desktop", { name: "@fixture/desktop", dependencies: { electron: "latest" } });
  write(
    root,
    "apps/apple/project.yml",
    "targets:\n  FixtureMac:\n    type: application\n    platform: macOS\n    sources: [Sources]\n",
  );
  write(root, "docs/specs/features/search.yaml", "title: Search\n");
  write(root, "supabase/functions/hello/index.ts");
  write(root, "supabase/migrations/001_users.sql", "CREATE TABLE public.users (id uuid primary key);\n");
  write(root, "prisma/schema.prisma", "model Account {\n  id String @id\n}\n");

  pkg(root, "apps/docs", { name: "@fixture/docs", dependencies: { mintlify: "latest" } });
  pkg(root, "packages/api", { name: "@fixture/trpc-api", dependencies: { "@trpc/server": "latest" } });
  write(root, "packages/api/src/routers/account.ts");

  claudePlugin(root, "plugins/toolkit", "toolkit");
  write(root, ".claude-plugin/marketplace.json", `${JSON.stringify({ name: "fixture", plugins: [{}] })}\n`);
  return root;
}

function claudePlugin(root: string, dir: string, name: string): void {
  write(root, `${dir}/.claude-plugin/plugin.json`, `${JSON.stringify({ name, description: `${name} plugin` })}\n`);
  write(
    root,
    `${dir}/skills/audit/SKILL.md`,
    "---\nname: audit-everything\ndescription: Audits things.\n---\n\nBody.\n",
  );
  write(root, `${dir}/commands/ship.md`, "---\ndescription: Ships it.\n---\n\nBody.\n");
  write(root, `${dir}/agents/reviewer.md`, "---\nname: reviewer\ndescription: Reviews.\n---\n\nBody.\n");
}

describe("adapter coverage", () => {
  it("keeps every registered adapter observable through a representative repository fixture", async () => {
    const result = await extractRepo(loadRepoContext(allAdaptersFixture()), { generator: toolGenerator });

    expect(result.adaptersRun.sort()).toEqual(ADAPTERS.map((adapter) => adapter.name).sort());
    expect(validateManifest(result.surfaces).ok).toBe(true);
    expect(validateManifest(result.capabilities).ok).toBe(true);

    expect(result.surfaces.items.map((item) => item.surfaceType)).toEqual(
      expect.arrayContaining([
        "cli",
        "dashboard",
        "lsp",
        "vscode",
        "zed",
        "jetbrains",
        "github-action",
        "email",
        "tui",
        "mcp",
        "desktop",
        "macos",
        "docs",
        "agent-plugin",
        "registry",
      ]),
    );
    expect(result.capabilities.items.map((item) => item.kind)).toEqual(
      expect.arrayContaining([
        "command",
        "route",
        "lsp-method",
        "extension-api",
        "email-contract",
        "reporter",
        "entity",
        "service",
        "mcp-tool",
        "package",
        "action",
        "query",
        "agent-skill",
        "agent-subagent",
      ]),
    );
  });

  it("models a Claude Code plugin as a surface providing its components as capabilities", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-claude-plugin-"));
    write(root, "package.json", '{"name":"fixture","private":true}\n');
    claudePlugin(root, "plugins/toolkit", "toolkit");

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const plugin = result.surfaces.items.find((item) => item.id === "surface:agent-plugin:toolkit");

    expect(plugin?.placement.current).toBe("plugins/toolkit");
    expect(plugin?.purpose).toBe("toolkit plugin");
    // the skill's declared front-matter name wins over its directory name
    expect(result.capabilities.items.map((item) => item.id)).toEqual([
      "cap:agent-skill:toolkit.audit-everything",
      "cap:agent-subagent:toolkit.reviewer",
      "cap:command:toolkit.ship",
    ]);
    expect(plugin?.binds.map((bind) => bind.capabilityId)).toEqual(
      result.capabilities.items.map((item) => item.id).sort(),
    );
    expect(plugin?.binds.every((bind) => bind.via === "explicit")).toBe(true);
    // a component's front-matter description is its purpose, never doctrine
    const skill = result.capabilities.items.find((item) => item.kind === "agent-skill");
    expect(skill?.purpose).toBe("Audits things.");
    expect(skill?.doctrine).toBeUndefined();
    expect(validateManifest(result.surfaces).ok).toBe(true);
    expect(validateManifest(result.capabilities).ok).toBe(true);
  });

  it("namespaces plugin components so two plugins can ship the same command", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-two-plugins-"));
    write(root, "package.json", '{"name":"fixture","private":true}\n');
    claudePlugin(root, "plugins/alpha", "alpha");
    claudePlugin(root, "plugins/beta", "beta");

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(result.capabilities.items.filter((item) => item.kind === "command").map((item) => item.id)).toEqual([
      "cap:command:alpha.ship",
      "cap:command:beta.ship",
    ]);
    expect(validateManifest(result.capabilities).ok).toBe(true);
  });

  it("does not mistake an MCP client SDK for an MCP server", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-mcp-client-"));
    write(root, "package.json", '{"name":"fixture","private":true}\n');
    pkg(root, "packages/client", {
      name: "@fixture/mcp-client",
      dependencies: { "@modelcontextprotocol/sdk": "latest" },
    });

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(result.adaptersRun).toContain("mcp");
    expect(result.surfaces.items.some((item) => item.surfaceType === "mcp")).toBe(false);
  });

  it("uses valid repository-relative paths for a root-package MCP server", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-mcp-root-"));
    write(
      root,
      "package.json",
      `${JSON.stringify({ name: "@fixture/root-mcp", dependencies: { "@modelcontextprotocol/sdk": "latest" } })}\n`,
    );
    write(root, "src/server.ts", 'import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";\n');
    write(root, "src/tools/search.ts");

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const surface = result.surfaces.items.find((item) => item.surfaceType === "mcp");

    expect(surface?.placement.current).toBe(".");
    expect(surface?.provenance.source).toBe("package.json");
    expect(result.capabilities.items.some((item) => item.id === "cap:mcp-tool:root-mcp.search")).toBe(true);
    expect(validateManifest(result.surfaces).ok).toBe(true);
  });
});

describe("command discovery", () => {
  it("finds commands in a single-package CLI repo, where they sit at the repo root", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-root-cli-"));
    write(root, "package.json", `${JSON.stringify({ name: "solo", bin: { solo: "./bin/run.js" } })}\n`);
    write(root, "src/commands/deploy.ts");
    write(root, "src/commands/status.ts");

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });
    const cli = result.surfaces.items.find((item) => item.id === "surface:cli:solo");

    expect(result.adaptersRun).toContain("cli-commands");
    expect(result.capabilities.items.filter((item) => item.kind === "command").map((item) => item.id)).toEqual([
      "cap:command:solo.deploy",
      "cap:command:solo.status",
    ]);
    expect(cli?.binds.map((bind) => bind.capabilityId)).toEqual(["cap:command:solo.deploy", "cap:command:solo.status"]);
    expect(cli?.placement.current).toBe(".");
    expect(validateManifest(result.surfaces).ok).toBe(true);
  });

  it("accepts an eponymous entry module and ignores its helpers and declarations", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-eponymous-"));
    write(root, "package.json", `${JSON.stringify({ name: "solo", bin: { solo: "./bin/run.js" } })}\n`);
    write(root, "src/commands/deploy/deploy.ts");
    write(root, "src/commands/deploy/option_values.ts");
    write(root, "src/commands/link/index.ts");
    write(root, "src/commands/base-command.ts");
    write(root, "src/commands/types.d.ts", "export {};\n");

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(result.capabilities.items.filter((item) => item.kind === "command").map((item) => item.id)).toEqual([
      "cap:command:solo.deploy",
      "cap:command:solo.link",
    ]);
  });

  it("skips build output at a package root but not a command named build", async () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-build-dir-"));
    write(root, "package.json", `${JSON.stringify({ name: "solo", bin: { solo: "./bin/run.js" } })}\n`);
    write(root, "src/commands/build/index.ts");
    write(root, "dist/commands/leaked.ts");
    write(root, "build/commands/leaked.ts");

    const result = await extractRepo(loadRepoContext(root), { generator: toolGenerator });

    expect(result.capabilities.items.filter((item) => item.kind === "command").map((item) => item.id)).toEqual([
      "cap:command:solo.build",
    ]);
  });
});

/**
 * What each adapter must contribute from the representative fixture. The
 * coverage test above proves every adapter *ran*; this proves each one
 * produced the kind of item it exists to produce, so an adapter cannot go
 * silently empty while still reporting itself as having run.
 */
const ADAPTER_CONTRIBUTIONS: Record<string, { surfaceTypes?: string[]; capabilityKinds?: string[] }> = {
  "claude-plugin": { surfaceTypes: ["agent-plugin", "registry"], capabilityKinds: ["agent-skill", "agent-subagent"] },
  "trpc-routers": { capabilityKinds: ["query"] },
  "prisma-schema": { capabilityKinds: ["entity"] },
  "app-frameworks": { surfaceTypes: ["docs"] },
  "root-script-cli": { surfaceTypes: ["cli"] },
  "supabase-migrations": { capabilityKinds: ["entity"] },
  xcodegen: { surfaceTypes: ["macos"] },
  "spec-yaml": { capabilityKinds: ["action"] },
  "supabase-functions": { capabilityKinds: ["route"] },
  "package-exports": { capabilityKinds: ["package"] },
  desktop: { surfaceTypes: ["desktop"] },
  bins: { surfaceTypes: ["cli"] },
  "cli-commands": { surfaceTypes: ["cli"], capabilityKinds: ["command"] },
  "next-apps": { surfaceTypes: ["dashboard"], capabilityKinds: ["route"] },
  "hono-api": { capabilityKinds: ["route"] },
  lsp: { surfaceTypes: ["lsp"], capabilityKinds: ["lsp-method"] },
  vscode: { surfaceTypes: ["vscode"], capabilityKinds: ["extension-api"] },
  "editor-manifests": { surfaceTypes: ["zed", "jetbrains"] },
  "github-action": { surfaceTypes: ["github-action"] },
  email: { surfaceTypes: ["email"], capabilityKinds: ["email-contract"] },
  reporters: { capabilityKinds: ["reporter"] },
  "db-schema": { capabilityKinds: ["entity"] },
  tui: { surfaceTypes: ["tui"] },
  workers: { capabilityKinds: ["service"] },
  mcp: { surfaceTypes: ["mcp"], capabilityKinds: ["mcp-tool"] },
};

describe("per-adapter contributions", () => {
  const ctx = loadRepoContext(allAdaptersFixture());

  it("expects a contribution from every registered adapter", () => {
    expect(Object.keys(ADAPTER_CONTRIBUTIONS).sort()).toEqual(ADAPTERS.map((adapter) => adapter.name).sort());
  });

  for (const adapter of ADAPTERS) {
    it(`${adapter.name} emits what it exists to emit`, () => {
      expect(adapter.detect(ctx)).toBe(true);
      const output = adapter.extract(ctx);
      const expected = ADAPTER_CONTRIBUTIONS[adapter.name] ?? {};

      for (const surfaceType of expected.surfaceTypes ?? []) {
        expect(output.surfaces.map((item) => item.surfaceType)).toContain(surfaceType);
      }
      for (const kind of expected.capabilityKinds ?? []) {
        expect(output.capabilities.map((item) => item.kind)).toContain(kind);
      }
      // an adapter that ran must also have recorded what it read
      expect(output.sources.length).toBeGreaterThan(0);
      for (const item of [...output.surfaces, ...output.capabilities]) {
        expect(item.placement.current).not.toBe("");
        expect(item.provenance.evidence.length).toBeGreaterThan(0);
      }
    });
  }
});
