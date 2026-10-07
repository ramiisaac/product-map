import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { dbSchemaAdapter } from "../adapters/db-schema";

function write(root: string, path: string, content: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function schemaRepo(files: Record<string, string>, schemaDir = "src/schema"): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-d7-"));
  write(root, "package.json", '{"name":"fixture","private":true}\n');
  write(
    root,
    "packages/db/package.json",
    `${JSON.stringify({ name: "@fixture/db", dependencies: { "drizzle-orm": "latest" } })}\n`,
  );
  for (const [file, content] of Object.entries(files)) write(root, `packages/db/${schemaDir}/${file}`, content);
  return root;
}

const entities = (root: string) =>
  dbSchemaAdapter.extract(loadRepoContext(root)).capabilities.map((item) => ({
    id: item.id,
    name: item.name,
    purpose: item.purpose,
    source: item.provenance.source,
    confidence: item.provenance.confidence,
  }));

describe("db-schema emits one entity per declared table", () => {
  it("describes tables from the JSDoc on their export const", () => {
    const root = schemaRepo({
      "core.ts": [
        'import { pgTable, uuid, text } from "drizzle-orm/pg-core";',
        "",
        "/** A person who can sign in. */",
        'export const users = pgTable("users", { id: uuid("id").primaryKey() });',
        "",
        "/**",
        " * An organization that owns projects.",
        " *",
        " * Every user belongs to at least one.",
        " * @see users",
        " */",
        "export const organizations = pgTable(",
        '  "organizations",',
        '  { id: uuid("id").primaryKey(), name: text("name") },',
        ");",
        "",
      ].join("\n"),
    });

    expect(entities(root)).toEqual([
      {
        id: "cap:entity:db.organizations",
        name: "organizations",
        purpose: "An organization that owns projects. Every user belongs to at least one.",
        source: "packages/db/src/schema/core.ts",
        confidence: "high",
      },
      {
        id: "cap:entity:db.users",
        name: "users",
        purpose: "A person who can sign in.",
        source: "packages/db/src/schema/core.ts",
        confidence: "high",
      },
    ]);
  });

  it("leaves an undocumented table without a purpose, and never borrows a detached comment", () => {
    const root = schemaRepo({
      "sessions.ts": [
        "/** Not about sessions. */",
        "const retentionDays = 30;",
        'export const sessions = pgTable("sessions", { id: uuid("id") });',
        "// Login attempts, kept for rate limiting.",
        'export const user_login_attempts = pgTable("user_login_attempts", { id: uuid("id") });',
        "",
      ].join("\n"),
    });

    expect(entities(root).map(({ id, purpose }) => ({ id, purpose }))).toEqual([
      { id: "cap:entity:db.sessions", purpose: undefined },
      { id: "cap:entity:db.user-login-attempts", purpose: undefined },
    ]);
  });

  it("keeps a schema-qualified table distinct from a public table of the same name", () => {
    const root = schemaRepo({
      "users.ts": 'export const users = pgTable("users", { id: uuid("id") });\n',
      "audit.ts": [
        "export const audit = pgSchema(",
        '  "audit",',
        ");",
        "/** Who changed what, as a copy of the user row at the time. */",
        'export const auditUsers = audit.table("users", { id: uuid("id") });',
        'export const auditEvents = pgSchema("audit").table("events", { id: uuid("id") });',
        "",
      ].join("\n"),
    });

    expect(entities(root).map(({ id, name, purpose }) => ({ id, name, purpose }))).toEqual([
      { id: "cap:entity:db.audit.events", name: "audit.events", purpose: undefined },
      {
        id: "cap:entity:db.audit.users",
        name: "audit.users",
        purpose: "Who changed what, as a copy of the user row at the time.",
      },
      { id: "cap:entity:db.users", name: "users", purpose: undefined },
    ]);
  });

  it("resolves a pgSchema binding declared in a sibling schema module", () => {
    const root = schemaRepo({
      "schemas.ts": 'export const billing = pgSchema("billing");\n',
      "invoices.ts": 'import { billing } from "./schemas";\nexport const invoices = billing.table("invoices", {});\n',
    });

    expect(entities(root).map((entity) => entity.id)).toEqual(["cap:entity:db.billing.invoices"]);
  });

  it("reads sqlite and mysql tables", () => {
    const root = schemaRepo(
      {
        "local.ts": 'export const bookmarks = sqliteTable("bookmarks", { id: integer("id") });\n',
        "legacy.ts": 'export const orders = mysqlTable("orders", { id: int("id") });\n',
      },
      "src/db/schema",
    );

    expect(entities(root).map((entity) => entity.id)).toEqual(["cap:entity:db.bookmarks", "cap:entity:db.orders"]);
  });

  it("emits no entity for a schema module holding only enums and relations", () => {
    const root = schemaRepo({
      "enums.ts": 'export const role = pgEnum("role", ["admin", "member"]);\n',
      "relations.ts":
        'import { relations } from "drizzle-orm";\nexport const usersRelations = relations(users, ({ many }) => ({ posts: many(posts) }));\n',
    });

    expect(entities(root)).toEqual([]);
  });

  it("does not read a table call inside a comment or a string", () => {
    const root = schemaRepo({
      "notes.ts": [
        '// export const drafts = pgTable("drafts", {});',
        'export const example = "pgTable(\\"examples\\", {})";',
        'export const notes = pgTable("notes", {});',
        "",
      ].join("\n"),
    });

    expect(entities(root).map((entity) => entity.id)).toEqual(["cap:entity:db.notes"]);
  });
});

