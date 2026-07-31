import type { Bind } from "@product-map/spec";
import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { CODE_FILE, out, pkgName, prov } from "./shared";
import { slugify } from "@product-map/spec";

const LSP_METHODS = [
  "onHover",
  "onDefinition",
  "onReferences",
  "onCompletion",
  "onDocumentSymbol",
  "onWorkspaceSymbol",
  "onCodeAction",
  "onCodeLens",
  "onRenameRequest",
  "onDocumentFormatting",
  "onDocumentHighlight",
  "onExecuteCommand",
] as const;

/**
 * lsp: vscode-languageserver packages surface an LSP server plus per-method
 * capabilities. Those methods are external by construction — an LSP method's
 * only possible caller is an editor outside this repository.
 */
export const lspAdapter: Adapter = {
  name: "lsp",
  detect: (ctx) => ctx.packages.some((p) => depOf(p.manifest, "vscode-languageserver")),
  extract(ctx) {
    const result = out();
    for (const pkg of ctx.packages) {
      if (!depOf(pkg.manifest, "vscode-languageserver")) continue;
      const files = ctx.listFiles(`${pkg.dir}/src`, 4).filter((f) => CODE_FILE.test(f));
      const found = new Set<string>();
      for (const file of files.slice(0, 80)) {
        const content = ctx.read(file);
        if (content === null) continue;
        for (const method of LSP_METHODS) {
          if (content.includes(`${method}(`)) found.add(method);
        }
      }
      const name = slugify(pkgName(pkg));
      // packages that merely depend on the LSP libs (e.g. a CLI bundling the
      // server bin) are not themselves language servers: require either real
      // handler registrations or an lsp-named package
      if (found.size === 0 && !/(^|[-/])lsp([-/]|$)/.test(`${pkg.dir}/${name}`)) continue;
      result.sources.push(`${pkg.dir}/src`);
      const binds: Bind[] = [];
      for (const method of [...found].sort()) {
        const id = `cap:lsp-method:${name}.${slugify(method)}`;
        result.capabilities.push({
          id,
          kind: "lsp-method",
          name: method,
          surfaceArea: "lsp",
          status: "live",
          reach: "external",
          placement: { current: pkg.dir, verdict: "correct" },
          provenance: prov(`${pkg.dir}/src`, [`${pkg.dir}/src`], "medium"),
        });
        binds.push({ capabilityId: id, via: "inferred-high" });
      }
      result.surfaces.push({
        id: `surface:lsp:${name}`,
        surfaceType: "lsp",
        name: `${pkgName(pkg)} language server`,
        entry: { kind: "extension-point", value: pkgName(pkg) },
        purpose: `LSP server implemented in ${pkg.dir}.`,
        audience: ["developer"],
        status: "live",
        binds,
        placement: { current: pkg.dir, verdict: "correct" },
        provenance: prov(`${pkg.dir}/package.json`, [`${pkg.dir}/package.json`], "high"),
      });
    }
    return result;
  },
};
