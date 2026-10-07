import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { cliCommandsAdapter } from "../adapters/cli-commands";
import { commandStems } from "../adapters/shared";

function write(root: string, path: string, content: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function cliRepo(commands: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-d5-"));
  write(root, "package.json", `${JSON.stringify({ name: "tool", bin: { tool: "./bin/run.js" } })}\n`);
  for (const [file, content] of Object.entries(commands)) write(root, `src/commands/${file}`, content);
  return root;
}

const commands = (root: string) =>
  cliCommandsAdapter
    .extract(loadRepoContext(root))
    .capabilities.map((item) => ({ id: item.id, purpose: item.purpose, evidence: item.provenance.evidence }));

const purposes = (root: string): Record<string, string | undefined> =>
  Object.fromEntries(commands(root).map((command) => [command.id, command.purpose]));

describe("cli-commands reads descriptions from static declarations", () => {
  it("reads a commander chain's backtick description", () => {
    const root = cliRepo({
      "deploy.ts": [
        "export const createDeployCommand = (program: Command) =>",
        "  program",
        '    .command("deploy [dir]")',
        "    .description(`Deploy the site",
        "      to production`)",
        '    .option("--prod", "Deploy to production")',
        "    .action(deploy);",
        "",
      ].join("\n"),
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.deploy": "Deploy the site to production" });
  });

  it("reads new Command().name().description()", () => {
    const root = cliRepo({
      "add.ts": [
        "export const add = new Command()",
        '  .name("add")',
        '  .description("Add a component to your project")',
        '  .argument("[components...]", "the components to add")',
        "  .action(async () => {});",
        "",
      ].join("\n"),
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.add": "Add a component to your project" });
  });

  it("reads a yargs command's positional description", () => {
    const root = cliRepo({
      "serve.ts": [
        "export const serve = (cli: Argv) =>",
        '  cli.command("serve [port]", "Start the dev server", (y) => y.positional("port", { describe: "port to bind" }), run);',
        "",
      ].join("\n"),
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.serve": "Start the dev server" });
  });

  it("reads citty's defineCommand meta", () => {
    const root = cliRepo({
      "build.ts": [
        "export default defineCommand({",
        '  meta: { name: "build", description: "Build the project" },',
        '  args: { watch: { type: "boolean", description: "Rebuild on change" } },',
        "  run() {},",
        "});",
        "",
      ].join("\n"),
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.build": "Build the project" });
  });

  it("keeps each declaration's description to itself", () => {
    const root = cliRepo({
      "logs.ts": [
        'program.command("tail").description("Stream new log lines");',
        'program.command("logs").action(showLogs);',
        "",
      ].join("\n"),
      "sites.ts": [
        'program.command("sites:create").description("Create a site");',
        'program.command("sites").description("Manage sites");',
        "",
      ].join("\n"),
      "env.ts": [
        "program",
        '  .command("env")',
        '  .description("Manage environment variables")',
        '  .command("env:set")',
        '  .description("Set a variable");',
        "",
      ].join("\n"),
    });

    expect(purposes(root)).toEqual({
      "cap:command:tool.env": "Manage environment variables",
      "cap:command:tool.logs": undefined,
      "cap:command:tool.sites": "Manage sites",
    });
  });

  it("keeps the module stem as the id when the declared name differs", () => {
    const root = cliRepo({
      "dev-exec/index.ts": 'program.command("dev:exec").description("Run a command with the project environment");\n',
      "dev-exec/dev-exec.ts": "export const devExec = async () => {};\n",
    });

    expect(commands(root)).toEqual([
      {
        id: "cap:command:tool.dev-exec",
        purpose: "Run a command with the project environment",
        evidence: ["src/commands/dev-exec/dev-exec.ts", "src/commands/dev-exec/index.ts"],
      },
    ]);
  });
});

describe("cli-commands recognizes command directories by their declarations", () => {
  it("counts a directory whose only declaration module is a spec, and drops an i18n-key summary", () => {
    const root = cliRepo({
      "publish/spec.ts": 'export const spec = { name: "publish", summary: "commands.publish.summary", run };\n',
      "publish/run.ts": "export const run = async () => {};\n",
      "release/spec.ts": 'export const spec = { name: "release", description: "Cut a release" };\n',
    });

    expect(commands(root)).toEqual([
      { id: "cap:command:tool.publish", purpose: undefined, evidence: ["src/commands/publish/spec.ts"] },
      { id: "cap:command:tool.release", purpose: "Cut a release", evidence: ["src/commands/release/spec.ts"] },
    ]);
  });

  it("does not count a directory whose modules declare some other command", () => {
    const root = cliRepo({
      "formatting/spec.ts": 'export const spec = { name: "format", description: "Not this directory" };\n',
      "status.ts": "export {};\n",
    });

    expect(commands(root).map((command) => command.id)).toEqual(["cap:command:tool.status"]);
  });
});

describe("cli-commands tells helpers from commands", () => {
  it("excludes an undeclared module a sibling command imports", () => {
    const root = cliRepo({
      "deploy.ts":
        'import { formatOutput } from "./format-output.js";\nprogram.command("deploy").action(formatOutput);\n',
      "format-output.ts": "export const formatOutput = (value: unknown) => JSON.stringify(value);\n",
    });

    expect(commands(root).map((command) => command.id)).toEqual(["cap:command:tool.deploy"]);
  });

  it("keeps an undeclared module nobody imports, through the stem fallback", () => {
    const root = cliRepo({
      "legacy.ts": "export default wrapCommand(async () => {});\n",
      "deploy.ts": 'program.command("deploy").description("Deploy");\n',
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.deploy": "Deploy", "cap:command:tool.legacy": undefined });
  });

  it("keeps an undeclared module that only a top-level registry imports", () => {
    const root = cliRepo({
      "index.ts": 'import status from "./status.js";\nexport const commands = [status];\n',
      "status.ts": "export default wrapCommand(async () => {});\n",
    });

    expect(commands(root).map((command) => command.id)).toEqual(["cap:command:tool.status"]);
  });

  it("keeps a declared module even when a sibling imports it", () => {
    const root = cliRepo({
      "sites.ts": 'import { createSite } from "./create.js";\nprogram.command("sites").action(createSite);\n',
      "create.ts": 'export const createSite = () => program.command("create").description("Create a site");\n',
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.create": "Create a site", "cap:command:tool.sites": undefined });
  });
});

describe("cli-commands without declarations", () => {
  it("keeps today's stems and evidence, including an index-only directory's empty evidence, and adds no purpose", () => {
    const root = cliRepo({
      "scan.ts": "export {};\n",
      "status/index.ts": "export {};\n",
      "link/link.ts": "export {};\n",
      "link/options.ts": "export {};\n",
      "base-command.ts": "export {};\n",
    });
    const files = loadRepoContext(root).listFiles("src/commands", 2);

    expect(commands(root)).toEqual([
      { id: "cap:command:tool.link", purpose: undefined, evidence: ["src/commands/link/link.ts"] },
      { id: "cap:command:tool.scan", purpose: undefined, evidence: ["src/commands/scan.ts"] },
      { id: "cap:command:tool.status", purpose: undefined, evidence: [] },
    ]);
    expect(commands(root).map((command) => command.id.replace("cap:command:tool.", ""))).toEqual(
      commandStems(files, "src/commands"),
    );
  });
});

describe("cli-commands reads declarations from a real parse", () => {
  it("does not take the literal prefix of a concatenated name or description", () => {
    const root = cliRepo({
      "deploy.ts": 'program.command("deploy").description("Deploy to " + target);\n',
      "sites.ts": 'program.command("sites" + suffix).description("Manage sites");\n',
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.deploy": undefined, "cap:command:tool.sites": undefined });
  });

  it("does not read a declaration out of JSX text", () => {
    const root = cliRepo({
      "help.tsx": 'export const Help = () => <p>Run program.command("help").description("Fake purpose") first</p>;\n',
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.help": undefined });
  });

  it("finds a declaration after division of a postfix increment on the same line", () => {
    const root = cliRepo({
      "count.ts": 'let n = 0; n++ / 2; program.command("count").description("Count things"); const q = 1 / 2;\n',
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.count": "Count things" });
  });

  it("keeps a declaration after a brace inside a comment within a template interpolation", () => {
    const root = cliRepo({
      "greet.ts": 'const label = `${/* { */ name}`;\nprogram.command("greet").description("Say hello");\n',
    });

    expect(purposes(root)).toEqual({ "cap:command:tool.greet": "Say hello" });
  });

  it("treats a module that does not parse as undeclared, keeping the stem fallback", () => {
    const root = cliRepo({
      "broken.ts": 'program.command("broken").description("unterminated);\n',
    });

    expect(commands(root)).toEqual([
      { id: "cap:command:tool.broken", purpose: undefined, evidence: ["src/commands/broken.ts"] },
    ]);
  });
});
