import { defineConfig } from "vitest/config";

const TEST_TIMEOUT_MS = 30_000;

export default defineConfig({
  test: {
    testTimeout: TEST_TIMEOUT_MS,
  },
});
