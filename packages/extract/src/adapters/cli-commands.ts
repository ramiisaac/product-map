import { basename, posix } from "node:path";
import type { Bind } from "@product-map/spec";
import type { Adapter } from "../types";
import type { PackageInfo, RepoContext } from "@product-map/discovery";

import {
  CODE_FILE,
  DECLARATION_FILE,
  NOISE_STEM,
  TEST_FILE,
  commandModules,
  compareStrings,
  hasVscodeEngine,
  isNode,
  memberCall,
  moduleSpecifiers,
  out,
  parseModule,
  pkgName,
  prov,
  staticString,
  walk,
} from "./shared";
import type { NodeLike, ScriptFile } from "./shared";
import { slugify } from "@product-map/spec";

function commandOwner(pkg: PackageInfo): string {
  const bin = pkg.manifest["bin"];
  if (bin !== undefined && typeof bin === "object") {
    const first = Object.keys(bin as Record<string, string>).sort()[0];
    if (first !== undefined) return slugify(first);
  }
  return slugify(pkgName(pkg));
}

/** Repo-relative path inside a package, with the root package's empty dir handled. */
function inPkg(pkg: PackageInfo, rel: string): string {
  return pkg.dir === "" ? rel : `${pkg.dir}/${rel}`;
}

interface Declaration {
  /** Source offset, so declarations from chains and from object literals keep source order. */
  at: number;
  name: string;
  /** A usable static description, or null when the declaration has none. */
  description: string | null;
}

const I18N_KEY = /^[\w-]+(?:\.[\w-]+)+$/;

/** A static description worth reporting as purpose: whitespace collapsed, and never a bare i18n key. */
function usableDescription(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const text = candidate.replace(/\s+/g, " ").trim();
    if (text !== "" && !I18N_KEY.test(text)) return text;
  }
  return null;
}

