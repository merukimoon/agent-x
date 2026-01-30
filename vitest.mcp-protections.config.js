import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["packages/mcp/src/__tests__/integration/mcp_http_protections.int.test.ts"],
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
