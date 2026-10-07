import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { DigestOptions } from "@product-map/spec";
import {
  buildDigest,
  buildExplanation,
  buildShow,
  diagnose,
  renderCapabilities,
  renderDiagnosis,
  renderDigest,
  renderExplanation,
  renderShow,
  renderSurfaces,
} from "@product-map/emit";

import { CliError } from "./errors";
import type { Inventory } from "./inventory";
import type { AssetPaths } from "./layout";
import type { ResolvedOptions } from "./options";

export const OUTPUT_FORMATS = ["text", "json"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export function isOutputFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(value);
}

const JSON_INDENT = 2;
const NEAR_MISS_LIMIT = 5;

function emit(format: OutputFormat, data: unknown, text: () => string): string {
  return format === "json" ? JSON.stringify(data, null, JSON_INDENT) : text();
}

export function renderShowCommand(inventory: Inventory, options: ResolvedOptions, format: OutputFormat): string {
  const data = buildShow(inventory);
  return emit(format, data, () => renderShow(data, options.render));
}

export function renderDigestCommand(inventory: Inventory, digestOptions: DigestOptions, format: OutputFormat): string {
  const data = buildDigest(inventory);
  return emit(format, data, () => renderDigest(data, digestOptions));
}

export function renderDoctorCommand(inventory: Inventory, format: OutputFormat): string {
  const data = diagnose(inventory);
  return emit(format, data, () => renderDiagnosis(data));
}

export function renderExplainCommand(inventory: Inventory, id: string | undefined, format: OutputFormat): string {
  if (id === undefined || id === "")
    throw new CliError("explain requires an item id, e.g. `pmap explain surface:cli:pmap`");
  const data = buildExplanation({ ...inventory, id });
  if (data === null) {
    const known = [...inventory.surfaces.items, ...inventory.capabilities.items].map((item) => item.id);
    const near = known
      .filter((candidate) => candidate.includes(id) || id.includes(candidate))
      .slice(0, NEAR_MISS_LIMIT);
    throw new CliError(
      `no item with id "${id}" in this repo's extraction${near.length === 0 ? "" : `. Did you mean: ${near.join(", ")}?`}`,
    );
  }
  return emit(format, data, () => renderExplanation(data));
}

const DESIGN_PROMPT_FILE = "claude-design-new-project.prompt.md";
const REPO_TOKEN = /<REPO>/g;
// The vendored template is also pasted by hand, where this sentence is true;
// the bundle always substitutes the scope, so it is removed before substitution
// rather than rewritten into a false instruction naming the repo.
const SUBSTITUTION_INSTRUCTION = " Replace `<REPO>` before sending.";

/**
 * The outbound leg of the design loop. `ingest` already handles the return
 * trip; without this the send was hand-assembled prose in a plugin skill,
 * which meant the bundle a designer received depended on who assembled it.
 */
export function renderBundleCommand(inventory: Inventory, assets: AssetPaths, options: ResolvedOptions): string {
  const prompt = readFileSync(join(assets.promptsDir, DESIGN_PROMPT_FILE), "utf8");
  const scope = inventory.surfaces.scope;
  return [
    prompt.replace(SUBSTITUTION_INSTRUCTION, "").replace(REPO_TOKEN, () => scope),
    "",
    "---",
    "",
    "## Launch bundle — repo reality",
    "",
    renderSurfaces(inventory.surfaces, "surfaces.existing.json", options.render),
    "",
    renderCapabilities(inventory.capabilities, "capabilities.existing.json", options.render),
    "",
  ].join("\n");
}
