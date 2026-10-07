import { basename } from "node:path";

import { parse } from "@babel/parser";
import type { Expression, File, ParserPlugin } from "@babel/parser";

import type { AdapterOutput } from "../types";
import type { PackageInfo } from "@product-map/discovery";
import { slugify } from "@product-map/spec";

// Helpers used by two or more adapters. Anything single-use stays in its own
// adapter file; promote a helper here only when a second adapter needs it.

export function out(partial?: Partial<AdapterOutput>): AdapterOutput {
  return { surfaces: [], capabilities: [], sources: [], ...partial };
}

export function prov(source: string, evidence: string[], confidence: "high" | "medium" | "low") {
  return { source, evidence, confidence } as const;
}

export function pkgName(pkg: PackageInfo): string {
  return typeof pkg.manifest["name"] === "string" ? (pkg.manifest["name"] as string) : pkg.dir || "root";
}

export const CODE_FILE = /\.(ts|tsx|mts|mjs|js)$/;
export const DECLARATION_FILE = /\.d\.(ts|mts)$/;
export const TEST_FILE = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\./;
export const NOISE_STEM =
  /^(index|main|base|base-command|types|helpers?|utils?|constants|shared|internal|command-registry|register-commands|exit-codes|output-sinks|argv-parser|registry|context|options|flags|run)$/;

export interface CommandModule {
  file: string;
  /** The top-level file's own stem, or the directory name for a module inside a command directory. Not slugified. */
  stem: string;
  directory: boolean;
  /** Whether this module alone makes its stem a command: any top-level file, or a directory's index/eponymous file. */
  entry: boolean;
}

/**
 * The modules of a commands dir that can belong to a command: top-level files
 * (commands/scan.ts) and the direct children of a command directory
 * (commands/fix/*.ts). Deeper files are a command's helpers, never commands.
 */
export function commandModules(files: readonly string[], dir: string): CommandModule[] {
  const modules: CommandModule[] = [];
  for (const file of files) {
    if (!file.startsWith(`${dir}/`) || !CODE_FILE.test(file)) continue;
    if (file.includes("__tests__") || file.includes("/_") || DECLARATION_FILE.test(file)) continue;
    const [head = "", member, ...deeper] = file.slice(dir.length + 1).split("/");
    if (deeper.length > 0) continue;
    const leaf = basename(file).replace(CODE_FILE, "");
    const stem = member === undefined ? leaf : head;
    if (isTestOrNoise(stem)) continue;
    if (member === undefined) {
      modules.push({ file, stem, directory: false, entry: true });
    } else if (!isTestStem(leaf)) {
      modules.push({ file, stem, directory: true, entry: leaf === "index" || leaf === stem });
    }
  }
  return modules;
}

const isTestStem = (stem: string): boolean => stem.endsWith(".test") || stem.endsWith(".spec");
const isTestOrNoise = (stem: string): boolean => isTestStem(stem) || NOISE_STEM.test(stem);

/**
 * A command is a top-level file in the commands dir (commands/scan.ts) or a
 * command directory with an entry module — either commands/fix/index.ts or the
 * eponymous commands/fix/fix.ts, both common conventions. Other files NESTED
 * inside a command directory are that command's helpers, never commands
 * themselves; treating them as commands minted dozens of phantoms.
 */
export function commandStems(files: readonly string[], dir: string): string[] {
  const stems = new Set(
    commandModules(files, dir)
      .filter((candidate) => candidate.entry)
      .map((candidate) => slugify(candidate.stem)),
  );
  return [...stems].sort();
}

export function hasVscodeEngine(pkg: PackageInfo): boolean {
  const engines = pkg.manifest["engines"];
  return engines !== null && typeof engines === "object" && "vscode" in (engines as Record<string, unknown>);
}

/**
 * Slugs for distinct identities, in sorted (name, key) order: `key` is what
 * makes an entry distinct, `name` is what its slug is derived from. An entry
 * whose slug an earlier entry already holds takes the lowest free `-2`, `-3`
 * suffix rather than silently colliding into one id; a suffix never takes a
 * slug some other entry produces on its own.
 */
export function uniqueSlugs<T>(
  entries: ReadonlyArray<{ key: string; name: string; value: T }>,
): Array<{ key: string; name: string; slug: string; value: T }> {
  const sorted = [...entries].sort((a, b) => compareStrings(a.name, b.name) || compareStrings(a.key, b.key));
  const reserved = new Set(sorted.map((entry) => slugify(entry.name)));
  const claimed = new Set<string>();
  const nextSuffix = new Map<string, number>();
  return sorted.map((entry) => {
    const base = slugify(entry.name);
    let slug = base;
    if (claimed.has(base)) {
      let n = nextSuffix.get(base) ?? 2;
      while (reserved.has(`${base}-${n}`) || claimed.has(`${base}-${n}`)) n++;
      slug = `${base}-${n}`;
      nextSuffix.set(base, n + 1);
    }
    claimed.add(slug);
    return { ...entry, slug };
  });
}

