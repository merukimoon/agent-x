import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/src/__tests__/unit/**/*.unit.test.{js,ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
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
        "packages/cli/src/**",
        "packages/core/src/**",
        "packages/mcp/src/server/**",
        "packages/mcp/src/transports/**",
      ],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 80,
        statements: 85,
      },
    },
  },
});