describe("db-schema resolves schemas through each module's own scope", () => {
  it("does not qualify a receiver that is only named like a sibling module's schema binding", () => {
    const root = schemaRepo({
      "schemas.ts": 'export const audit = pgSchema("audit");\n',
      "logs.ts": 'const audit = createLogStore();\nexport const entries = audit.table("entries", {});\n',
      "events.ts": 'export const events = audit.table("events", {});\n',
    });

    expect(entities(root)).toEqual([]);
  });

  it("follows an import to the module it names when sibling modules bind one name to different schemas", () => {
    const root = schemaRepo({
      "billing.ts": 'export const tenant = pgSchema("billing");\n',
      "crm.ts": 'export const tenant = pgSchema("crm");\n',
      "invoices.ts": 'import { tenant } from "./billing.js";\nexport const invoices = tenant.table("invoices", {});\n',
      "contacts.ts":
        'import { tenant as schema } from "./crm";\nexport const contacts = schema.table("contacts", {});\n',
    });

    expect(entities(root).map((entity) => entity.id)).toEqual([
      "cap:entity:db.billing.invoices",
      "cap:entity:db.crm.contacts",
    ]);
  });

  it("follows an export list that names a local schema binding", () => {
    const root = schemaRepo({
      "schemas/index.ts": 'const reporting = pgSchema("reporting");\nexport { reporting as analytics };\n',
      "views.ts": 'import { analytics } from "./schemas";\nexport const daily = analytics.table("daily", {});\n',
    });

    expect(entities(root).map((entity) => entity.id)).toEqual(["cap:entity:db.reporting.daily"]);
  });

  it.each([
    ["a direct export", 'export let tenant = pgSchema("billing");\ntenant = pgSchema("crm");'],
    ["an aliased export", 'let local = pgSchema("billing");\nlocal = pgSchema("crm");\nexport { local as tenant };'],
  ])("does not resolve a reassigned schema through %s", (_label, source) => {
    const root = schemaRepo({
      "schemas.ts": source,
      "contacts.ts": 'import { tenant } from "./schemas.js";\nexport const contacts = tenant.table("contacts", {});',
      "fixed.ts": 'export const audit = pgSchema("audit");',
      "events.ts": 'import { audit } from "./fixed.js";\nexport const events = audit.table("events", {});',
    });

    expect(entities(root).map((entity) => entity.id)).toEqual(["cap:entity:db.audit.events"]);
  });
});

describe("db-schema reads table declarations from a real parse", () => {
  it("does not take the literal prefix of a concatenated table name", () => {
    const root = schemaRepo({
      "dynamic.ts":
        'export const shard = pgTable("events_" + region, {});\nexport const fixed = pgTable("fixed", {});\n',
    });

    expect(entities(root).map((entity) => entity.id)).toEqual(["cap:entity:db.fixed"]);
  });

  it("finds a table declared after division of an object literal member on the same line", () => {
    const root = schemaRepo({
      "core.ts": 'const half = { n: 4 }.n / 2; export const users = pgTable("users", {}); const q = 1 / 2;\n',
    });

    expect(entities(root).map((entity) => entity.id)).toEqual(["cap:entity:db.users"]);
  });

  it("declares nothing from a module that does not parse", () => {
    const root = schemaRepo({
      "broken.ts": 'export const users = pgTable("users, {});\n',
      "ok.ts": 'export const teams = pgTable("teams", {});\n',
    });

    expect(entities(root).map((entity) => entity.id)).toEqual(["cap:entity:db.teams"]);
  });

  it("keeps a public table named a.b distinct from table b in schema a", () => {
    const root = schemaRepo({
      "tables.ts":
        'export const dotted = pgTable("a.b", {});\nexport const qualified = pgSchema("a").table("b", {});\n',
    });

    expect(entities(root).map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "cap:entity:db.a.b", name: "a.b" },
      { id: "cap:entity:db.a.b-2", name: "a.b" },
    ]);
  });
});
