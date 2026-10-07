import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { dbSchemaAdapter } from "../adapters/db-schema";
import { mcpAdapter } from "../adapters/mcp";
import { supabaseMigrationsAdapter } from "../adapters/supabase-migrations";

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-review-"));
  for (const [path, content] of Object.entries({ "package.json": '{"name":"fixture","private":true}\n', ...files })) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

const DB_MANIFEST = `${JSON.stringify({ name: "@fixture/db", dependencies: { "drizzle-orm": "latest" } })}\n`;
const tableIds = (root: string): string[] =>
  dbSchemaAdapter.extract(loadRepoContext(root)).capabilities.map((item) => item.id);
const migrationIds = (sql: string): string[] =>
  supabaseMigrationsAdapter
    .extract(loadRepoContext(repo({ "supabase/migrations/001_init.sql": sql })))
    .capabilities.map((item) => item.id);

describe("decorated TypeScript still parses", () => {
  it("reads a table declared after a standard-decorated class", () => {
    const root = repo({
      "packages/db/package.json": DB_MANIFEST,
      "packages/db/src/schema/accounts.ts": [
        'import { pgTable, text } from "drizzle-orm/pg-core";',
        "@sealed",
        "export class Audit {}",
        'export const accounts = pgTable("accounts", { id: text("id") });',
        "",
      ].join("\n"),
    });
    expect(tableIds(root)).toEqual(["cap:entity:db.accounts"]);
  });

  it("reads a table declared after a legacy parameter-decorated class", () => {
    const root = repo({
      "packages/db/package.json": DB_MANIFEST,
      "packages/db/src/schema/accounts.ts": [
        'import { pgTable, text } from "drizzle-orm/pg-core";',
        "export class Repo { constructor(@Inject() private db: unknown) {} }",
        'export const accounts = pgTable("accounts", { id: text("id") });',
        "",
      ].join("\n"),
    });
    expect(tableIds(root)).toEqual(["cap:entity:db.accounts"]);
  });
});

describe("Drizzle schema receivers that are shadowed are not guessed", () => {
  it("skips a .table() call whose receiver is re-bound in a nested scope", () => {
    const root = repo({
      "packages/db/package.json": DB_MANIFEST,
      "packages/db/src/schema/tenants.ts": [
        'import { pgSchema, text } from "drizzle-orm/pg-core";',
        'export const tenant = pgSchema("billing");',
        'export const invoices = tenant.table("invoices", { id: text("id") });',
        "export function build() {",
        '  const tenant = pgSchema("crm");',
        '  return tenant.table("contacts", { id: text("id") });',
        "}",
        "",
      ].join("\n"),
    });
    expect(tableIds(root)).toEqual(["cap:entity:db.billing.invoices"]);
  });

  it.each([
    ["a class binding", '{ class tenant { static table() {} } tenant.table("phantom", {}); }'],
    ["a private method parameter", 'class Store { #build(tenant: unknown) { return tenant.table("phantom", {}); } }'],
    ["a catch binding", 'try {} catch (tenant) { tenant.table("phantom", {}); }'],
    ["a loop binding", 'for (const tenant of stores) { tenant.table("phantom", {}); }'],
    ["a hoisted var binding", 'function build() { tenant.table("phantom", {}); if (enabled) { var tenant = store; } }'],
    ["a destructured parameter", 'function build({ schema: tenant }) { return tenant.table("phantom", {}); }'],
  ])("does not resolve %s to the outer schema", (_label, source) => {
    const root = repo({
      "packages/db/package.json": DB_MANIFEST,
      "packages/db/src/schema/tables.ts": [
        'export const tenant = pgSchema("billing");',
        'export const invoices = tenant.table("invoices", {});',
        source,
      ].join("\n"),
    });
    expect(tableIds(root)).toEqual(["cap:entity:db.billing.invoices"]);
  });

  it("keeps the outer schema visible through unrelated bindings and destructured property keys", () => {
    const root = repo({
      "packages/db/package.json": DB_MANIFEST,
      "packages/db/src/schema/tables.ts": [
        'export const tenant = pgSchema("billing");',
        "function unrelated(tenant: unknown) {}",
        'export function build({ tenant: label }) { return tenant.table("invoices", {}); }',
      ].join("\n"),
    });
    expect(tableIds(root)).toEqual(["cap:entity:db.billing.invoices"]);
  });
});

describe("unterminated SQL never produces a table", () => {
  it.each([
    ["an unclosed $$ body", "create table phantom (id int default $$oops);"],
    ["an unclosed tagged dollar body", "create table phantom (id int default $tag$oops);"],
    ["an unclosed block comment", "create table phantom (id int /* never closed;"],
  ])("drops the statement holding %s", (_label, sql) => {
    expect(migrationIds(`create table kept (id int);\n${sql}\n`)).toEqual(["cap:entity:supabase.kept"]);
  });
});

describe("mcp fallback modules keep their raw identity", () => {
  it("keeps a tool module whose name only collides with a literal registration after slugging", () => {
    const root = repo({
      "packages/server/package.json": `${JSON.stringify({
        name: "@fixture/server",
        dependencies: { "@modelcontextprotocol/server": "^2.3.1" },
      })}\n`,
      "packages/server/src/index.ts": [
        'import { McpServer } from "@modelcontextprotocol/server";',
        'const server = new McpServer({ name: "s", version: "1" });',
        'server.registerTool("search-notes", {}, async () => ({ content: [] }));',
        "server.registerTool(dynamicName, {}, async () => ({ content: [] }));",
        "",
      ].join("\n"),
      "packages/server/src/tools/search_notes.ts": "export const run = () => 1;\n",
    });
    const output = mcpAdapter.extract(loadRepoContext(root));
    const ids = output.capabilities.map((item) => item.id).sort();
    expect(ids).toEqual(["cap:mcp-tool:server.search-notes", "cap:mcp-tool:server.search-notes-2"]);
    expect(output.surfaces.flatMap((surface) => surface.binds.map((bind) => bind.capabilityId)).sort()).toEqual(ids);
  });
});
