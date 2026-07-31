import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

export type WriteAction = "create" | "update" | "delete" | "unchanged";

export interface PlannedWrite {
  path: string;
  action: WriteAction;
  operation: "write" | "delete";
  content?: string;
}

/**
 * All file output flows through a Writer, and it is transactional: `write` and
 * `remove` only stage changes in memory, and nothing touches disk until
 * `commit` flushes the staged set. That is what makes a multi-step command
 * like `pmap all` all-or-nothing — if any stage throws or a later input fails
 * validation, the process exits before `commit` runs and the on-disk artifact
 * graph is left exactly as it was, rather than half-rewritten.
 *
 * Reads see the staged overlay, so a stage can read back what an earlier stage
 * produced in the same run. In dry-run mode `commit` is a no-op; the staged
 * writes are only reported.
 */
export class Writer {
  readonly dryRun: boolean;
  readonly writes: PlannedWrite[] = [];
  readonly #overlay = new Map<string, PlannedWrite>();
  #committed = false;

  constructor(options: { dryRun: boolean }) {
    this.dryRun = options.dryRun;
  }

  write(path: string, content: string): PlannedWrite {
    const previous = this.read(path);
    const action: WriteAction = previous === null ? "create" : previous === content ? "unchanged" : "update";
    const planned: PlannedWrite = { path, action, operation: "write", content };
    this.writes.push(planned);
    this.#overlay.set(path, planned);
    return planned;
  }

  remove(path: string): PlannedWrite {
    const action: WriteAction = this.exists(path) ? "delete" : "unchanged";
    const planned: PlannedWrite = { path, action, operation: "delete" };
    this.writes.push(planned);
    this.#overlay.set(path, planned);
    return planned;
  }

  read(path: string): string | null {
    const planned = this.#overlay.get(path);
    if (planned?.operation === "delete") return null;
    if (planned?.operation === "write") return planned.content ?? "";
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf8");
  }

  exists(path: string): boolean {
    return this.read(path) !== null;
  }

  /**
   * Flush the staged overlay to disk. Applies the final state per path (writes
   * via atomic temp-file-plus-rename, deletes via unlink), so calling it once
   * after a command fully succeeds is the commit point of the transaction. A
   * no-op in dry-run mode and idempotent thereafter.
   */
  commit(): void {
    if (this.dryRun || this.#committed) return;
    this.#committed = true;
    for (const planned of this.#overlay.values()) {
      if (planned.operation === "delete") {
        if (planned.action === "delete") unlinkSync(planned.path);
        continue;
      }
      if (planned.action === "unchanged") continue;
      mkdirSync(dirname(planned.path), { recursive: true });
      const temporary = join(dirname(planned.path), `.${basename(planned.path)}.${randomUUID()}.tmp`);
      try {
        writeFileSync(temporary, planned.content ?? "", { encoding: "utf8", flag: "wx" });
        renameSync(temporary, planned.path);
      } finally {
        rmSync(temporary, { force: true });
      }
    }
  }

  summary(): string {
    const counts = { create: 0, update: 0, delete: 0, unchanged: 0 };
    for (const w of this.writes) counts[w.action] += 1;
    const mode = this.dryRun ? "DRY RUN — nothing written" : "written";
    return `${mode}: ${counts.create} new, ${counts.update} changed, ${counts.delete} deleted, ${counts.unchanged} unchanged`;
  }
}
