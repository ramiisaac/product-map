import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { supabaseMigrationsAdapter } from "../adapters/supabase-migrations";
import { uniqueSlugs } from "../adapters/shared";

function write(root: string, path: string, content: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function entities(...migrations: string[]): Array<{ id: string; name: string }> {
  const root = mkdtempSync(join(tmpdir(), "pmap-d2-"));
  write(root, "package.json", '{"name":"fixture","private":true}\n');
  migrations.forEach((sql, index) => write(root, `supabase/migrations/00${index + 1}_migration.sql`, sql));
  return supabaseMigrationsAdapter.extract(loadRepoContext(root)).capabilities.map(({ id, name }) => ({ id, name }));
}

const ids = (...migrations: string[]): string[] => entities(...migrations).map((entity) => entity.id);

describe("supabase-migrations reads tables from SQL tokens, not raw text", () => {
  it("ignores a create table phrase inside a line comment", () => {
    expect(
      ids("-- create table audit_log once the backfill lands\nCREATE TABLE public.users (id uuid primary key);\n"),
    ).toEqual(["cap:entity:supabase.users"]);
  });

  it("ignores create table inside a block comment that nests another comment", () => {
    expect(ids("/* outer /* inner */ create table ghost (id int); */\ncreate table real_one (id int);\n")).toEqual([
      "cap:entity:supabase.real-one",
    ]);
  });

  it("ignores create table inside a string literal", () => {
    expect(
      ids("create table notes (body text);\ninsert into notes (body) values ('create table phantom (id int)');\n"),
    ).toEqual(["cap:entity:supabase.notes"]);
  });

  it("honors backslash escapes in an E'' string", () => {
    expect(ids("select E'it\\'s create table phantom (x int)';\ncreate table kept (id int);\n")).toEqual([
      "cap:entity:supabase.kept",
    ]);
  });

  it("skips a dollar-quoted body by its own tag, even when it contains $$", () => {
    expect(
      ids(
        [
          "create function make_tables() returns void language plpgsql as $fn$",
          "begin",
          "  execute $$create table nested (id int)$$;",
          "  create table inner_tbl (id int);",
          "end;",
          "$fn$;",
          "create table outer_tbl (id int);",
          "",
        ].join("\n"),
      ),
    ).toEqual(["cap:entity:supabase.outer-tbl"]);
  });

  it("does not observe DDL inside a DO block", () => {
    expect(
      ids("do $$ begin create table if not exists from_do (id int); end $$;\ncreate table after_do (id int);\n"),
    ).toEqual(["cap:entity:supabase.after-do"]);
  });

  it("does not read a quoted identifier's contents as SQL", () => {
    expect(ids('create table events ("create table shadow" text);\n')).toEqual(["cap:entity:supabase.events"]);
  });

  it("handles doubled quotes in strings and quoted identifiers", () => {
    expect(
      entities(
        'insert into t values (\'it\'\'s create table fake (id int)\');\ncreate table t (v text);\ncreate table "say ""hi""" (id int);\n',
      ),
    ).toEqual([
      { id: "cap:entity:supabase.say-hi", name: 'say "hi"' },
      { id: "cap:entity:supabase.t", name: "t" },
    ]);
  });

  it("reads past IF NOT EXISTS to the table name", () => {
    expect(ids("CREATE TABLE IF NOT EXISTS public.profiles (id uuid);\n")).toEqual(["cap:entity:supabase.profiles"]);
  });

  it("keys a non-public schema-qualified table by schema and drops the public schema", () => {
    expect(entities('create table billing.invoices (id int);\ncreate table "public"."users" (id int);\n')).toEqual([
      { id: "cap:entity:supabase.billing.invoices", name: "billing.invoices" },
      { id: "cap:entity:supabase.users", name: "users" },
    ]);
  });

  it("folds unquoted identifiers to lowercase", () => {
    expect(entities("CREATE TABLE Accounts (id int);\n")).toEqual([
      { id: "cap:entity:supabase.accounts", name: "accounts" },
    ]);
  });

  it("keeps the created table of a LIKE form, not the table it copies", () => {
    expect(ids("create table archived_orders (like orders including all);\n")).toEqual([
      "cap:entity:supabase.archived-orders",
    ]);
  });

  it("keeps the created table of an AS form", () => {
    expect(ids("create table order_totals as select customer_id, sum(total) from orders group by 1;\n")).toEqual([
      "cap:entity:supabase.order-totals",
    ]);
  });

  it("keeps a partitioned table and its partition", () => {
    expect(
      ids(
        "create table measurements (logdate date) partition by range (logdate);\n" +
          "create table measurements_2026 partition of measurements for values from ('2026-01-01') to ('2027-01-01');\n",
      ),
    ).toEqual(["cap:entity:supabase.measurements", "cap:entity:supabase.measurements-2026"]);
  });

  it("skips temporary tables and keeps unlogged ones", () => {
    expect(
      ids(
        "create temp table scratch (id int);\n" +
          "create temporary table scratch_two (id int);\n" +
          "create global temporary table scratch_three (id int);\n" +
          "create unlogged table cache_entries (key text);\n",
      ),
    ).toEqual(["cap:entity:supabase.cache-entries"]);
  });

  it("gives distinct raw keys that slugify alike deterministic suffixes in sorted raw-key order", () => {
    expect(entities('create table "Foo" (id int);\ncreate table foo (id int);\n')).toEqual([
      { id: "cap:entity:supabase.foo", name: "Foo" },
      { id: "cap:entity:supabase.foo-2", name: "foo" },
    ]);
  });

  it("never suffixes into a slug another table produces on its own", () => {
    expect(
      entities('create table "Foo" (id int);\ncreate table foo (id int);\ncreate table foo_2 (id int);\n'),
    ).toEqual([
      { id: "cap:entity:supabase.foo", name: "Foo" },
      { id: "cap:entity:supabase.foo-3", name: "foo" },
      { id: "cap:entity:supabase.foo-2", name: "foo_2" },
    ]);
  });

  it("reports a table declared in two migrations once, from the first", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-d2-first-"));
    write(root, "package.json", '{"name":"fixture","private":true}\n');
    write(root, "supabase/migrations/001_init.sql", "create table users (id int);\n");
    write(root, "supabase/migrations/002_again.sql", "create table if not exists users (id int);\n");

    const output = supabaseMigrationsAdapter.extract(loadRepoContext(root));

    expect(output.capabilities.map((item) => [item.id, item.provenance.source])).toEqual([
      ["cap:entity:supabase.users", "supabase/migrations/001_init.sql"],
    ]);
  });
});

