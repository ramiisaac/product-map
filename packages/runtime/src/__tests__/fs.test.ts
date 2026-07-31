import { describe, expect, it } from "vitest";

import { createMemoryFileSystem } from "../fs";

describe("memory filesystem", () => {
  const fs = () =>
    createMemoryFileSystem({
      "/repo/package.json": "{}",
      "/repo/src/b.ts": "b",
      "/repo/src/a.ts": "a",
      "/repo/src/nested/c.ts": "c",
    });

  it("reads a file and reports a missing one as null", () => {
    expect(fs().readFile("/repo/package.json")).toBe("{}");
    expect(fs().readFile("/repo/missing.ts")).toBeNull();
  });

  it("lists directory entries sorted, marking directories", () => {
    expect(fs().readDir("/repo/src")).toEqual([
      { name: "a.ts", isDirectory: false, isSymbolicLink: false },
      { name: "b.ts", isDirectory: false, isSymbolicLink: false },
      { name: "nested", isDirectory: true, isSymbolicLink: false },
    ]);
  });

  it("treats a path with children as an existing directory", () => {
    const memory = fs();

    expect(memory.exists("/repo/src")).toBe(true);
    expect(memory.isDirectory("/repo/src")).toBe(true);
    expect(memory.isDirectory("/repo/package.json")).toBe(false);
  });

  it("writes, renames, and removes", () => {
    const memory = fs();

    memory.writeFile("/repo/new.ts", "new");
    expect(memory.readFile("/repo/new.ts")).toBe("new");

    memory.rename("/repo/new.ts", "/repo/moved.ts");
    expect(memory.readFile("/repo/new.ts")).toBeNull();
    expect(memory.readFile("/repo/moved.ts")).toBe("new");

    memory.remove("/repo/moved.ts");
    expect(memory.exists("/repo/moved.ts")).toBe(false);
  });

  it("returns an empty listing for an unknown directory", () => {
    expect(fs().readDir("/nowhere")).toEqual([]);
  });
});
