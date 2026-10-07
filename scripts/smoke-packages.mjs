import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "product-map-packages-"));
const archives = join(scratch, "archives");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "inherit",
  });
}

function pack(packageDir) {
  const before = new Set(readdirSync(archives, { recursive: false }));
  run("pnpm", ["--dir", packageDir, "pack", "--pack-destination", archives]);
  const archive = readdirSync(archives).find((name) => name.endsWith(".tgz") && !before.has(name));
  if (archive === undefined) throw new Error(`${packageDir}: pnpm pack did not create an archive`);
  return join(archives, archive);
}

function inspect(archive, required) {
  const entries = run("tar", ["-tzf", archive], { stdio: ["ignore", "pipe", "inherit"] })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const path of required) {
    if (!entries.includes(path)) throw new Error(`${archive}: missing ${path}`);
  }
  const forbidden = entries.filter(
    (path) =>
      path.includes("/src/") ||
      path.includes("/__tests__/") ||
      path.includes("/docs/internal/") ||
      path.endsWith("/.npmrc") ||
      path.includes("/.github/"),
  );
  if (forbidden.length > 0) throw new Error(`${archive}: unexpected files:\n${forbidden.join("\n")}`);
}

run("pnpm", ["build"]);
mkdirSync(archives, { recursive: true });

const specArchive = pack(join(repoRoot, "packages/spec"));
const pmapArchive = pack(join(repoRoot, "packages/pmap"));

inspect(specArchive, [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/schemas/surface-manifest.schema.json",
  "package/schemas/capability-manifest.schema.json",
  "package/schemas/map-manifest.schema.json",
  "package/schemas/diff-manifest.schema.json",
  "package/schemas/fleet-manifest.schema.json",
]);
inspect(pmapArchive, [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/dist/cli.js",
  "package/prompts/claude-code-reconcile.prompt.md",
  "package/prompts/claude-design-existing-project-manifest.prompt.md",
  "package/prompts/claude-design-new-project.prompt.md",
]);

const installRoot = join(scratch, "install");
mkdirSync(installRoot, { recursive: true });
writeFileSync(
  join(installRoot, "package.json"),
  `${JSON.stringify({
    name: "product-map-package-smoke",
    private: true,
    type: "module",
    dependencies: {
      "product-map": `file:${pmapArchive}`,
      "@product-map/spec": `file:${specArchive}`,
    },
    pnpm: {
      overrides: {
        "@product-map/spec": `file:${specArchive}`,
      },
    },
  })}\n`,
);
run("pnpm", ["install", "--ignore-workspace", "--prefer-offline", "--ignore-scripts"], { cwd: installRoot });

const help = run("node", ["node_modules/product-map/dist/cli.js", "--help"], {
  cwd: installRoot,
  stdio: ["ignore", "pipe", "inherit"],
});
if (!help.includes("check-fresh") || !help.includes("--no-repo-code")) {
  throw new Error("installed pmap CLI help is incomplete");
}

run(
  "node",
  [
    "--input-type=module",
    "--eval",
    'const tool = await import("product-map"); const spec = await import("@product-map/spec"); if (typeof tool.validateManifest !== "function" || typeof tool.GENERATOR?.version !== "string" || typeof spec.validateManifest !== "function") process.exit(1);',
  ],
  { cwd: installRoot },
);

// `pmap init` is the one command that reads assets off disk: prompts from this
// package, JSON Schemas resolved out of the @product-map/spec
// dependency. Running it against a real install is the only way to prove that
// resolution works outside the workspace.
const initTarget = join(scratch, "init-target");
mkdirSync(initTarget, { recursive: true });
writeFileSync(join(initTarget, "package.json"), `${JSON.stringify({ name: "init-target", private: true })}\n`);
run("node", ["node_modules/product-map/dist/cli.js", "init", "--repo", initTarget], { cwd: installRoot });
for (const rel of [
  "prompts/claude-design-new-project.prompt.md",
  "prompts/claude-design-existing-project-manifest.prompt.md",
  "prompts/claude-code-reconcile.prompt.md",
  "schemas/surface-manifest.schema.json",
  "schemas/capability-manifest.schema.json",
  "schemas/map-manifest.schema.json",
  "schemas/diff-manifest.schema.json",
  "schemas/fleet-manifest.schema.json",
]) {
  if (!existsSync(join(initTarget, "docs", "reference", "product-map", rel))) {
    throw new Error(`pmap init did not vendor ${rel} in an installed package`);
  }
}

// A .d.ts that names an unpublished specifier still "works" under skipLibCheck:
// every exported type silently degrades to any. So the check cannot merely be
// "tsc passes" — it must also be that a deliberate type error is REJECTED. If
// types degrade, that error stops firing and the test would pass while
// shipping junk.
const typeCheckDir = join(installRoot, "typecheck");
mkdirSync(typeCheckDir, { recursive: true });

const COMPILER_OPTIONS = {
  module: "ESNext",
  moduleResolution: "Bundler",
  strict: true,
  noEmit: true,
  types: [],
  skipLibCheck: true,
};

function writeTypeCheckCase(name, source) {
  writeFileSync(join(typeCheckDir, `${name}.ts`), source);
  writeFileSync(
    join(typeCheckDir, `tsconfig.${name}.json`),
    `${JSON.stringify({ compilerOptions: COMPILER_OPTIONS, files: [`./${name}.ts`] })}\n`,
  );
  return join(typeCheckDir, `tsconfig.${name}.json`);
}

const validProject = writeTypeCheckCase(
  "consumer",
  'import { GENERATOR, validateManifest } from "product-map";\n' +
    "const version: string = GENERATOR.version;\n" +
    "const ok: boolean = validateManifest({}).ok;\n" +
    "export const summary = `${version}${ok}`;\n",
);
const brokenProject = writeTypeCheckCase(
  "broken",
  'import { GENERATOR } from "product-map";\nexport const wrong: number = GENERATOR.version;\n',
);

run("pnpm", ["exec", "tsc", "-p", validProject], { cwd: installRoot });

let rejectedBrokenTypes = false;
try {
  run("pnpm", ["exec", "tsc", "-p", brokenProject], { cwd: installRoot, stdio: ["ignore", "pipe", "pipe"] });
} catch {
  rejectedBrokenTypes = true;
}
if (!rejectedBrokenTypes) {
  throw new Error("published types degraded to any: a deliberate type error was not rejected");
}

for (const archive of [specArchive, pmapArchive]) {
  const manifest = JSON.parse(
    run("tar", ["-xOf", archive, "package/package.json"], { stdio: ["ignore", "pipe", "inherit"] }),
  );
  if (manifest.license !== "MIT" || manifest.publishConfig?.access !== "public") {
    throw new Error(`${manifest.name}: package metadata is not public MIT`);
  }
}

console.log(`Packed, inspected, installed, executed, and imported both packages from ${scratch}.`);
