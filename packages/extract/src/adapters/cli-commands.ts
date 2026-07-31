import { basename } from "node:path";
import type { Bind } from "@product-map/spec";
import type { Adapter } from "../types";
import type { PackageInfo } from "@product-map/discovery";

import { CODE_FILE, commandStems, hasVscodeEngine, out, pkgName, prov } from "./shared";
import { slugify } from "@product-map/spec";

function commandOwner(pkg: PackageInfo): string {
  const bin = pkg.manifest["bin"];
  if (bin !== undefined && typeof bin === "object") {
    const first = Object.keys(bin as Record<string, string>).sort()[0];
    if (first !== undefined) return slugify(first);
  }
  return slugify(pkgName(pkg));
}

/** Repo-relative path inside a package, with the root package's empty dir handled. */
function inPkg(pkg: PackageInfo, rel: string): string {
  return pkg.dir === "" ? rel : `${pkg.dir}/${rel}`;
}

/**
 * cli-commands: files under a CLI package's src/commands are its command
 * capabilities. Command ids are namespaced by their owning bin/package
 * (`cap:command:<owner>.<stem>`) so same-named commands in different CLIs
 * (e.g. two `init`s) never collide. VS Code extension packages are handled
 * by the vscode adapter instead.
 */
export const cliCommandsAdapter: Adapter = {
  name: "cli-commands",
  // single-package CLI repos keep src/commands at the repo root, which is the
  // common shape for a published CLI; excluding the root package here meant
  // every one of them extracted zero commands
  detect: (ctx) => ctx.packages.some((p) => ctx.exists(inPkg(p, "src/commands"))),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      const commandsDir = inPkg(pkg, "src/commands");
      if (!ctx.exists(commandsDir) || hasVscodeEngine(pkg)) continue;
      const files = ctx.listFiles(commandsDir, 2);
      const stems = commandStems(files, commandsDir);
      if (stems.length === 0) continue;
      result.sources.push(commandsDir);
      const owner = commandOwner(pkg);
      // a command is only as distributable as the package that ships it, so
      // publication of that package is the observation reach follows
      const reach = pkg.manifest["private"] === true ? "internal" : "external";
      const placement = { current: pkg.dir === "" ? "." : pkg.dir, verdict: "correct" } as const;
      const binds: Bind[] = [];
      for (const stem of stems) {
        const id = `cap:command:${owner}.${stem}`;
        result.capabilities.push({
          id,
          kind: "command",
          name: `${owner} ${stem}`,
          surfaceArea: "cli",
          status: "live",
          reach,
          placement,
          provenance: prov(
            commandsDir,
            files.filter((f) => slugify(basename(f).replace(CODE_FILE, "")) === stem).slice(0, 2),
            "medium",
          ),
        });
        binds.push({ capabilityId: id, via: "inferred-high", note: `command module in ${commandsDir}` });
      }
      // attach the commands to CLI surfaces that live in the same package
      const bin = pkg.manifest["bin"];
      if (bin !== undefined) {
        // commands belong to the package's PRIMARY bin only — auxiliary bins
        // (e.g. a bundled lsp launcher) must not inherit the command set
        const names = (
          typeof bin === "string" ? [slugify(pkgName(pkg))] : Object.keys(bin as Record<string, string>).sort()
        ).slice(0, 1);
        for (const name of names) {
          result.surfaces.push({
            id: `surface:cli:${slugify(name)}`,
            surfaceType: "cli",
            name: `${name} CLI`,
            entry: { kind: "bin", value: name },
            purpose: `Command-line entrypoint \`${name}\` from ${pkgName(pkg)}.`,
            audience: ["developer"],
            status: pkg.manifest["private"] === true ? "partial" : "live",
            binds,
            placement,
            provenance: prov(inPkg(pkg, "package.json"), [inPkg(pkg, "package.json"), commandsDir], "high"),
          });
        }
      }
    }
    return result;
  },
};
