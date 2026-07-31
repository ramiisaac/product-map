// Pins the action's `version` input default to the pmap CLI version so the
// freshness gate consumers run is the release this revision shipped with,
// never a floating `latest` that an unscheduled release could change under
// them. The release workflow runs this right after `changeset version`; the
// pin rides the same reviewed version PR. While the version is still the
// pre-release 0.0.0 placeholder there is nothing published to pin to, so the
// script leaves the file alone.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const actionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(actionRoot, "..", "..");

const cli = JSON.parse(readFileSync(join(repoRoot, "packages", "pmap", "package.json"), "utf8"));
if (cli.version === "0.0.0") process.exit(0);

const actionPath = join(actionRoot, "action.yml");
const action = readFileSync(actionPath, "utf8");
const defaultLine = /^(  version:\n(?:    (?!default:).*\n)*    default: ).*$/m;
if (!defaultLine.test(action)) {
  throw new Error(`${actionPath}: could not find the version input's default line`);
}
const synced = action.replace(defaultLine, `$1"${cli.version}"`);
if (synced !== action) {
  writeFileSync(actionPath, synced);
}
