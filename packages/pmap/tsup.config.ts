import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  target: "node22",
  // The private layer packages are inlined so the published tarball declares
  // no unpublishable dependencies. @product-map/spec is published in its own
  // right and must stay a real external dependency, so the exclusion is by
  // name rather than by scope prefix.
  external: ["@product-map/spec"],
  noExternal: [/^@product-map\//],
});