/** A declared command name: the first word of a usage string, never a default-command or argument placeholder. */
function commandName(text: string | null, usage: boolean): string | null {
  if (text === null) return null;
  const name = usage ? (text.trim().split(/\s+/)[0] ?? "") : text.trim();
  return /^[$*[<]/.test(name) || !/[A-Za-z0-9]/.test(name) ? null : name;
}

/**
 * The `.description()` and `.summary()` of the method chain built on a
 * declaring call: each link is a member call whose receiver is the previous
 * link. The chain ends at the next declaring call (`.command(`, `.name(`) or
 * wherever the expression stops being such a chain.
 */
function chainDescriptions(
  declaring: NodeLike,
  ancestors: readonly NodeLike[],
): { description: string | null; summary: string | null } {
  const found: { description: string | null; summary: string | null } = { description: null, summary: null };
  let link = declaring;
  for (let i = ancestors.length - 2; i >= 0; i -= 2) {
    const call = memberCall(ancestors[i]);
    if (call === null || call.receiver !== link || call.method === "command" || call.method === "name") break;
    if (call.method === "description") found.description ??= staticString(call.args[0]);
    if (call.method === "summary") found.summary ??= staticString(call.args[0]);
    link = call.call;
  }
  return found;
}

/**
 * Commander/yargs/cac declarations: `.command("<name> ...")`, `.name("<name>")`,
 * and `new Command("<name>")`. A description comes only from the same
 * declaration: the chain's `.description()`, the second argument of
 * `.command()` (yargs, cac, commander's executable form), or the chain's
 * `.summary()`.
 */
function chainDeclaration(node: NodeLike, ancestors: readonly NodeLike[]): Declaration | null {
  const call = memberCall(node);
  let name: string | null = null;
  let positional: string | null = null;
  if (call?.method === "command") {
    name = commandName(staticString(call.args[0]), true);
    positional = staticString(call.args[1]);
  } else if (call?.method === "name") {
    name = commandName(staticString(call.args[0]), false);
  } else if (isNode(node, "NewExpression") && isNode(node.callee, "Identifier") && node.callee.name === "Command") {
    name = commandName(staticString(node.arguments[0]), false);
  }
  if (name === null) return null;
  const chained = chainDescriptions(node, ancestors);
  return {
    at: node.start ?? 0,
    name,
    description: usableDescription(chained.description, positional, chained.summary),
  };
}

/**
 * Spec objects: an object literal with a static string `name` and a
 * `description` or `summary` property — the shape of citty's
 * `defineCommand({ meta })` and of hand-rolled command specs.
 */
function objectDeclaration(node: NodeLike): Declaration | null {
  if (!isNode(node, "ObjectExpression")) return null;
  const properties = new Map<string, NodeLike>();
  for (const property of node.properties) {
    if (property.type !== "ObjectProperty" || property.computed) continue;
    const key = isNode(property.key, "Identifier") ? property.key.name : staticString(property.key);
    if (key !== null && !properties.has(key)) properties.set(key, property.value);
  }
  const name = commandName(staticString(properties.get("name")), false);
  if (name === null || (!properties.has("description") && !properties.has("summary"))) return null;
  return {
    at: node.start ?? 0,
    name,
    description: usableDescription(
      staticString(properties.get("description")),
      staticString(properties.get("summary")),
    ),
  };
}

function declarations(parsed: ScriptFile | null): Declaration[] {
  if (parsed === null) return [];
  const found: Declaration[] = [];
  walk(parsed.program, (node, ancestors) => {
    const declaration = chainDeclaration(node, ancestors) ?? objectDeclaration(node);
    if (declaration !== null) found.push(declaration);
  });
  return found.sort((a, b) => a.at - b.at);
}

interface ParsedModule {
  specifiers: string[];
  declarations: Declaration[];
}

type ModuleParser = (file: string) => ParsedModule;

/** Parses each module once; a module that does not parse declares and imports nothing. */
function moduleParser(ctx: RepoContext): ModuleParser {
  const parsed = new Map<string, ParsedModule>();
  return (file) => {
    const cached = parsed.get(file);
    if (cached !== undefined) return cached;
    const tree = parseModule(ctx.read(file) ?? "", file);
    const result = { specifiers: tree === null ? [] : moduleSpecifiers(tree), declarations: declarations(tree) };
    parsed.set(file, result);
    return result;
  };
}

const moduleKey = (file: string): string => file.replace(CODE_FILE, "");
const SPECIFIER_EXTENSION = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/;

/**
 * Modules under the commands dir imported by a sibling module. Top-level
 * wiring modules (an index, main, or registry) import every command by
 * design, so their imports say nothing about which modules are helpers.
 */
function importedBySiblings(files: readonly string[], dir: string, parse: ModuleParser): Set<string> {
  const imported = new Set<string>();
  for (const file of files) {
    if (!file.startsWith(`${dir}/`) || !CODE_FILE.test(file) || DECLARATION_FILE.test(file) || TEST_FILE.test(file)) {
      continue;
    }
    const rel = file.slice(dir.length + 1);
    if (!rel.includes("/") && NOISE_STEM.test(moduleKey(rel))) continue;
    for (const specifier of parse(file).specifiers) {
      if (!specifier.startsWith(".")) continue;
      const target = posix.join(posix.dirname(file), specifier).replace(SPECIFIER_EXTENSION, "");
      if (target !== moduleKey(file)) imported.add(target);
    }
  }
  return imported;
}

/**
 * The commands of one commands dir, each with the modules that make it up.
 * A top-level module is a command unless it declares no command and a sibling
 * imports it — then it is a helper. A directory is a command when it has an
 * index or eponymous entry module, or a direct child declaring a command of
 * the directory's name. Undeclared modules nobody imports keep the stem
 * fallback, so commands generated through a wrapper are never lost.
 */
function discoverCommands(files: readonly string[], dir: string, parse: ModuleParser): Map<string, string[]> {
  const imported = importedBySiblings(files, dir, parse);
  const commands = new Map<string, Set<string>>();
  const add = (stem: string, modules: readonly string[]): void => {
    const existing = commands.get(stem) ?? new Set<string>();
    for (const file of modules) existing.add(file);
    commands.set(stem, existing);
  };
  const directories = new Map<string, { members: string[]; entry: boolean }>();
  for (const candidate of commandModules(files, dir)) {
    if (candidate.directory) {
      const group = directories.get(candidate.stem) ?? { members: [], entry: false };
      group.members.push(candidate.file);
      group.entry ||= candidate.entry;
      directories.set(candidate.stem, group);
    } else if (parse(candidate.file).declarations.length > 0 || !imported.has(moduleKey(candidate.file))) {
      add(slugify(candidate.stem), [candidate.file]);
    }
  }
  for (const [directory, { members, entry }] of directories) {
    const stem = slugify(directory);
    if (entry || members.some((file) => parse(file).declarations.some((d) => slugify(d.name) === stem))) {
      add(stem, members);
    }
  }
  return new Map([...commands].map(([stem, modules]) => [stem, [...modules].sort()]));
}

/**
 * What the command's own declarations say about it: the modules declaring a
 * command of its name, and the first such declaration's description.
 */
function describeCommand(
  stem: string,
  modules: readonly string[],
  parse: ModuleParser,
): { purpose: string | null; declaringModules: string[] } {
  let purpose: string | null = null;
  const declaringModules: string[] = [];
  for (const file of modules) {
    const own = parse(file).declarations.filter((declaration) => slugify(declaration.name) === stem);
    if (own.length > 0) declaringModules.push(file);
    for (const declaration of own) purpose ??= declaration.description;
  }
  return { purpose, declaringModules };
}

/**
 * cli-commands: files under a CLI package's src/commands are its command
 * capabilities. Command ids are namespaced by their owning bin/package
 * (`cap:command:<owner>.<stem>`) so same-named commands in different CLIs
 * (e.g. two `init`s) never collide, and the id is always the module's stem —
 * a declared name only describes the command, it never renames it. VS Code
 * extension packages are handled by the vscode adapter instead.
 */
export const cliCommandsAdapter: Adapter = {
  name: "cli-commands",
  // single-package CLI repos keep src/commands at the repo root, which is the
  // common shape for a published CLI; excluding the root package here meant
  // every one of them extracted zero commands
  detect: (ctx) => ctx.packages.some((p) => ctx.exists(inPkg(p, "src/commands"))),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      const commandsDir = inPkg(pkg, "src/commands");
      if (!ctx.exists(commandsDir) || hasVscodeEngine(pkg)) continue;
      const files = ctx.listFiles(commandsDir, 2);
      const parse = moduleParser(ctx);
      const commands = discoverCommands(files, commandsDir, parse);
      if (commands.size === 0) continue;
      result.sources.push(commandsDir);
      const owner = commandOwner(pkg);
      // a command is only as distributable as the package that ships it, so
      // publication of that package is the observation reach follows
      const reach = pkg.manifest["private"] === true ? "internal" : "external";
      const placement = { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" } as const;
      const byBasename = new Map<string, string[]>();
      for (const file of files) {
        const key = slugify(basename(file).replace(CODE_FILE, ""));
        const matches = byBasename.get(key) ?? [];
        if (matches.length < 2) matches.push(file);
        byBasename.set(key, matches);
      }
      const binds: Bind[] = [];
      for (const [stem, modules] of [...commands.entries()].sort(([a], [b]) => compareStrings(a, b))) {
        const id = `cap:command:${owner}.${stem}`;
        const { purpose, declaringModules } = describeCommand(stem, modules, parse);
        const evidence = [...(byBasename.get(stem) ?? [])];
        for (const file of declaringModules) if (!evidence.includes(file)) evidence.push(file);
        result.capabilities.push({
          id,
          kind: "command",
          name: `${owner} ${stem}`,
          ...(purpose === null ? {} : { purpose }),
          surfaceArea: "cli",
          status: "live",
          reach,
          placement,
          provenance: prov(commandsDir, evidence, "medium"),
        });
        binds.push({ capabilityId: id, via: "inferred-high", note: `command module in ${commandsDir}` });
      }
      // attach the commands to CLI surfaces that live in the same package
      const bin = pkg.manifest["bin"];
      if (bin !== undefined) {
        // commands belong to the package's PRIMARY bin only — auxiliary bins
        // (e.g. a bundled lsp launcher) must not inherit the command set
        const names = (
          typeof bin === "string" ? [slugify(pkgName(pkg))] : Object.keys(bin as Record<string, string>).sort()
        ).slice(0, 1);
        for (const name of names) {
          result.surfaces.push({
            id: `surface:cli:${slugify(name)}`,
            surfaceType: "cli",
            name: `${name} CLI`,
            entry: { kind: "bin", value: name },
            purpose: `Command-line entrypoint \`${name}\` from ${pkgName(pkg)}.`,
            audience: ["developer"],
            status: pkg.manifest["private"] === true ? "partial" : "live",
            binds,
            placement,
            provenance: prov(inPkg(pkg, "package.json"), [inPkg(pkg, "package.json"), commandsDir], "high"),
          });
        }
      }
    }
    return result;
  },
};
