import type { SurfaceItem } from "@product-map/spec";
import { describe, expect, it } from "vitest";

import { diagnose, renderDiagnosis } from "../doctor";
import { capabilities, surface, surfaces } from "./fixtures";

function docsSite(views: NonNullable<SurfaceItem["views"]>): SurfaceItem {
  return surface({
    id: "surface:docs:site",
    surfaceType: "docs",
    name: "site",
    entry: { kind: "route", value: "/" },
    views,
    placement: { current: "apps/site", verdict: "correct" },
  });
}

function catchAllFindings(item: SurfaceItem) {
  const data = diagnose({
    surfaces: surfaces([item]),
    capabilities: capabilities(),
    adaptersAvailable: ["next-apps"],
    adaptersRun: ["next-apps"],
    adaptersExcluded: [],
    skipped: [],
    localIssues: [],
    adapterIssues: [],
  });
  return { data, findings: data.findings.filter((finding) => finding.code === "catch-all-route") };
}

describe("doctor catch-all-route", () => {
  it("notes a surface whose view names include a catch-all or optional catch-all segment", () => {
    const { data, findings } = catchAllFindings(
      docsSite([
        { id: "home", name: "/" },
        { id: "docs-slug", name: "/docs/[[...slug]]" },
        { id: "blocks-categories", name: "/blocks/[...categories]" },
        { id: "post", name: "/blog/[id]" },
      ]),
    );

    expect(findings).toEqual([
      {
        severity: "note",
        code: "catch-all-route",
        detail:
          "surface:docs:site has catch-all view(s) /docs/[[...slug]], /blocks/[...categories] and may render more pages than its view list shows",
        remedy: expect.stringContaining("docs/reference/product-map/extract.local.mjs"),
      },
    ]);
    expect(renderDiagnosis(data)).toContain("catch-all-route");
  });

  it("reads view names, not ids, so a catch-all id over a plain name is not a catch-all", () => {
    const { findings } = catchAllFindings(docsSite([{ id: "[...slug]", name: "/guides" }]));

    expect(findings).toEqual([]);
  });

  it("stays silent for dynamic segments that are not catch-alls", () => {
    const { findings } = catchAllFindings(
      docsSite([
        { id: "home", name: "/" },
        { id: "post", name: "/blog/[id]" },
        { id: "group", name: "/(marketing)/pricing" },
      ]),
    );

    expect(findings).toEqual([]);
  });

  it("stays silent for a surface with no views", () => {
    expect(catchAllFindings(surface()).findings).toEqual([]);
  });
});
