import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/src/__tests__/**/*.test.{js,ts}",
      "tests/**/*.test.{js,ts}"
    ],
    exclude: [
      "packages/mcp/src/__tests__/mcp_http_protections.test.ts",
      "packages/mcp/src/__tests__/mcp_async_http.test.ts",
      "**/node_modules/**",
      "**/dist/**"
    ],
  },
});
