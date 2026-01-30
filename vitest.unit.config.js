import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for UNIT tests only.
 * 
 * Unit tests are:
 * - Located in packages slash star star slash src slash __tests__ slash star star
 * - Colocated in packages slash star star slash src slash star star slash *.{test,spec}.{js,ts,tsx}
 * - Must be deterministic, fast, and isolated
 * - Must mock all external dependencies (fs, network, time, etc.)
 * 
 * Coverage thresholds are ENFORCED for unit tests.
 */
export default defineConfig({
    test: {
        environment: "node",
        // ONLY include unit test patterns
        include: [
            "packages/**/src/__tests__/**/*.{test,spec}.{js,ts,tsx}",
            "packages/**/src/**/*.{test,spec}.{js,ts,tsx}",
        ],
        // EXCLUDE integration tests
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "tests/**", // Integration tests excluded
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
            // ENFORCED thresholds for unit tests
            thresholds: {
                lines: 95,
                functions: 95,
                branches: 90,
                statements: 95,
            },
        },
    },
});
