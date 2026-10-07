import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { loadRepoContext } from "@product-map/discovery";
import { describe, expect, it } from "vitest";

import { honoAdapter } from "../adapters/hono-api";

function write(root: string, path: string, content: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function honoRepo(dir: string, routes: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pmap-d3b-"));
  write(root, "package.json", '{"name":"fixture","private":true}\n');
  write(root, `${dir}/package.json`, `${JSON.stringify({ name: "@fixture/api", dependencies: { hono: "latest" } })}\n`);
  for (const [file, content] of Object.entries(routes)) write(root, `${dir}/src/routes/${file}`, content);
  return root;
}

const extract = (root: string) => honoAdapter.extract(loadRepoContext(root));

const routeIds = (root: string): string[] =>
  extract(root)
    .capabilities.filter((item) => item.kind === "route")
    .map((item) => item.id);

describe("hono-api counts only modules that register routes", () => {
  it("does not count a types-only module", () => {
    const root = honoRepo("apps/api", {
      "common.ts": "export type User = { id: string; name: string };\nexport interface Page { cursor: string }\n",
      "users.ts": 'export const users = new Hono().get("/", (c) => c.json([]));\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-users"]);
  });

  it("counts a module registering a HEAD route", () => {
    const root = honoRepo("apps/api", {
      "health.ts": 'export const health = new Hono();\nhealth.head("/health", (c) => c.body(null));\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-health"]);
  });

  it("does not mistake a Map lookup helper for a route", () => {
    const root = honoRepo("apps/api", {
      "cache.ts": "const cache = new Map<string, string>();\nexport const lookup = (key: string) => cache.get(key);\n",
      "users.ts": 'const app = new Hono();\napp.get("/users", (c) => c.json([]));\nexport default app;\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-users"]);
  });

  it("does not count a commented-out registration", () => {
    const root = honoRepo("apps/api", {
      "legacy.ts": '// app.get("/legacy", handler);\n/* app.post("/legacy", handler); */\nexport {};\n',
      "users.ts": 'export const users = new Hono().get("/", (c) => c.json([]));\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-users"]);
  });

  it("counts any OpenAPI registration, whatever its first argument", () => {
    const root = honoRepo("apps/api", {
      "docs.ts":
        'import { OpenAPIHono, createRoute } from "@hono/zod-openapi";\n' +
        'const listRoute = createRoute({ method: "get", path: "/docs", responses: {} });\n' +
        "export const docs = new OpenAPIHono();\ndocs.openapi(listRoute, (c) => c.json([]));\n",
    });

    expect(routeIds(root)).toEqual(["cap:route:api-docs"]);
  });

  it("does not count a handler-only module", () => {
    const root = honoRepo("apps/api", {
      "handlers.ts": 'export const getUser = (c: Context) => c.json({ id: c.req.param("id") });\n',
      "users.ts": 'import { getUser } from "./handlers";\nexport const users = new Hono().get("/:id", getUser);\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-users"]);
  });

  it("reads the path of an on() registration after its method argument", () => {
    const root = honoRepo("apps/api", {
      "cache.ts": 'export const cache = new Hono();\ncache.on("PURGE", "/cache", (c) => c.body(null));\n',
      "posts.ts": 'export const posts = new Hono();\nposts.on(["PUT", "DELETE"], "/posts/:id", (c) => c.body(null));\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-cache", "cap:route:api-posts"]);
  });

  it("counts only registering modules in the service surface", () => {
    const root = honoRepo("apps/api", {
      "common.ts": "export type User = { id: string };\n",
      "users.ts": 'export const users = new Hono().get("/", (c) => c.json([]));\n',
      "webhooks/stripe.ts": 'export const stripe = new Hono().post("/webhooks/stripe", (c) => c.body(null));\n',
    });
    const output = extract(root);

    expect(output.surfaces.map((item) => [item.id, item.purpose])).toEqual([
      ["surface:other:api-api", "Hono API service at apps/api (2 route modules)."],
    ]);
  });

  it("falls back to a service for an app whose route modules register nothing", () => {
    const root = honoRepo("apps/api", {
      "common.ts": "export type User = { id: string };\n",
      "handlers.ts": 'export const ping = (c: Context) => c.text("pong");\n',
    });
    const output = extract(root);

    expect(output.capabilities.map((item) => item.id)).toEqual(["cap:service:api"]);
    expect(output.surfaces).toEqual([]);
  });

  it("emits nothing for a library whose route modules register nothing", () => {
    const root = honoRepo("packages/auth", { "common.ts": "export type Session = { id: string };\n" });
    const output = extract(root);

    expect(output.capabilities).toEqual([]);
    expect(output.surfaces).toEqual([]);
  });
});

describe("hono-api reads registrations from a real parse", () => {
  it("finds a route after division of a postfix increment on the same line", () => {
    const root = honoRepo("apps/api", {
      "health.ts": 'let count = 0; count++ / 2; app.get("/health", (c) => c.text("ok")); const half = 1 / 2;\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-health"]);
  });

  it("finds a route after division of an object literal member on the same line", () => {
    const root = honoRepo("apps/api", {
      "ratio.ts": 'const half = { n: 4 }.n / 2; app.get("/ratio", (c) => c.json(half)); const q = 1 / 2;\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-ratio"]);
  });

  it("does not read a regex literal after a control-flow paren as code", () => {
    const root = honoRepo("apps/api", {
      "check.ts":
        'export const check = (ok: boolean, s: string) => {\n  if (ok) /app.get("\\/fake", h)/.test(s);\n};\n',
    });

    expect(routeIds(root)).toEqual([]);
  });

  it("does not read JSX text as a registration", () => {
    const root = honoRepo("apps/api", {
      "help.tsx": 'export const Help = () => <p>Call app.get("/docs", handler) to serve the docs</p>;\n',
    });

    expect(routeIds(root)).toEqual([]);
  });

  it("keeps reading after a brace inside a comment or regex within a template interpolation", () => {
    const root = honoRepo("apps/api", {
      "comment.ts": 'const label = `${/* { */ name}`;\napp.get("/comment", (c) => c.text(label));\n',
      "pattern.ts": 'const flag = `${/{/.test(name)}`;\napp.get("/pattern", (c) => c.text(flag));\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-comment", "cap:route:api-pattern"]);
  });

  it("does not take the literal prefix of a concatenated path as a route path", () => {
    const root = honoRepo("apps/api", { "prefixed.ts": 'app.get("/" + base, (c) => c.text("ok"));\n' });

    expect(routeIds(root)).toEqual([]);
  });

  it("registers nothing from a module that does not parse, such as one with an unterminated string", () => {
    const root = honoRepo("apps/api", {
      "broken.ts": 'app.get("/broken, (c) => c.text("ok"));\n',
      "users.ts": 'export const users = new Hono().get("/", (c) => c.json([]));\n',
    });

    expect(routeIds(root)).toEqual(["cap:route:api-users"]);
  });
});
