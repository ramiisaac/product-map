import type { Adapter } from "../types";

import { out, prov, uniqueSlugs } from "./shared";
import { DEFAULT_REACH } from "@product-map/spec";

/** `unterminated` stands for a quoted identifier or string constant that never closes: it can name nothing. */
type SqlToken = { kind: "keyword" | "quoted" | "punct" | "unterminated"; value: string };

const WORD_START = /[A-Za-z_\u0080-\uffff]/;
const WORD_PART = /[\w$\u0080-\uffff]/;
const DOLLAR_TAG = /\$(?:[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*)?\$/y;

/** The index just past a (nested) block comment, or -1 when it never closes. */
function skipBlockComment(sql: string, start: number): number {
  let depth = 0;
  let j = start;
  while (j < sql.length) {
    const pair = sql.slice(j, j + 2);
    if (pair === "/*") {
      depth++;
      j += 2;
    } else if (pair === "*/") {
      j += 2;
      if (--depth === 0) return j;
    } else {
      j++;
    }
  }
  return -1;
}

/** The index just past a string constant, or -1 when it never closes. */
function skipString(sql: string, start: number, backslashEscapes: boolean): number {
  let j = start + 1;
  while (j < sql.length) {
    const ch = sql.charAt(j);
    if (backslashEscapes && ch === "\\") {
      j += 2;
    } else if (ch === "'") {
      if (sql.charAt(j + 1) !== "'") return j + 1;
      j += 2;
    } else {
      j++;
    }
  }
  return -1;
}

function readQuotedIdentifier(sql: string, start: number): { token: SqlToken; end: number } {
  let value = "";
  let j = start + 1;
  while (j < sql.length) {
    const ch = sql.charAt(j);
    if (ch === '"') {
      if (sql.charAt(j + 1) !== '"') return { token: { kind: "quoted", value }, end: j + 1 };
      value += '"';
      j += 2;
    } else {
      value += ch;
      j++;
    }
  }
  return { token: { kind: "unterminated", value }, end: sql.length };
}

function afterSkip(tokens: SqlToken[], end: number, length: number): number {
  if (end !== -1) return end;
  tokens.push({ kind: "unterminated", value: "" });
  return length;
}

/**
 * Words and quoted identifiers outside comments, string constants, and
 * dollar-quoted bodies. Unquoted words fold to lowercase as Postgres folds
 * them; quoted identifiers keep their case.
 */
function sqlTokens(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql.charAt(i);
    const next = sql.charAt(i + 1);
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "-" && next === "-") {
      const newline = sql.indexOf("\n", i);
      i = newline === -1 ? sql.length : newline + 1;
    } else if (ch === "/" && next === "*") {
      i = afterSkip(tokens, skipBlockComment(sql, i), sql.length);
    } else if (ch === "'") {
      i = afterSkip(tokens, skipString(sql, i, false), sql.length);
    } else if (ch === '"') {
      const { token, end } = readQuotedIdentifier(sql, i);
      tokens.push(token);
      i = end;
    } else if (ch === "$") {
      DOLLAR_TAG.lastIndex = i;
      const tag = DOLLAR_TAG.exec(sql);
      if (tag === null) {
        i++;
      } else {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        i = afterSkip(tokens, close === -1 ? -1 : close + tag[0].length, sql.length);
      }
    } else if (WORD_START.test(ch)) {
      let j = i + 1;
      while (j < sql.length && WORD_PART.test(sql.charAt(j))) j++;
      const word = sql.slice(i, j);
      if ((word === "E" || word === "e") && sql.charAt(j) === "'") {
        i = afterSkip(tokens, skipString(sql, j, true), sql.length);
      } else {
        tokens.push({ kind: "keyword", value: word.toLowerCase() });
        i = j;
      }
    } else if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < sql.length && /[\w.]/.test(sql.charAt(j))) j++;
      i = j;
    } else {
      tokens.push({ kind: "punct", value: ch });
      i++;
    }
  }
  return tokens;
}

const isPunct = (token: SqlToken | undefined, value: string): boolean =>
  token?.kind === "punct" && token.value === value;

const isKeyword = (token: SqlToken | undefined, value: string): boolean =>
  token?.kind === "keyword" && token.value === value;

