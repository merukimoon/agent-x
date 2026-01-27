import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/integration/**/*.test.{js,ts}"],
        exclude: ["**/*.stress.test.{js,ts}"],
        fileParallelism: false,
        maxConcurrency: 1,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        testTimeout: 30000,
    },
});
