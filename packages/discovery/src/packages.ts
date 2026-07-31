import type { FileSystem } from "@product-map/runtime";

import type { PackageInfo, PackageManifest } from "./types";
import { walkFiles } from "./walk";

export const PACKAGE_MANIFEST_FILE = "package.json";
export const WORKSPACE_MANIFEST_FILE = "pnpm-workspace.yaml";
export const DEFAULT_PACKAGE_SEARCH_DEPTH = 5;

const GENERATED_DIR_SEGMENT = "generated";
const WORKSPACE_NEGATION_PATTERN = /^\s*-\s*["']?!([^"'\n*]+)/gm;

const DEPENDENCY_FIELDS: readonly string[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

export function depOf(manifest: PackageManifest, name: string): boolean {
  for (const field of DEPENDENCY_FIELDS) {
    const deps = manifest[field];
    if (deps !== null && typeof deps === "object" && name in (deps as Record<string, unknown>)) {
      return true;
    }
  }
  return false;
}

function parseManifest(fs: FileSystem, path: string): PackageManifest | null {
  const raw = fs.readFile(path);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as PackageManifest;
  } catch {
    return null;
  }
}

function readWorkspaceNegations(fs: FileSystem, root: string): string[] {
  const raw = fs.readFile(`${root}/${WORKSPACE_MANIFEST_FILE}`);
  if (raw === null) return [];
  const negations: string[] = [];
  for (const match of raw.matchAll(WORKSPACE_NEGATION_PATTERN)) {
    const negated = match[1];
    if (negated !== undefined) negations.push(negated.replace(/\/+$/, ""));
  }
  return negations;
}

export interface CollectPackagesOptions {
  fs: FileSystem;
  root: string;
  searchDepth?: number;
  extraSkippedDirs?: readonly string[];
}

export function collectPackages(options: CollectPackagesOptions): PackageInfo[] {
  const { fs, root, searchDepth = DEFAULT_PACKAGE_SEARCH_DEPTH, extraSkippedDirs } = options;

  const rootManifest = parseManifest(fs, `${root}/${PACKAGE_MANIFEST_FILE}`) ?? {};
  const packages: PackageInfo[] = [{ dir: "", manifest: rootManifest }];
  const negations = readWorkspaceNegations(fs, root);
  const suffix = `/${PACKAGE_MANIFEST_FILE}`;

  const candidates = walkFiles({ fs, root, startDir: "", maxDepth: searchDepth, extraSkippedDirs });
  for (const file of candidates) {
    if (!file.endsWith(suffix)) continue;
    const dir = file.slice(0, -suffix.length);
    if (dir.split("/").includes(GENERATED_DIR_SEGMENT)) continue;
    if (negations.some((negated) => dir === negated || dir.startsWith(`${negated}/`))) continue;

    const manifest = parseManifest(fs, `${root}/${file}`);
    if (manifest !== null) packages.push({ dir, manifest });
  }

  packages.sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
  return packages;
}
