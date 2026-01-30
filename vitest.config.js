import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,ts}"],
    include: [
      "tests/**/*.{test,spec}.{js,ts,tsx}",
      "packages/**/src/__tests__/**/*.{test,spec}.{js,ts,tsx}",
      "packages/**/src/**/*.{test,spec}.{js,ts,tsx}",
    ],
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
        "**/src/index.ts",
        "packages/cli/src/cli.ts",
        "packages/cli/src/index.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
