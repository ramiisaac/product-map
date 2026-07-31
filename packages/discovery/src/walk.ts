import type { FileSystem } from "@product-map/runtime";

export const ALWAYS_SKIPPED_DIRS: readonly string[] = [
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".vscode-test",
];

export const PACKAGE_OUTPUT_DIRS: readonly string[] = ["dist", "build", "out", "target"];

export const ROOT_ONLY_SKIPPED_DIRS: readonly string[] = ["coverage", "test-results"];

export interface WalkOptions {
  fs: FileSystem;
  root: string;
  startDir: string;
  maxDepth: number;
  extraSkippedDirs?: readonly string[];
}

function joinRepoPath(dir: string, entry: string): string {
  return dir === "" ? entry : `${dir}/${entry}`;
}

export function walkFiles(options: WalkOptions): string[] {
  const { fs, root, startDir, maxDepth, extraSkippedDirs = [] } = options;
  const alwaysSkipped = new Set([...ALWAYS_SKIPPED_DIRS, ...extraSkippedDirs]);
  const packageOutput = new Set(PACKAGE_OUTPUT_DIRS);
  const rootOnlySkipped = new Set(ROOT_ONLY_SKIPPED_DIRS);
  const files: string[] = [];

  const visit = (dir: string, depth: number): void => {
    if (depth < 0) return;
    const absoluteDir = dir === "" ? root : `${root}/${dir}`;
    const entries = fs.readDir(absoluteDir);
    if (entries.length === 0) return;
    const insidePackageRoot = fs.exists(`${absoluteDir}/package.json`);

    for (const entry of entries) {
      if (alwaysSkipped.has(entry.name) || entry.name.startsWith(".")) continue;
      if (insidePackageRoot && packageOutput.has(entry.name)) continue;
      if (dir === "" && rootOnlySkipped.has(entry.name)) continue;
      if (entry.isSymbolicLink) continue;

      const relPath = joinRepoPath(dir, entry.name);
      if (entry.isDirectory) {
        visit(relPath, depth - 1);
      } else {
        files.push(relPath);
      }
    }
  };

  visit(startDir, maxDepth);
  return files;
}
