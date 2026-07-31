// Locks the plugin version to the pmap CLI version so the skills always
// declare which CLI behavior they document. The release workflow runs this
// right after `changeset version`; the bump rides the same release commit.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

const cli = JSON.parse(readFileSync(join(repoRoot, "packages", "pmap", "package.json"), "utf8"));
const manifestPath = join(pluginRoot, ".claude-plugin", "plugin.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.version !== cli.version) {
  manifest.version = cli.version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
