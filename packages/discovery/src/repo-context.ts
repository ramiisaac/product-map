import { basename } from "node:path";

import type { Cache, FileSystem } from "@product-map/runtime";
import { createCache, createNodeFileSystem } from "@product-map/runtime";

import type { RepoContextOptions } from "@product-map/spec";

import { collectPackages, DEFAULT_PACKAGE_SEARCH_DEPTH } from "./packages";
import type { RepoContext } from "./types";
import { readCommit, readWorkingTree } from "./git";
import { walkFiles } from "./walk";

export const DEFAULT_LIST_DEPTH = 6;
export const PRODUCT_MAP_DIR = "docs/reference/product-map/";

const LIST_FILES_CACHE_NAMESPACE = "discovery.listFiles";

export interface LoadRepoContextOptions extends RepoContextOptions {
  fs?: FileSystem;
  cache?: Cache;
}

export function loadRepoContext(root: string, options: LoadRepoContextOptions = {}): RepoContext {
  const fs = options.fs ?? createNodeFileSystem();
  const cache = options.cache ?? createCache();
  const listDepth = options.listDepth ?? DEFAULT_LIST_DEPTH;
  const extraSkippedDirs = options.extraSkippedDirs;

  const packages = collectPackages({
    fs,
    root,
    searchDepth: options.packageSearchDepth ?? DEFAULT_PACKAGE_SEARCH_DEPTH,
    extraSkippedDirs,
  });

  const commit = readCommit(root);
  const workingTree = readWorkingTree({
    root,
    commit,
    ignoredPathPrefix: options.ignoredStatusPrefix ?? PRODUCT_MAP_DIR,
  });

  return {
    root,
    repoName: basename(root),
    commit,
    workingTree,
    packages,

    read: (relPath) => fs.readFile(`${root}/${relPath}`),

    exists: (relPath) => fs.exists(`${root}/${relPath}`),

    listFiles(relDir, maxDepth = listDepth) {
      const startDir = relDir === "." ? "" : relDir;
      return cache.get(LIST_FILES_CACHE_NAMESPACE, `${startDir} ${maxDepth}`, () => {
        if (startDir !== "" && !fs.exists(`${root}/${startDir}`)) return [];
        return walkFiles({ fs, root, startDir, maxDepth, extraSkippedDirs });
      });
    },
  };
}
