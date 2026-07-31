import { execFileSync } from "node:child_process";

export interface RunProcessOptions {
  cwd?: string;
  timeoutMs?: number;
  maxBuffer?: number;
}

export type ProcessResult = { ok: true; stdout: string } | { ok: false; stdout: ""; error: string };

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;

export function runProcess(command: string, args: readonly string[], options: RunProcessOptions = {}): ProcessResult {
  try {
    const stdout = execFileSync(command, [...args], {
      cwd: options.cwd,
      encoding: "utf8",
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, stdout: "", error: error instanceof Error ? error.message : String(error) };
  }
}

export const NODE_EXECUTABLE = process.execPath;
