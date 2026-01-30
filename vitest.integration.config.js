import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for INTEGRATION tests only.
 * 
 * Integration tests are:
 * - Located in tests/**
 * - May interact with filesystem, CLI, and real external systems
 * - Must still be deterministic (no external API calls, use fixtures)
 * - May use temporary directories and real file I/O
 * 
 * Coverage is NOT enforced for integration tests.
 * Integration tests verify end-to-end behavior and contracts.
 */
export default defineConfig({
    test: {
        environment: "node",
        include: [
            "packages/mcp/src/__tests__/integration/**/*.int.test.{js,ts,tsx}",
        ],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/*.stress.test.*",
        ],
        fileParallelism: false,
        maxConcurrency: 1,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        coverage: {
            enabled: false,
        },
    },
});
