import { defineConfig } from "vitest/config";

const TEST_TIMEOUT_MS = 30_000;

export default defineConfig({
  test: {
    testTimeout: TEST_TIMEOUT_MS,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/cli.ts", "src/index.ts", "src/generator.ts"],
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 90,
        lines: 90,
      },
    },
  },
});
