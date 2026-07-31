import { describe, expect, it } from "vitest";

import { createPathMatcher } from "../glob";

describe("createPathMatcher", () => {
  it("matches a named directory and everything beneath it", () => {
    const ignored = createPathMatcher(["packages/legacy"]);
    expect(ignored("packages/legacy")).toBe(true);
    expect(ignored("packages/legacy/src/index.ts")).toBe(true);
    expect(ignored("packages/legacy-ui/src/index.ts")).toBe(false);
    expect(ignored("packages/current/src/index.ts")).toBe(false);
  });

  it("keeps a single star inside one path segment", () => {
    const ignored = createPathMatcher(["apps/*/dist"]);
    expect(ignored("apps/web/dist")).toBe(true);
    expect(ignored("apps/web/dist/main.js")).toBe(true);
    expect(ignored("apps/web/nested/dist")).toBe(false);
  });

  it("crosses segments for a globstar", () => {
    const ignored = createPathMatcher(["**/__generated__/**"]);
    expect(ignored("src/deep/__generated__/schema.ts")).toBe(true);
    expect(ignored("src/deep/generated/schema.ts")).toBe(false);
  });

  it("matches exactly one character for a question mark", () => {
    const ignored = createPathMatcher(["src/v?.ts"]);
    expect(ignored("src/v1.ts")).toBe(true);
    expect(ignored("src/v10.ts")).toBe(false);
  });

  it("treats regex metacharacters in a pattern as literals", () => {
    const ignored = createPathMatcher(["docs/a.b.md"]);
    expect(ignored("docs/a.b.md")).toBe(true);
    expect(ignored("docs/axbxmd")).toBe(false);
  });

  it("matches nothing when no patterns are given", () => {
    const ignored = createPathMatcher([]);
    expect(ignored("anything")).toBe(false);
    expect(ignored.patterns).toEqual([]);
  });
});
