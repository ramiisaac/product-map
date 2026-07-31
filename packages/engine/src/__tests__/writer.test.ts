import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Writer } from "../writer";

describe("Writer overlay", () => {
  it("makes dry-run writes readable without touching disk", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-writer-overlay-"));
    const target = join(root, "generated", "file.json");
    const writer = new Writer({ dryRun: true });

    writer.write(target, "planned\n");

    expect(writer.read(target)).toBe("planned\n");
    expect(writer.exists(target)).toBe(true);
    expect(existsSync(target)).toBe(false);
  });

  it("makes dry-run deletions visible to the overlay without touching disk", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-writer-overlay-"));
    const target = join(root, "stale.json");
    writeFileSync(target, "stale\n");
    const writer = new Writer({ dryRun: true });

    const planned = writer.remove(target);

    expect(planned.action).toBe("delete");
    expect(writer.read(target)).toBeNull();
    expect(writer.exists(target)).toBe(false);
    expect(readFileSync(target, "utf8")).toBe("stale\n");
  });

  it("stages changes in memory and only touches disk on commit", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-writer-overlay-"));
    const target = join(root, "file.json");
    writeFileSync(target, "before\n");
    const writer = new Writer({ dryRun: false });

    writer.write(target, "after\n");
    // staged, not yet written: the transaction has not committed
    expect(readFileSync(target, "utf8")).toBe("before\n");

    writer.commit();
    expect(readFileSync(target, "utf8")).toBe("after\n");
    expect(readdirSync(root)).toEqual(["file.json"]);
  });

  it("deletes an explicit file only on commit, leaving siblings untouched", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-writer-overlay-"));
    const target = join(root, "stale.json");
    const sibling = join(root, "keep.json");
    writeFileSync(target, "stale\n");
    writeFileSync(sibling, "keep\n");
    const writer = new Writer({ dryRun: false });

    expect(writer.remove(target).action).toBe("delete");
    expect(existsSync(target)).toBe(true); // staged only

    writer.commit();
    expect(existsSync(target)).toBe(false);
    expect(readFileSync(sibling, "utf8")).toBe("keep\n");
  });

  it("never writes staged changes when the run fails before commit", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-writer-overlay-"));
    const target = join(root, "file.json");
    writeFileSync(target, "before\n");
    const writer = new Writer({ dryRun: false });

    writer.write(target, "after\n");
    // simulate a later stage throwing: commit is never reached
    expect(readFileSync(target, "utf8")).toBe("before\n");
  });

  it("commit is a no-op in dry-run mode", () => {
    const root = mkdtempSync(join(tmpdir(), "pmap-writer-overlay-"));
    const target = join(root, "file.json");
    const writer = new Writer({ dryRun: true });

    writer.write(target, "planned\n");
    writer.commit();

    expect(existsSync(target)).toBe(false);
  });
});
