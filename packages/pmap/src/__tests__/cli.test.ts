import { existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import type { SurfaceManifest } from "@product-map/spec";
import { finalizeManifest, serializeManifest } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { COMMANDS } from "@product-map/engine";

const workspaceRoot = resolve(import.meta.dirname, "../../../..");
const tsx = join(workspaceRoot, "node_modules", ".bin", "tsx");
const cli = join(workspaceRoot, "packages", "pmap", "src", "cli.ts");

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-cli-"));
  write(join(root, "package.json"), JSON.stringify({ name: "fixture", private: true }));
  write(
    join(root, "apps", "cli", "package.json"),
    JSON.stringify({ name: "@fixture/cli", bin: { fixture: "./dist/index.js" }, dependencies: { commander: "^12" } }),
  );
  write(join(root, "apps", "cli", "src", "commands", "scan.ts"), "export const scan = true;\n");
  return root;
}

function run(root: string, ...args: string[]) {
  return spawnSync(tsx, [cli, ...args, "--repo", root], { encoding: "utf8" });
}

function productMap(root: string, rel: string): string {
  return join(root, "docs", "reference", "product-map", rel);
}

function addPlannedSurface(root: string): void {
  const existing = JSON.parse(readFileSync(productMap(root, "surfaces.existing.json"), "utf8")) as SurfaceManifest;
  const planned = finalizeManifest<SurfaceManifest>({
    ...existing,
    stance: "planned",
    generatedFrom: { commit: null, workingTree: "not-applicable", sources: ["example-design"] },
    generator: { name: "manual", version: "1.0.0" },
  });
  write(productMap(root, "surfaces.planned.json"), serializeManifest(planned));
}

describe("CLI artifact lifecycle", () => {
  it("reports generated Markdown in a complete all dry-run", () => {
    const root = fixtureRepo();
    const result = run(root, "all", "--dry-run");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("generated/README.generated.md");
    expect(existsSync(productMap(root, "surfaces.existing.json"))).toBe(false);
  });

  it("removes planned-derived artifacts when planned input is removed", () => {
    const root = fixtureRepo();
    expect(run(root, "all").status).toBe(0);
    addPlannedSurface(root);
    expect(run(root, "all").status).toBe(0);
    const plannedOutputs = [
      "maps/planned-surfaces-vs-existing-capabilities.json",
      "diffs/surfaces.diff.json",
      "generated/planned-surfaces-vs-existing-capabilities.generated.md",
      "generated/surfaces.planned.generated.md",
      "generated/reconciliation-plan.generated.md",
    ];
    for (const rel of plannedOutputs) expect(existsSync(productMap(root, rel))).toBe(true);

    unlinkSync(productMap(root, "surfaces.planned.json"));
    expect(run(root, "all").status).toBe(0);

    for (const rel of plannedOutputs) expect(existsSync(productMap(root, rel)), rel).toBe(false);
  });

  it("reports downstream Markdown drift from the regenerated in-memory graph", () => {
    const root = fixtureRepo();
    expect(run(root, "all").status).toBe(0);
    write(join(root, "apps", "cli", "src", "commands", "export.ts"), "export const exportCommand = true;\n");

    const result = run(root, "check-fresh");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("generated/capabilities.existing.generated.md");
  });

  it("stays fresh after an artifact-only commit changes HEAD", () => {
    const root = fixtureRepo();
    execFileSync("git", ["init", "--quiet", root]);
    execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]);
    execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
    execFileSync("git", ["-C", root, "add", "."]);
    execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "source"]);
    expect(run(root, "all").status).toBe(0);
    execFileSync("git", ["-C", root, "add", "docs/reference/product-map"]);
    execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "artifacts"]);

    const result = run(root, "check-fresh");

    expect(result.status).toBe(0);
  });

  it("validates every ingest input before writing any target", () => {
    const root = fixtureRepo();
    expect(run(root, "all").status).toBe(0);
    const existing = JSON.parse(readFileSync(productMap(root, "surfaces.existing.json"), "utf8")) as SurfaceManifest;
    const valid = join(root, "valid.json");
    const invalid = join(root, "invalid.json");
    write(
      valid,
      JSON.stringify({
        ...existing,
        stance: "planned",
        contentHash: "",
        generatedFrom: { commit: null, workingTree: "not-applicable", sources: ["design"] },
      }),
    );
    write(invalid, JSON.stringify({ stance: "planned", items: "not-an-array" }));

    const result = run(root, "ingest", valid, invalid);

    expect(result.status).toBe(1);
    expect(existsSync(productMap(root, "surfaces.planned.json"))).toBe(false);
  });

  it("reports malformed manifest JSON without an uncaught stack trace", () => {
    const root = fixtureRepo();
    write(productMap(root, "surfaces.existing.json"), "{not-json\n");

    const result = run(root, "validate");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pmap:");
    expect(result.stderr).not.toContain("SyntaxError:");
  });
});

