import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

/**
 * The filesystem port.
 *
 * Everything above this layer reaches the disk through it, which buys two
 * things that matter here: layers can be tested against an in-memory
 * implementation instead of temporary directories, and `readDir` sorts once,
 * centrally, so no caller can accidentally reintroduce filesystem-dependent
 * ordering into output that must be byte-stable across machines.
 */
export interface FileSystem {
  /** File contents, or null when the path is absent or unreadable. */
  readFile(path: string): string | null;
  exists(path: string): boolean;
  /** Directory entries sorted by name. Empty when the path is absent. */
  readDir(path: string): DirEntry[];
  isDirectory(path: string): boolean;
  writeFile(path: string, content: string): void;
  /** Create a directory and any missing parents. */
  mkdirp(path: string): void;
  rename(from: string, to: string): void;
  /** Delete a file. A missing path is not an error. */
  remove(path: string): void;
}

export function createNodeFileSystem(): FileSystem {
  return {
    readFile(path) {
      if (!existsSync(path)) return null;
      try {
        return readFileSync(path, "utf8");
      } catch {
        return null;
      }
    },

    exists: (path) => existsSync(path),

    readDir(path) {
      let names: string[];
      try {
        names = readdirSync(path).sort();
      } catch {
        return [];
      }
      const entries: DirEntry[] = [];
      for (const name of names) {
        try {
          const stats = lstatSync(`${path}/${name}`);
          entries.push({ name, isDirectory: stats.isDirectory(), isSymbolicLink: stats.isSymbolicLink() });
        } catch {
          // a path that vanished between readdir and lstat is simply not there
        }
      }
      return entries;
    },

    isDirectory(path) {
      try {
        return lstatSync(path).isDirectory();
      } catch {
        return false;
      }
    },

    writeFile: (path, content) => writeFileSync(path, content, { encoding: "utf8", flag: "w" }),

    mkdirp: (path) => {
      mkdirSync(path, { recursive: true });
    },

    rename: (from, to) => renameSync(from, to),

    remove: (path) => {
      try {
        unlinkSync(path);
      } catch {
        rmSync(path, { force: true });
      }
    },
  };
}

/**
 * In-memory filesystem for tests. Paths are keys, so directories exist only by
 * implication of the files beneath them.
 */
export function createMemoryFileSystem(initial: Record<string, string> = {}): FileSystem {
  const files = new Map<string, string>(Object.entries(initial));

  const childrenOf = (path: string): Set<string> => {
    const children = new Set<string>();
    const prefix = path.endsWith("/") ? path : `${path}/`;
    for (const key of files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf("/");
      children.add(slash === -1 ? rest : rest.slice(0, slash));
    }
    return children;
  };

  return {
    readFile: (path) => files.get(path) ?? null,

    exists: (path) => files.has(path) || childrenOf(path).size > 0,

    readDir(path) {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      return [...childrenOf(path)]
        .sort()
        .map((name) => ({ name, isDirectory: !files.has(`${prefix}${name}`), isSymbolicLink: false }));
    },

    isDirectory: (path) => !files.has(path) && childrenOf(path).size > 0,

    writeFile: (path, content) => {
      files.set(path, content);
    },

    mkdirp: () => {
      // directories are implied by the paths of the files they contain
    },

    rename: (from, to) => {
      const content = files.get(from);
      if (content === undefined) return;
      files.set(to, content);
      files.delete(from);
    },

    remove: (path) => {
      files.delete(path);
    },
  };
}
