#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  CliError,
  isCommandName,
  isOutputFormat,
  OUTPUT_FORMATS,
  renderCommandList,
  resolveOptions,
  runCommand,
  Writer,
} from "@product-map/engine";
import type { PlannedWrite } from "@product-map/engine";
import { createLogger } from "@product-map/runtime";

import { GENERATOR } from "./generator";

const packageRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
const specRoot = dirname(fileURLToPath(import.meta.resolve("@product-map/spec/package.json")));
const ASSETS = { promptsDir: join(packageRoot, "prompts"), schemasDir: join(specRoot, "schemas") };

const USAGE = `pmap — product-map.v1 toolchain

Usage: pmap <command> [--repo <path>] [--dry-run|-n] [--no-repo-code]

Commands:
${renderCommandList()}

Flags:
  --repo <path>          Target repo root (default: cwd)
  --out <path>           Output directory for fleet (default: cwd)
  --dry-run, -n          Report every file that WOULD be written; write nothing
  --no-repo-code         Do not import product-map.config.mjs or extract.local.mjs
  --allow-partial-local  Write partial output if the repo-local extractor fails
  --config <path>        Read product-map.config.mjs from an explicit path (not with --no-repo-code)
  --quiet, -q            Suppress progress diagnostics; leave errors and output
  --format <f>           Output format for the LOOK commands: text|json
  --json                 Shorthand for --format=json
  --max-tokens <n>       Budget for digest on stdout (the committed digest uses config)
  --scan                 fleet only: extract each repo live instead of reading committed maps
  --version, -v          Print the pmap version
  --help                 Show this help
`;

function fail(message: string): never {
  process.stderr.write(`pmap: ${message}\n`);
  process.exit(1);
}

function markerFor(write: PlannedWrite, dryRun: boolean): string {
  if (write.action === "unchanged") return "=";
  if (write.action === "delete") return "-";
  return dryRun ? "~" : "+";
}

function reportWrites(writer: Writer): void {
  for (const write of writer.writes) {
    process.stdout.write(`  ${markerFor(write, writer.dryRun)} ${write.action.padEnd(9)} ${write.path}\n`);
  }
  process.stdout.write(`${writer.summary()}\n`);
}

function parseCliArgs() {
  try {
    return parseArgs({
      options: {
        repo: { type: "string" },
        out: { type: "string" },
        "dry-run": { type: "boolean", short: "n", default: false },
        "no-repo-code": { type: "boolean", default: false },
        "allow-partial-local": { type: "boolean", default: false },
        config: { type: "string" },
        quiet: { type: "boolean", short: "q", default: false },
        format: { type: "string" },
        json: { type: "boolean", default: false },
        "max-tokens": { type: "string" },
        scan: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
      allowPositionals: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const headline = /^(.*?\.)\s/.exec(message)?.[1] ?? message;
    fail(`${headline}\n\n${USAGE}`);
  }
}

const { values, positionals } = parseCliArgs();

if (values.version === true) {
  process.stdout.write(`${GENERATOR.version}\n`);
  process.exit(0);
}

const command = positionals[0];
if (values.help === true || command === undefined) {
  process.stdout.write(USAGE);
  process.exit(command === undefined && values.help !== true ? 1 : 0);
}
if (!isCommandName(command)) fail(`unknown command "${command}"\n\n${USAGE}`);

const repoRoot = resolve(values.repo ?? process.cwd());
if (!existsSync(repoRoot)) fail(`repo root does not exist: ${repoRoot}`);
const writer = new Writer({ dryRun: values["dry-run"] === true });
// Diagnostics go to stderr so command output stays pipeable. The writer
// report below is output, not diagnostics: `pnpm generate` parses it.
const logger = createLogger({ level: values.quiet === true ? "error" : "info" });
const output = (text: string): void => {
  process.stdout.write(`${text}\n`);
};
const allowRepoCode = values["no-repo-code"] !== true;
// SECURITY.md promises --no-repo-code executes nothing, without qualification.
// Honouring --config alongside it would import a module anyway, so the
// combination is rejected rather than documented as an exception.
if (!allowRepoCode && values.config !== undefined) {
  fail("--config cannot be combined with --no-repo-code: loading a config file executes it");
}

const requestedFormat = values.json === true ? "json" : (values.format ?? "text");
if (!isOutputFormat(requestedFormat)) {
  fail(`unknown --format "${requestedFormat}"; expected one of ${OUTPUT_FORMATS.join(", ")}`);
}

const rawMaxTokens = values["max-tokens"];
const maxTokens = rawMaxTokens === undefined ? undefined : Number(rawMaxTokens);
if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens <= 0)) {
  fail(`--max-tokens must be a positive integer (got "${rawMaxTokens ?? ""}")`);
}

let options;
try {
  options = await resolveOptions({ repoRoot, allowRepoCode, configPath: values.config });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

try {
  await runCommand(command, {
    repoRoot,
    writer,
    generator: GENERATOR,
    options,
    logger,
    output,
    format: requestedFormat,
    maxTokens,
    scan: values.scan === true,
    assets: ASSETS,
    allowRepoCode,
    allowPartialLocal: values["allow-partial-local"] === true,
    args: positionals.slice(1),
    out: values.out,
  });
} catch (error) {
  if (error instanceof CliError) fail(error.message);
  throw error;
}

writer.commit();
if (writer.writes.length > 0) reportWrites(writer);