describe("CLI repository-code policy", () => {
  it("does not import product-map.config.mjs with --no-repo-code", () => {
    const root = fixtureRepo();
    write(join(root, "product-map.config.mjs"), 'throw new Error("config executed");\n');

    const result = run(root, "extract", "--no-repo-code");

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("config executed");
  });

  it("does not execute extract.local.mjs with --no-repo-code", () => {
    const root = fixtureRepo();
    const marker = join(root, "extractor-ran");
    write(
      productMap(root, "extract.local.mjs"),
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\nconsole.log(JSON.stringify({ surfaces: [], capabilities: [], sources: [] }));\n`,
    );

    const result = run(root, "extract", "--no-repo-code");

    expect(result.status).toBe(0);
    expect(existsSync(marker)).toBe(false);
  });

  it("fails closed and writes nothing when the local extractor emits invalid items", () => {
    const root = fixtureRepo();
    write(
      productMap(root, "extract.local.mjs"),
      `console.log(JSON.stringify({ surfaces: [], capabilities: [{ id: "cap:query:bad", kind: "command" }], sources: [] }));\n`,
    );

    const result = run(root, "all");

    // the authoritative extractor is broken, so the run must fail rather than
    // silently write manifests missing its contributions
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("repo-local extractor failed");
    expect(existsSync(productMap(root, "surfaces.existing.json"))).toBe(false);
  });

  it("degrades explicitly with --allow-partial-local", () => {
    const root = fixtureRepo();
    write(
      productMap(root, "extract.local.mjs"),
      `console.log(JSON.stringify({ surfaces: [], capabilities: [{ id: "cap:query:bad", kind: "command" }], sources: [] }));\n`,
    );

    const result = run(root, "all", "--allow-partial-local");

    expect(result.status).toBe(0);
    expect(existsSync(productMap(root, "surfaces.existing.json"))).toBe(true);
  });

  it("fails a run atomically: a corrupt planned manifest leaves existing artifacts untouched", () => {
    const root = fixtureRepo();
    expect(run(root, "all").status).toBe(0);
    const capsBefore = readFileSync(productMap(root, "capabilities.existing.json"), "utf8");
    // add a new source (so extraction would change the existing manifests) and
    // corrupt a downstream input in the same run
    write(join(root, "apps", "cli", "src", "commands", "deploy.ts"), "export const deploy = true;\n");
    write(productMap(root, "surfaces.planned.json"), "{ not json");

    const result = run(root, "all");

    expect(result.status).toBe(1);
    // the existing capability manifest must NOT have been rewritten
    expect(readFileSync(productMap(root, "capabilities.existing.json"), "utf8")).toBe(capsBefore);
  });

  it("rejects a valid manifest placed in the wrong slot", () => {
    const root = fixtureRepo();
    expect(run(root, "all").status).toBe(0);
    // a real, valid capability manifest, dropped into the surfaces slot
    const caps = readFileSync(productMap(root, "capabilities.existing.json"), "utf8");
    write(productMap(root, "surfaces.existing.json"), caps);

    const result = run(root, "validate");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must be a existing surface manifest");
  });

  it("rejects a non-canonical manifest on disk", () => {
    const root = fixtureRepo();
    expect(run(root, "all").status).toBe(0);
    const surfaces = productMap(root, "surfaces.existing.json");
    // compact it: still valid JSON and a valid manifest, but not canonical bytes
    write(surfaces, JSON.stringify(JSON.parse(readFileSync(surfaces, "utf8"))));

    const result = run(root, "validate");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not canonical");
  });

  it("flags an unexpected JSON file under the product-map directory", () => {
    const root = fixtureRepo();
    expect(run(root, "all").status).toBe(0);
    write(productMap(root, "stray.json"), "{}\n");

    const result = run(root, "validate");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unexpected JSON file");
  });
});

describe("CLI argument handling", () => {
  function runRaw(...args: string[]) {
    return spawnSync(tsx, [cli, ...args], { encoding: "utf8" });
  }

  it("prints the package version for --version", () => {
    const pkg = JSON.parse(readFileSync(join(workspaceRoot, "packages", "pmap", "package.json"), "utf8")) as {
      version: string;
    };

    const result = runRaw("--version");

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it("prints the same version for the -v short flag", () => {
    expect(runRaw("-v").stdout).toBe(runRaw("--version").stdout);
  });

  it("reports an unknown flag with usage instead of a stack trace", () => {
    const result = runRaw("extract", "--bogus");

    expect(result.status).toBe(1);
    expect(result.stderr.startsWith("pmap: Unknown option '--bogus'.")).toBe(true);
    expect(result.stderr).toContain("Usage: pmap");
    expect(result.stderr).not.toContain("ERR_PARSE_ARGS_UNKNOWN_OPTION");
  });

  it("reports an unknown command with usage", () => {
    const result = runRaw("bogus");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown command "bogus"');
  });

  it("exits non-zero with usage when no command is given", () => {
    const result = runRaw();

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Usage: pmap");
  });
});

describe("command registry", () => {
  it("documents every registered command in the usage block", () => {
    const help = spawnSync(tsx, [cli, "--help"], { encoding: "utf8" }).stdout;

    for (const name of Object.keys(COMMANDS)) {
      expect(help).toContain(`  ${name}`);
    }
  });

  it("keeps this repository's own extractor aligned with the registry", () => {
    // extract.local.mjs reads commands.ts to emit one capability per command;
    // if the registry's shape changes, the repo's own map silently loses its
    // command inventory unless this fails first.
    const extractor = join(workspaceRoot, "docs", "reference", "product-map", "extract.local.mjs");
    const output = JSON.parse(execFileSync(process.execPath, [extractor, workspaceRoot], { encoding: "utf8" })) as {
      capabilities: Array<{ id: string }>;
    };

    expect(output.capabilities.map((capability) => capability.id).sort()).toEqual(
      Object.keys(COMMANDS)
        .map((name) => `cap:command:pmap.${name}`)
        .sort(),
    );
  });
});

describe("stream discipline", () => {
  it("keeps progress diagnostics off stdout so command output stays pipeable", () => {
    const result = run(fixtureRepo(), "all", "--dry-run");

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("surfaces,");
    expect(result.stdout).not.toContain("surfaces,");
    expect(result.stdout).toContain("generated/README.generated.md");
  });

  it("silences diagnostics under --quiet without silencing the write report", () => {
    const result = run(fixtureRepo(), "all", "--dry-run", "--quiet");

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("generated/README.generated.md");
  });

  it("still reports a failure under --quiet", () => {
    const root = fixtureRepo();
    const result = run(root, "map", "--quiet");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pmap: map requires existing manifests");
  });
});

describe("read-only commands", () => {
  it("show works in a repo that has never adopted product-map", () => {
    const root = fixtureRepo();
    const result = run(root, "show");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("surface:cli:fixture");
    expect(existsSync(productMap(root, "surfaces.existing.json"))).toBe(false);
  });

  it("digest leads with paths and stays inside an explicit token budget", () => {
    const full = run(fixtureRepo(), "digest");
    const budgeted = run(fixtureRepo(), "digest", "--max-tokens", "12");

    expect(full.status).toBe(0);
    expect(full.stdout).toContain("apps/cli");
    expect(budgeted.stdout).toContain("token budget");
    expect(budgeted.stdout.length).toBeLessThan(full.stdout.length);
  });

  it("emits parseable JSON on stdout with --json, uncontaminated by diagnostics", () => {
    const result = run(fixtureRepo(), "digest", "--json");

    expect(result.status).toBe(0);
    expect(() => JSON.parse(result.stdout) as unknown).not.toThrow();
  });

  it("explain resolves provenance and suggests near misses for a typo", () => {
    const found = run(fixtureRepo(), "explain", "surface:cli:fixture");
    const missed = run(fixtureRepo(), "explain", "surface:cli:fixtur");

    expect(found.status).toBe(0);
    expect(found.stdout).toContain("WHY IT EXISTS");
    expect(missed.status).toBe(1);
    expect(missed.stderr).toContain("Did you mean: surface:cli:fixture");
  });

  it("explain without an id fails with an example rather than a stack trace", () => {
    const result = run(fixtureRepo(), "explain");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("explain requires an item id");
  });

  it("doctor reports which adapters ran and which stayed silent", () => {
    const result = run(fixtureRepo(), "doctor");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ADAPTERS RUN");
    expect(result.stdout).toContain("ADAPTERS SILENT");
  });

  it("bundle assembles the design prompt with the repo substituted in", () => {
    const result = run(fixtureRepo(), "bundle");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Launch bundle — repo reality");
    expect(result.stdout).not.toContain("<REPO>");
  });

  it("writes nothing: every LOOK command leaves the repo untouched", () => {
    const root = fixtureRepo();
    for (const command of ["show", "digest", "doctor"]) run(root, command);

    expect(existsSync(join(root, "docs"))).toBe(false);
  });
});

describe("digest as a committed artifact", () => {
  it("is written by all and re-checked by check-fresh", () => {
    const root = fixtureRepo();

    expect(run(root, "all").status).toBe(0);
    expect(existsSync(productMap(root, "generated/digest.generated.md"))).toBe(true);
    expect(run(root, "check-fresh").status).toBe(0);
  });

  it("ignores --max-tokens, so a flag cannot make check-fresh report drift", () => {
    const root = fixtureRepo();
    run(root, "all");
    const committed = readFileSync(productMap(root, "generated/digest.generated.md"), "utf8");

    expect(run(root, "all", "--max-tokens", "5").status).toBe(0);
    expect(readFileSync(productMap(root, "generated/digest.generated.md"), "utf8")).toBe(committed);
  });
});

describe("outputs config", () => {
  it("keeps the JSON manifests but drops the Markdown when outputs.markdown is false", () => {
    const root = fixtureRepo();
    write(join(root, "product-map.config.mjs"), "export default { outputs: { markdown: false } };\n");
    const result = run(root, "all");

    expect(result.status).toBe(0);
    expect(existsSync(productMap(root, "surfaces.existing.json"))).toBe(true);
    expect(existsSync(productMap(root, "generated/README.generated.md"))).toBe(false);
    expect(existsSync(productMap(root, "generated/surfaces.existing.generated.md"))).toBe(false);
    expect(existsSync(productMap(root, "generated/digest.generated.md"))).toBe(true);
  });

  it("removes a Markdown rendering that was committed before the toggle was flipped", () => {
    const root = fixtureRepo();
    run(root, "all");
    expect(existsSync(productMap(root, "generated/README.generated.md"))).toBe(true);

    write(join(root, "product-map.config.mjs"), "export default { outputs: { markdown: false, digest: false } };\n");
    run(root, "all");

    expect(existsSync(productMap(root, "generated/README.generated.md"))).toBe(false);
    expect(existsSync(productMap(root, "generated/digest.generated.md"))).toBe(false);
  });
});

describe("--no-repo-code", () => {
  it("rejects --config rather than importing a file the flag promised not to execute", () => {
    const root = fixtureRepo();
    write(join(root, "elsewhere.mjs"), "export default {};\n");
    const result = run(root, "show", "--no-repo-code", "--config", join(root, "elsewhere.mjs"));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--config cannot be combined with --no-repo-code");
  });

  it("ignores a repo-root config file entirely", () => {
    const root = fixtureRepo();
    write(join(root, "product-map.config.mjs"), 'export default { repoName: "renamed" };\n');

    expect(run(root, "show").stdout).toContain("renamed");
    expect(run(root, "show", "--no-repo-code").stdout).not.toContain("renamed");
  });
});
