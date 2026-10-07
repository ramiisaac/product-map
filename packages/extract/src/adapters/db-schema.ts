import { posix } from "node:path";

import traverse from "@babel/traverse";

import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import {
  CODE_FILE,
  DECLARATION_FILE,
  TEST_FILE,
  isNode,
  out,
  parseModule,
  pkgName,
  prov,
  staticString,
  uniqueSlugs,
} from "./shared";
import type { NodeLike, ScriptFile } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

const SCHEMA_DIRS = ["src/schema", "src/db/schema", "schema"];
const SCAN_DEPTH = 4;
const TABLE_FACTORIES = new Set(["pgTable", "mysqlTable", "sqliteTable"]);
const SPECIFIER_EXTENSION = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/;

interface TableDeclaration {
  schema: string | null;
  table: string;
  file: string;
  purpose: string | undefined;
}

/** What a schema module binds at its top level: `pgSchema` bindings, their exported names, and its named imports. */
interface ModuleScope {
  file: string;
  parsed: ScriptFile;
  schemas: Map<string, string>;
  exportedSchemas: Map<string, string>;
  imports: Map<string, { source: string; imported: string }>;
}

const moduleKey = (file: string): string => file.replace(CODE_FILE, "");

const nameOf = (node: NodeLike): string | null =>
  isNode(node, "Identifier") ? node.name : isNode(node, "StringLiteral") ? node.value : null;

/** `pgSchema("<schema>")`, or null. */
function pgSchemaCall(node: NodeLike | null | undefined): string | null {
  if (!isNode(node, "CallExpression") || !isNode(node.callee, "Identifier") || node.callee.name !== "pgSchema") {
    return null;
  }
  return staticString(node.arguments[0]);
}

function moduleScope(file: string, parsed: ScriptFile): ModuleScope {
  const scope: ModuleScope = { file, parsed, schemas: new Map(), exportedSchemas: new Map(), imports: new Map() };
  const exportedLocals: Array<{ local: string; exported: string }> = [];
  for (const statement of parsed.program.body) {
    const exported = isNode(statement, "ExportNamedDeclaration");
    const declaration = exported ? statement.declaration : statement;
    if (isNode(declaration, "VariableDeclaration")) {
      for (const declarator of declaration.declarations) {
        const schema = pgSchemaCall(declarator.init);
        if (!isNode(declarator.id, "Identifier") || schema === null) continue;
        scope.schemas.set(declarator.id.name, schema);
        if (exported) scope.exportedSchemas.set(declarator.id.name, schema);
      }
    }
    if (isNode(statement, "ExportNamedDeclaration") && !statement.source) {
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ExportSpecifier") continue;
        const local = nameOf(specifier.local);
        const name = nameOf(specifier.exported);
        if (local !== null && name !== null) exportedLocals.push({ local, exported: name });
      }
    }
    if (isNode(statement, "ImportDeclaration") && statement.source.value.startsWith(".")) {
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ImportSpecifier") continue;
        const imported = nameOf(specifier.imported);
        if (imported !== null) scope.imports.set(specifier.local.name, { source: statement.source.value, imported });
      }
    }
  }
  for (const { local, exported } of exportedLocals) {
    const schema = scope.schemas.get(local);
    if (schema !== undefined) scope.exportedSchemas.set(exported, schema);
  }
  return scope;
}

/**
 * The schema a `<receiver>.table()` receiver names, through the module's own
 * scope only: a top-level `pgSchema` binding of its own, or a named import from
 * a sibling schema module that exports one. Null when it cannot be proved.
 */
function resolveSchema(
  receiver: NodeLike,
  scope: ModuleScope,
  modules: ReadonlyMap<string, ModuleScope>,
): string | null {
  const inline = pgSchemaCall(receiver);
  if (inline !== null || !isNode(receiver, "Identifier")) return inline;
  const local = scope.schemas.get(receiver.name);
  if (local !== undefined) return local;
  const binding = scope.imports.get(receiver.name);
  if (binding === undefined) return null;
  const target = posix.join(posix.dirname(scope.file), binding.source).replace(SPECIFIER_EXTENSION, "");
  const sibling = modules.get(target) ?? modules.get(`${target}/index`);
  return sibling?.exportedSchemas.get(binding.imported) ?? null;
}

/** The prose of a JSDoc block's value: leading `*` gutters stripped, block tags and everything after them dropped. */
function docText(value: string): string | undefined {
  const lines: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const text = line.replace(/^\s*\*?/, "").trim();
    if (text.startsWith("@")) break;
    lines.push(text);
  }
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  return text === "" ? undefined : text;
}

/**
 * The JSDoc on `export const <name> = <call>` when the call is that
 * declarator's whole initializer: the last comment before the export, and only
 * if it is a `/** *\/` block.
 */
