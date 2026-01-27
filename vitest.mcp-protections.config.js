import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/mcp/mcp_http_protections.test.ts"],
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
