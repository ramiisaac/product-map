import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version?: unknown;
};

if (typeof manifest.version !== "string" || manifest.version.length === 0) {
  throw new Error("product-map package version is missing");
}

export const GENERATOR = Object.freeze({ name: "pmap", version: manifest.version });
