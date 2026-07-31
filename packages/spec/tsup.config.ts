import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  // Declarations come from `tsc -p tsconfig.build.json`, not from tsup's
  // bundled rollup-plugin-dts: that plugin ships compiled against an older
  // TypeScript and crashes on the TS 7 compiler API. Emitting with the
  // compiler that owns the types is both correct and one less reimplementation
  // of declaration emit to keep working.
  dts: false,
  clean: true,
  target: "node22",
});