function declarationDoc(call: NodeLike, ancestors: readonly NodeLike[]): string | undefined {
  const [statement, declaration, declarator] = ancestors.slice(-3);
  if (!isNode(declarator, "VariableDeclarator") || declarator.init !== call) return undefined;
  if (!isNode(declaration, "VariableDeclaration") || declaration.kind !== "const") return undefined;
  if (!isNode(statement, "ExportNamedDeclaration")) return undefined;
  const comment = statement.leadingComments?.at(-1);
  if (comment?.type !== "CommentBlock" || !comment.value.startsWith("*")) return undefined;
  return docText(comment.value.slice(1));
}

/**
 * Every table a module declares: `pgTable|mysqlTable|sqliteTable("name", ...)`
 * (bare or namespaced), and `<schema>.table("name", ...)` whose receiver
 * resolves to a `pgSchema("s")` binding, or is an inline `pgSchema("s")`. A
 * `.table()` receiver that cannot be resolved is skipped rather than emitted
 * unqualified: Drizzle forbids `pgSchema("public")`, so no resolvable receiver
 * is ever the default schema, and an unproven one may not be a schema at all.
 */
function tableDeclarations(scope: ModuleScope, modules: ReadonlyMap<string, ModuleScope>): TableDeclaration[] {
  const declarations: TableDeclaration[] = [];
  traverse(scope.parsed, {
    CallExpression(path) {
      const node = path.node;
      const table = staticString(node.arguments[0]);
      if (table === null || table === "") return;
      const callee = node.callee;
      const factory = isNode(callee, "Identifier")
        ? callee.name
        : isNode(callee, "MemberExpression") && !callee.computed && isNode(callee.property, "Identifier")
          ? callee.property.name
          : null;
      const ancestors = path
        .getAncestry()
        .slice(1)
        .reverse()
        .map((ancestor) => ancestor.node);
      if (factory !== null && TABLE_FACTORIES.has(factory)) {
        declarations.push({ schema: null, table, file: scope.file, purpose: declarationDoc(node, ancestors) });
        return;
      }
      if (factory !== "table" || !isNode(callee, "MemberExpression")) return;
      if (isNode(callee.object, "Identifier")) {
        const binding = path.scope.getBinding(callee.object.name);
        if (binding === undefined || !binding.constant || !binding.scope.path.isProgram()) return;
      }
      const schema = resolveSchema(callee.object, scope, modules);
      if (schema === null) return;
      declarations.push({ schema, table, file: scope.file, purpose: declarationDoc(node, ancestors) });
    },
  });
  return declarations;
}

/**
 * db-schema: every table a Drizzle schema declares is an entity capability,
 * keyed `<package>.<schema.>table` and described by the JSDoc on its
 * `export const`. Enums, relations, and other schema wiring declare no table
 * and so produce no entity; a module that does not parse declares nothing.
 */
export const dbSchemaAdapter: Adapter = {
  name: "db-schema",
  detect: (ctx) => ctx.packages.some((p) => depOf(p.manifest, "drizzle-orm")),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!depOf(pkg.manifest, "drizzle-orm")) continue;
      const prefix = pkg.dir === "" ? "" : `${pkg.dir}/`;
      const schemaDir = SCHEMA_DIRS.find((d) => ctx.exists(`${prefix}${d}`));
      if (schemaDir === undefined) continue;
      const scope = `${prefix}${schemaDir}`;
      result.sources.push(scope);
      const modules = new Map<string, ModuleScope>();
      for (const file of ctx
        .listFiles(scope, SCAN_DEPTH)
        .filter((f) => CODE_FILE.test(f) && !DECLARATION_FILE.test(f) && !TEST_FILE.test(f))
        .sort()) {
        const parsed = parseModule(ctx.read(file) ?? "", file);
        if (parsed !== null) modules.set(moduleKey(file), moduleScope(file, parsed));
      }

      // identity is the structured pair, so a public "a.b" and a.b stay two tables
      const tables = new Map<string, TableDeclaration>();
      for (const schemaModule of modules.values()) {
        for (const declaration of tableDeclarations(schemaModule, modules)) {
          const key = JSON.stringify([declaration.schema, declaration.table]);
          if (!tables.has(key)) tables.set(key, declaration);
        }
      }

      const owner = slugify(pkgName(pkg));
      const entries = [...tables.entries()].map(([key, declaration]) => ({
        key,
        name: declaration.schema === null ? declaration.table : `${declaration.schema}.${declaration.table}`,
        value: declaration,
      }));
      for (const { name, slug, value: declaration } of uniqueSlugs(entries)) {
        result.capabilities.push({
          id: `cap:entity:${owner}.${slug}`,
          kind: "entity",
          name,
          ...(declaration.purpose === undefined ? {} : { purpose: declaration.purpose }),
          surfaceArea: "db",
          status: "live",
          reach: DEFAULT_REACH["entity"],
          placement: { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" },
          provenance: prov(declaration.file, [declaration.file], "high"),
        });
      }
    }
    return result;
  },
};
