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
        // ONLY include integration test patterns
        include: [
            "tests/**/*.{test,spec}.{js,ts,tsx}",
        ],
        // EXCLUDE unit tests and stress tests
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/*.stress.test.*",
            "packages/**/src/__tests__/**", // Unit tests excluded
            "packages/**/src/**/*.{test,spec}.*", // Colocated unit tests excluded
        ],
        // Coverage can be collected but is NOT gating for integration tests
        coverage: {
            enabled: false, // Disable by default for integration runs
        },
    },
});
