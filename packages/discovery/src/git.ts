import { runProcess } from "@product-map/runtime";

import type { WorkingTreeState } from "./types";

const PORCELAIN_STATUS_PREFIX_LENGTH = 3;

function git(root: string, args: readonly string[]): string | null {
  const result = runProcess("git", ["-C", root, ...args]);
  return result.ok ? result.stdout : null;
}

export function readCommit(root: string): string | null {
  return git(root, ["rev-parse", "HEAD"])?.trim() ?? null;
}

export interface WorkingTreeOptions {
  root: string;
  commit: string | null;
  ignoredPathPrefix: string;
}

export function readWorkingTree({ root, commit, ignoredPathPrefix }: WorkingTreeOptions): WorkingTreeState {
  if (commit === null) return "not-applicable";
  const status = git(root, ["status", "--porcelain"]) ?? "";

  const meaningful = status.split("\n").filter((line) => {
    if (line.trim() === "") return false;
    const path = line.slice(PORCELAIN_STATUS_PREFIX_LENGTH).trim();
    return !(path.startsWith(ignoredPathPrefix) || ignoredPathPrefix.startsWith(path));
  });

  return meaningful.length === 0 ? "clean" : "dirty";
}
