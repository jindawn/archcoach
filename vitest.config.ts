import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "evals/**/*.test.ts", "mcp/**/*.test.mjs"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/core/**"],
    },
  },
});
