import { banner, readRoot } from "./lib.mjs";

/**
 * The plugin ships to consuming repos on its own, so the normative documents
 * its skills cite have to travel with it. Each skill's `references/` copy is
 * republished from the repo-level document it mirrors.
 */
const REFERENCES = [
  {
    source: "docs/SPEC.md",
    target: "plugins/product-map/skills/pmap-guide-overview/references/spec.md",
  },
  {
    source: "docs/AUTHORING-LOCAL-EXTRACTORS.md",
    target: "plugins/product-map/skills/pmap-guide-extractors/references/authoring-guide.md",
  },
];

export default {
  name: "plugin-references",
  generate() {
    return REFERENCES.map(({ source, target }) => ({
      path: target,
      content: `${banner(source)}\n\n${readRoot(source)}`,
    }));
  },
};
