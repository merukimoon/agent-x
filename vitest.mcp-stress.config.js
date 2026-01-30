import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["packages/mcp/src/__tests__/**/*.stress.test.{js,ts}"],
        fileParallelism: false,
        maxConcurrency: 1,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
    },
});
