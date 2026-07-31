import { readdirSync } from "node:fs";

import { banner, fromRoot, readRoot } from "./lib.mjs";

const LAYERS = [
  { rank: 0, packages: ["@product-map/spec", "@product-map/runtime"] },
  { rank: 1, packages: ["@product-map/discovery"] },
  { rank: 2, packages: ["@product-map/extract", "@product-map/derive", "@product-map/emit"] },
  { rank: 3, packages: ["@product-map/engine"] },
  { rank: 4, packages: ["product-map"] },
];

const RANK_OF = new Map(LAYERS.flatMap((layer) => layer.packages.map((name) => [name, layer.rank])));

/**
 * Workspace membership is decided by reading every manifest name first, not by
 * matching a scope prefix. One of the published packages is unscoped, and a
 * prefix test for it would also match any unrelated `product-map-*` dependency.
 */
function readWorkspacePackages() {
  const manifests = [];
  for (const dir of readdirSync(fromRoot("packages")).sort()) {
    try {
      manifests.push({ dir, manifest: JSON.parse(readRoot("packages", dir, "package.json")) });
    } catch {
      continue;
    }
  }
  const names = new Set(manifests.map(({ manifest }) => manifest.name));
  const packages = new Map();
  for (const { dir, manifest } of manifests) {
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
    const edges = Object.keys(dependencies)
      .filter((name) => names.has(name))
      .sort();
    packages.set(manifest.name, { dir, edges, private: manifest.private === true });
  }
  return packages;
}

function findCycle(packages) {
  const state = new Map();
  const stack = [];

  const visit = (name) => {
    if (state.get(name) === "done") return null;
    if (state.get(name) === "visiting") return [...stack.slice(stack.indexOf(name)), name];
    state.set(name, "visiting");
    stack.push(name);
    for (const edge of packages.get(name)?.edges ?? []) {
      if (!packages.has(edge)) continue;
      const cycle = visit(edge);
      if (cycle !== null) return cycle;
    }
    stack.pop();
    state.set(name, "done");
    return null;
  };

  for (const name of packages.keys()) {
    const cycle = visit(name);
    if (cycle !== null) return cycle;
  }
  return null;
}

function findUpwardEdges(packages) {
  const violations = [];
  for (const [name, info] of packages) {
    const rank = RANK_OF.get(name);
    if (rank === undefined) continue;
    for (const edge of info.edges) {
      const edgeRank = RANK_OF.get(edge);
      if (edgeRank === undefined) continue;
      if (edgeRank >= rank) violations.push(`${name} (layer ${rank}) depends on ${edge} (layer ${edgeRank})`);
    }
  }
  return violations;
}

function findUnlayered(packages) {
  return [...packages.keys()].filter((name) => !RANK_OF.has(name)).sort();
}

function renderGraph(packages) {
  const lines = [
    banner("the workspace package manifests"),
    "",
    "# Package layering",
    "",
    "Dependencies point strictly downward. A package may depend only on packages in a lower layer; equal-layer and upward edges fail `pnpm generate:check`.",
    "",
    "```mermaid",
    "graph TD",
  ];

  for (const layer of LAYERS) {
    for (const name of layer.packages) {
      if (!packages.has(name)) continue;
      lines.push(`  ${JSON.stringify(name)}`);
    }
  }
  for (const [name, info] of packages) {
    if (!RANK_OF.has(name)) continue;
    for (const edge of info.edges) {
      if (!RANK_OF.has(edge)) continue;
      lines.push(`  ${JSON.stringify(name)} --> ${JSON.stringify(edge)}`);
    }
  }
  lines.push("```", "", "| Layer | Package | Published | Depends on |", "| ----- | ------- | --------- | ---------- |");

  for (const layer of LAYERS) {
    for (const name of layer.packages) {
      const info = packages.get(name);
      if (info === undefined) continue;
      const edges = info.edges.filter((edge) => packages.has(edge));
      lines.push(
        `| ${layer.rank} | \`${name}\` | ${info.private ? "no" : "yes"} | ${edges.length === 0 ? "—" : edges.map((edge) => `\`${edge}\``).join(", ")} |`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

export default {
  name: "dependency-graph",
  generate() {
    const packages = readWorkspacePackages();

    const unlayered = findUnlayered(packages);
    if (unlayered.length > 0) {
      throw new Error(
        `workspace packages missing from the declared layering in scripts/generate/dependency-graph.mjs: ${unlayered.join(", ")}`,
      );
    }

    const cycle = findCycle(packages);
    if (cycle !== null) {
      throw new Error(`dependency cycle across workspace packages: ${cycle.join(" -> ")}`);
    }

    const upward = findUpwardEdges(packages);
    if (upward.length > 0) {
      throw new Error(`layering violated — dependencies must point strictly downward:\n  ${upward.join("\n  ")}`);
    }

    return [{ path: "docs/ARCHITECTURE.md", content: renderGraph(packages) }];
  },
};
