import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Run ONLY unit tests
    include: [
      'packages/**/src/__tests__/unit/**/*.unit.test.{js,ts,tsx}',
      'tests/unit/**/*.unit.test.{js,ts,tsx}'
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],

      // Collect coverage for ALL packages code
      include: ['packages/**/src/**/*.{ts,tsx}'],

      exclude: [
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.stress.test.*',
        '**/dist/**',
        '**/build/**',
        '**/node_modules/**',

        // Optional: exclude barrel/index files if you don’t want them counted
        '**/src/index.ts',

        // Optional: exclude CLI entrypoints (often mostly wiring)
        'packages/cli/src/cli.ts',
        'packages/cli/src/index.ts',

        // Exclude server/transport wiring that is exercised via integration tests
        'packages/mcp/src/server/**',
        'packages/mcp/src/transports/**',
      ],

      thresholds: {
        lines: 35,
        functions: 25,
        branches: 40,
        statements: 35,
      },
    },
  },
});
