import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/eval/cases/**/*.eval.ts"],
    globals: true,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@theagentcompany/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