const isName = (token: SqlToken | undefined): token is SqlToken =>
  token?.kind === "keyword" || token?.kind === "quoted";

/**
 * Where the statement holding an unterminated literal begins. A literal that
 * never closes runs to the end of the file, so it is always the last token and
 * Postgres rejects its whole statement; nothing from there on is declared.
 */
function brokenStatementStart(tokens: readonly SqlToken[]): number {
  const unterminated = tokens.findIndex((token) => token.kind === "unterminated");
  if (unterminated === -1) return tokens.length;
  let start = unterminated;
  while (start > 0 && !isPunct(tokens[start - 1], ";")) start--;
  return start;
}

/**
 * The persistent tables a migration creates: `CREATE [GLOBAL|LOCAL]
 * [UNLOGGED] TABLE [IF NOT EXISTS] [schema.]name`, whatever follows the name
 * (a column list, `LIKE`, `AS`, `PARTITION OF`). Temporary tables do not
 * outlive the session, so they are not entities.
 */
function createdTables(sql: string): Array<{ schema: string | undefined; table: string }> {
  const tokens = sqlTokens(sql);
  const tables: Array<{ schema: string | undefined; table: string }> = [];
  const broken = brokenStatementStart(tokens);
  for (let i = 0; i < broken; i++) {
    if (!isKeyword(tokens[i], "create")) continue;
    let j = i + 1;
    if (isKeyword(tokens[j], "global") || isKeyword(tokens[j], "local")) j++;
    const temporary = isKeyword(tokens[j], "temp") || isKeyword(tokens[j], "temporary");
    if (temporary || isKeyword(tokens[j], "unlogged")) j++;
    if (!isKeyword(tokens[j], "table")) continue;
    j++;
    if (isKeyword(tokens[j], "if") && isKeyword(tokens[j + 1], "not") && isKeyword(tokens[j + 2], "exists")) j += 3;
    const parts: string[] = [];
    for (let name = tokens[j]; isName(name); name = tokens[j]) {
      parts.push(name.value);
      j++;
      if (tokens[j]?.value !== "." || tokens[j]?.kind !== "punct") break;
      j++;
    }
    const table = parts.at(-1);
    if (temporary || table === undefined || isPunct(tokens[j - 1], ".")) continue;
    tables.push({ schema: parts.at(-2), table });
  }
  return tables;
}

/**
 * supabase-migrations: the tables the migrations declare are entity
 * capabilities (drizzle-independent). Statements are matched on SQL tokens, so
 * a `create table` inside a comment, a string constant, a quoted identifier,
 * or a dollar-quoted body (a function or `DO` block, which is not top-level
 * DDL) is never read as one. This reports observed declarations: a table a
 * later migration drops or renames is still reported under its declared name.
 */
export const supabaseMigrationsAdapter: Adapter = {
  name: "supabase-migrations",
  detect: (ctx) => ctx.listFiles("supabase/migrations", 1).some((f) => f.endsWith(".sql")),
  extract(ctx) {
    const result = out();
    const tables = new Map<string, { name: string; file: string }>();
    for (const file of ctx
      .listFiles("supabase/migrations", 1)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const content = ctx.read(file);
      if (content === null) continue;
      for (const { schema, table } of createdTables(content)) {
        // identity is the structured pair, so public "a.b" and a.b stay two tables
        const qualifier = schema !== undefined && schema !== "public" ? schema : null;
        const key = JSON.stringify([qualifier, table]);
        if (!tables.has(key)) tables.set(key, { name: qualifier === null ? table : `${qualifier}.${table}`, file });
      }
    }
    const entries = [...tables.entries()].map(([key, { name, file }]) => ({ key, name, value: file }));
    for (const { name, slug, value: file } of uniqueSlugs(entries)) {
      result.sources.push(file);
      result.capabilities.push({
        id: `cap:entity:supabase.${slug}`,
        kind: "entity",
        name,
        surfaceArea: "db",
        status: "live",
        reach: DEFAULT_REACH["entity"],
        placement: { current: "supabase/migrations", verdict: "correct" },
        provenance: prov(file, [file], "high"),
      });
    }
    return result;
  },
};