describe("supabase-migrations identities and unterminated literals", () => {
  it("keeps a public table named a.b distinct from table b in schema a", () => {
    expect(entities('create table "a.b" (id int);\ncreate table a.b (id int);\n')).toEqual([
      { id: "cap:entity:supabase.a.b", name: "a.b" },
      { id: "cap:entity:supabase.a.b-2", name: "a.b" },
    ]);
  });

  it("declares nothing from an unterminated quoted identifier", () => {
    expect(ids('create table ok (id int);\ncreate table "users (id int);\n')).toEqual(["cap:entity:supabase.ok"]);
  });

  it("declares nothing from a statement whose string constant never closes", () => {
    expect(ids("create table ok (id int);\ncreate table bad (note text default 'oops);\n")).toEqual([
      "cap:entity:supabase.ok",
    ]);
  });

  it("declares nothing from a qualified name that ends in a dangling dot", () => {
    expect(ids("create table billing. (id int);\ncreate table ok (id int);\n")).toEqual(["cap:entity:supabase.ok"]);
  });
});

describe("uniqueSlugs", () => {
  it("suffixes many colliding names in one pass, each to a distinct id", () => {
    const names = Array.from({ length: 500 }, (_, index) => `t${" ".repeat(index)}`);
    const slugs = uniqueSlugs(names.map((name) => ({ key: name, name, value: null }))).map((entry) => entry.slug);

    expect(new Set(slugs).size).toBe(500);
    expect(slugs.slice(0, 3)).toEqual(["t", "t-2", "t-3"]);
    expect(slugs.at(-1)).toBe("t-500");
  });

  it("keeps entries with one name but different keys distinct, ordered by key", () => {
    expect(
      uniqueSlugs([
        { key: "b", name: "same", value: 2 },
        { key: "a", name: "same", value: 1 },
      ]).map(({ slug, value }) => [slug, value]),
    ).toEqual([
      ["same", 1],
      ["same-2", 2],
    ]);
  });
});
