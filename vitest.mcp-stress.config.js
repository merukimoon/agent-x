import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/src/__tests__/stress/**/*.stress.test.{js,ts,tsx}"],
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
