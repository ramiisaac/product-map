import type { Adapter } from "../types";
import { depOf } from "@product-map/discovery";
import { commandStems, out, pkgName, prov } from "./shared";
import { DEFAULT_REACH, slugify } from "@product-map/spec";

/** Email/notification code hiding inside an app package — the canonical misplacement. */
const EMBEDDED_MAIL_PATHS = [
  ["lib/email", "email"],
  ["src/lib/email", "email"],
  ["src/emails", "email"],
  ["emails", "email"],
  ["lib/email.ts", "email"],
  ["src/lib/email.ts", "email"],
  ["lib/notifications", "notification"],
  ["src/lib/notifications", "notification"],
  ["lib/notifications.ts", "notification"],
  ["src/lib/notifications.ts", "notification"],
] as const;

/** email: dedicated email/notification packages, their template files, and email code embedded in apps. */
export const emailAdapter: Adapter = {
  name: "email",
  detect: (ctx) =>
    ctx.packages.some(
      (p) =>
        /email|notification/.test(p.dir) ||
        depOf(p.manifest, "resend") ||
        depOf(p.manifest, "react-email") ||
        depOf(p.manifest, "@react-email/components") ||
        depOf(p.manifest, "nodemailer") ||
        (p.dir.startsWith("apps/") && EMBEDDED_MAIL_PATHS.some(([rel]) => ctx.exists(`${p.dir}/${rel}`))),
    ),
  extract(ctx) {
    const result = out();
    // embedded-in-app detection: raw-fetch senders and notification renderers
    // living inside a web app instead of a dedicated package
    for (const pkg of ctx.packages) {
      if (!pkg.dir.startsWith("apps/")) continue;
      const foundByType = new Map<string, string[]>();
      for (const [rel, type] of EMBEDDED_MAIL_PATHS) {
        if (ctx.exists(`${pkg.dir}/${rel}`)) {
          const list = foundByType.get(type) ?? [];
          list.push(`${pkg.dir}/${rel}`);
          foundByType.set(type, list);
        }
      }
      for (const [type, evidence] of [...foundByType.entries()].sort()) {
        result.sources.push(...evidence);
        result.surfaces.push({
          id: `surface:${type as "email" | "notification"}:${slugify(pkg.dir.replace(/^apps\//, ""))}-embedded`,
          surfaceType: type as "email" | "notification",
          name: `${type} embedded in ${pkgName(pkg)}`,
          entry: { kind: "email-template", value: evidence[0] ?? pkg.dir },
          purpose: `${type === "email" ? "Email templates/delivery" : "Notification rendering/delivery"} implemented inside the ${pkgName(pkg)} app instead of a dedicated package.`,
          audience: ["end-user", "team-admin"],
          status: "live",
          binds: [],
          placement: {
            current: evidence[0] ?? pkg.dir,
            canonical: `packages/${type === "email" ? "email" : "notifications"}`,
            verdict: "misplaced",
          },
          provenance: prov(evidence[0] ?? pkg.dir, evidence, "high"),
        });
      }
    }
    for (const pkg of ctx.packages) {
      const base = pkg.dir.split("/").pop() ?? "";
      const named = /^(emails?|notifications?)$/.test(base) && pkg.dir.startsWith("packages");
      const dep =
        depOf(pkg.manifest, "resend") ||
        depOf(pkg.manifest, "react-email") ||
        depOf(pkg.manifest, "@react-email/components") ||
        depOf(pkg.manifest, "nodemailer");
      if (!named && !dep) continue;
      const name = slugify(pkgName(pkg));
      const templatesDir = ["src/templates", "src/emails", "emails", "templates"].find((d) =>
        ctx.exists(`${pkg.dir}/${d}`),
      );
      result.sources.push(`${pkg.dir}/package.json`);
      const misplaced = pkg.dir.startsWith("apps");
      result.surfaces.push({
        id: `surface:email:${name}`,
        surfaceType: "email",
        name: `${pkgName(pkg)} email/notifications`,
        entry: { kind: "email-template", value: templatesDir ? `${pkg.dir}/${templatesDir}` : pkg.dir },
        purpose: `Email/notification rendering and delivery owned by ${pkgName(pkg)}.`,
        audience: ["end-user", "team-admin"],
        status: "live",
        binds: [],
        placement: misplaced
          ? { current: pkg.dir, canonical: "packages/email", verdict: "misplaced" }
          : { current: pkg.dir, verdict: "correct" },
        provenance: prov(`${pkg.dir}/package.json`, [`${pkg.dir}/package.json`], dep ? "high" : "medium"),
      });
      if (templatesDir !== undefined) {
        const scope = `${pkg.dir}/${templatesDir}`;
        for (const stem of commandStems(ctx.listFiles(scope, 2), scope)) {
          result.capabilities.push({
            id: `cap:email-contract:${slugify(`${name}-${stem}`)}`,
            kind: "email-contract",
            name: stem,
            surfaceArea: "email",
            status: "live",
            reach: DEFAULT_REACH["email-contract"],
            placement: { current: pkg.dir, verdict: misplaced ? "misplaced" : "correct" },
            provenance: prov(scope, [scope], "medium"),
          });
        }
      }
    }
    return result;
  },
};
