import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["packages/**/src/**/*.{ts,tsx}"],
      exclude: [
        "**/__tests__/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.stress.test.*",
        "**/dist/**",
        "**/build/**",
        "**/node_modules/**",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
