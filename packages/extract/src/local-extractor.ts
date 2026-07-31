import type { CapabilityItem, SurfaceItem } from "@product-map/spec";
import { CapabilityItemSchema, SurfaceItemSchema } from "@product-map/spec";
import type { LocalExtractorOptions } from "@product-map/spec";

export type { LocalExtractorOptions };
import { NODE_EXECUTABLE, runProcess } from "@product-map/runtime";
import type { RepoContext } from "@product-map/discovery";

export const LOCAL_EXTRACTOR_FILE = "docs/reference/product-map/extract.local.mjs";

export const DEFAULT_LOCAL_EXTRACTOR_TIMEOUT_MS = 60_000;
export const DEFAULT_LOCAL_EXTRACTOR_MAX_BUFFER_BYTES = 32 * 1024 * 1024;

export interface LocalExtractorOutput {
  surfaces: SurfaceItem[];
  capabilities: CapabilityItem[];
  sources: string[];
}

function resolveInvocation(
  options: LocalExtractorOptions,
  extractorPath: string,
  repoRoot: string,
): { command: string; args: string[] } {
  if (options.command === undefined) {
    return { command: NODE_EXECUTABLE, args: [extractorPath, repoRoot] };
  }
  const args = options.args === undefined ? [extractorPath, repoRoot] : [...options.args, repoRoot];
  return { command: options.command, args };
}

export function runLocalExtractor(
  ctx: RepoContext,
  issues: string[],
  options: LocalExtractorOptions = {},
): LocalExtractorOutput | null {
  const extractorPath = `${ctx.root}/${LOCAL_EXTRACTOR_FILE}`;
  const usesDefaultScript = options.command === undefined || options.args === undefined;
  if (usesDefaultScript && !ctx.exists(LOCAL_EXTRACTOR_FILE)) return null;

  const { command, args } = resolveInvocation(options, extractorPath, ctx.root);
  const result = runProcess(command, args, {
    timeoutMs: options.timeoutMs ?? DEFAULT_LOCAL_EXTRACTOR_TIMEOUT_MS,
    maxBuffer: options.maxBufferBytes ?? DEFAULT_LOCAL_EXTRACTOR_MAX_BUFFER_BYTES,
  });

  if (!result.ok) {
    issues.push(`local extractor failed: ${result.error}`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    issues.push("local extractor printed invalid JSON");
    return null;
  }

  const record = (parsed ?? {}) as Record<string, unknown>;
  const output: LocalExtractorOutput = { surfaces: [], capabilities: [], sources: [] };

  const rawSurfaces = Array.isArray(record["surfaces"]) ? (record["surfaces"] as unknown[]) : [];
  for (const [index, value] of rawSurfaces.entries()) {
    const item = SurfaceItemSchema.safeParse(value);
    if (item.success) output.surfaces.push(item.data);
    else issues.push(`local surface[${index}] invalid: ${item.error.issues[0]?.message ?? "schema error"}`);
  }

  const rawCapabilities = Array.isArray(record["capabilities"]) ? (record["capabilities"] as unknown[]) : [];
  for (const [index, value] of rawCapabilities.entries()) {
    const item = CapabilityItemSchema.safeParse(value);
    if (item.success) output.capabilities.push(item.data);
    else issues.push(`local capability[${index}] invalid: ${item.error.issues[0]?.message ?? "schema error"}`);
  }

  if (Array.isArray(record["sources"])) {
    output.sources = (record["sources"] as unknown[]).filter((source): source is string => typeof source === "string");
  }
  output.sources.push(LOCAL_EXTRACTOR_FILE);

  return output;
}