export const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export type { File as ScriptFile };
type Statement = File["program"]["body"][number];
type VariableDeclarator = Extract<Statement, { type: "VariableDeclaration" }>["declarations"][number];
type ObjectMember = Extract<Expression, { type: "ObjectExpression" }>["properties"][number];
type ClassMember = Extract<Expression, { type: "ClassExpression" }>["body"]["body"][number];
type CatchClause = NonNullable<Extract<Statement, { type: "TryStatement" }>["handler"]>;
type KnownNode = Expression | Statement | VariableDeclarator | ObjectMember | ClassMember | CatchClause;
export type ScriptNode<K extends KnownNode["type"]> = Extract<KnownNode, { type: K }>;

export interface NodeLike {
  readonly type: string;
  readonly start?: number | null;
}

const TS_ONLY = /\.(ts|mts|cts)$/;

/**
 * Parses a JavaScript or TypeScript module, recovering from what errors it
 * can; null when the source cannot be parsed at all. JSX is enabled except in
 * `.ts` files, where it would make `<Type>value` assertions unparseable.
 * Standard and legacy decorators are mutually exclusive in Babel, so a module
 * the standard proposal rejects is retried with the legacy plugin.
 */
export function parseModule(source: string, file: string): File | null {
  const base: ParserPlugin[] = TS_ONLY.test(file) ? ["typescript"] : ["typescript", "jsx"];
  for (const decorators of ["decorators", "decorators-legacy"] as const) {
    try {
      return parse(source, { sourceType: "module", plugins: [...base, decorators], errorRecovery: true });
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Narrows a walked node by its discriminant. Walked children come from
 * untyped child slots, so this check is the one boundary where a node gains
 * its Babel type.
 */
export function isNode<K extends KnownNode["type"]>(node: NodeLike | null | undefined, type: K): node is ScriptNode<K> {
  return node?.type === type;
}

const NON_CHILD_KEYS = new Set(["leadingComments", "innerComments", "trailingComments", "loc", "extra", "range"]);

const isNodeLike = (value: unknown): value is NodeLike =>
  typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";

/** Visits every node under `root` depth-first, with its ancestors from the root down to its parent. */
export function walk(root: NodeLike, visit: (node: NodeLike, ancestors: readonly NodeLike[]) => void): void {
  const ancestors: NodeLike[] = [];
  const enter = (node: NodeLike): void => {
    visit(node, ancestors);
    ancestors.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (NON_CHILD_KEYS.has(key)) continue;
      const children: unknown[] = Array.isArray(value) ? value : [value];
      for (const child of children) if (isNodeLike(child)) enter(child);
    }
    ancestors.pop();
  };
  enter(root);
}

/** The value of an argument that is wholly static: a string literal, or a template literal with no expressions. */
export function staticString(node: NodeLike | null | undefined): string | null {
  if (isNode(node, "StringLiteral")) return node.value;
  if (isNode(node, "TemplateLiteral") && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? null;
  return null;
}

export interface MemberCall {
  call: NodeLike;
  receiver: NodeLike;
  method: string;
  args: readonly NodeLike[];
}

/** `<receiver>.<method>(...args)`, optional chaining included; null for anything else. */
export function memberCall(node: NodeLike | null | undefined): MemberCall | null {
  if (!isNode(node, "CallExpression") && !isNode(node, "OptionalCallExpression")) return null;
  const callee = node.callee;
  if (!isNode(callee, "MemberExpression") && !isNode(callee, "OptionalMemberExpression")) return null;
  if (callee.computed || !isNode(callee.property, "Identifier")) return null;
  return { call: node, receiver: callee.object, method: callee.property.name, args: node.arguments };
}

/** Every static module specifier the module imports, re-exports, requires, or dynamically imports. */
export function moduleSpecifiers(file: File): string[] {
  const specifiers: string[] = [];
  walk(file.program, (node) => {
    let specifier: string | null = null;
    if (isNode(node, "ImportDeclaration") || isNode(node, "ExportAllDeclaration")) specifier = node.source.value;
    else if (isNode(node, "ExportNamedDeclaration")) specifier = node.source?.value ?? null;
    else if (isNode(node, "ImportExpression")) specifier = staticString(node.source);
    else if (isNode(node, "TSImportEqualsDeclaration") && node.moduleReference.type === "TSExternalModuleReference") {
      specifier = node.moduleReference.expression.value;
    } else if (isNode(node, "CallExpression") && isNode(node.callee, "Identifier") && node.callee.name === "require") {
      specifier = staticString(node.arguments[0]);
    }
    if (specifier !== null) specifiers.push(specifier);
  });
  return specifiers;
}
