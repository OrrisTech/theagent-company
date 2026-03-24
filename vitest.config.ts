import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/db", "packages/adapters/anthropic-api", "packages/adapters/openai-api", "packages/adapters/opencode-local", "server", "ui", "cli"],
  },
});
