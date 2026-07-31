import { basename } from "node:path";

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
export const NOISE_STEM =
  /^(index|main|base|base-command|types|helpers?|utils?|constants|shared|internal|command-registry|register-commands|exit-codes|output-sinks|argv-parser|registry|context|options|flags|run)$/;

/**
 * A command is a top-level file in the commands dir (commands/scan.ts) or a
 * command directory with an entry module — either commands/fix/index.ts or the
 * eponymous commands/fix/fix.ts, both common conventions. Other files NESTED
 * inside a command directory are that command's helpers, never commands
 * themselves; treating them as commands minted dozens of phantoms.
 */
export function commandStems(files: string[], dir: string): string[] {
  const stems = new Set<string>();
  for (const file of files) {
    if (!file.startsWith(`${dir}/`) || !CODE_FILE.test(file)) continue;
    if (file.includes("__tests__") || file.includes("/_") || DECLARATION_FILE.test(file)) continue;
    const rel = file.slice(dir.length + 1);
    const parts = rel.split("/");
    let stem: string;
    if (parts.length === 1) {
      stem = basename(rel).replace(CODE_FILE, "");
    } else if (parts.length === 2) {
      const leaf = parts[1]!.replace(CODE_FILE, "");
      if (leaf !== "index" && leaf !== parts[0]) continue;
      stem = parts[0]!;
    } else {
      continue;
    }
    if (stem.endsWith(".test") || stem.endsWith(".spec") || NOISE_STEM.test(stem)) continue;
    stems.add(slugify(stem));
  }
  return [...stems].sort();
}

export function hasVscodeEngine(pkg: PackageInfo): boolean {
  const engines = pkg.manifest["engines"];
  return engines !== null && typeof engines === "object" && "vscode" in (engines as Record<string, unknown>);
}
