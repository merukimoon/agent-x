
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OrchestratorService } from "../../../../packages/cli/src/services/orchestrator.ts";
import { Core } from "../../../../packages/cli/src/imports.ts";
import * as AgentsModule from "../../../../packages/cli/src/agents.ts";
import fs from "fs";
import path from "path";

// Mock dependencies
vi.mock("../../../../packages/cli/src/agents.ts");
vi.mock("fs");
vi.mock("path", async () => {
    const actual = await vi.importActual("path");
    return actual;
});

describe("OrchestratorService", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Default fs mocks to avoid errors
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
        vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
        vi.mocked(fs.readFileSync).mockReturnValue("");
        vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it("succeeds when planner returns 'done'", async () => {
        vi.mocked(AgentsModule.runAgent).mockResolvedValue({ status: "done" } as any);

        const result = await OrchestratorService.runPlannerWithPolicy("goal", "context", { log: () => { } });

        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
        expect(AgentsModule.runAgent).toHaveBeenCalledTimes(1);
    });

    it("retries on recoverable network error", async () => {
        // First attempt fails with LLM error, second succeeds
        vi.mocked(AgentsModule.runAgent)
            .mockResolvedValueOnce({ status: "failed" } as any)
            .mockResolvedValueOnce({ status: "done" } as any);

        // Mock validation error file for first attempt
        vi.mocked(fs.existsSync)
            .mockReturnValueOnce(true) // inputs existed
            .mockReturnValueOnce(true); // error file exists

        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ error_type: "llm_error" }));

        // Reduce backoff for test speed
        vi.spyOn(Core.OrchestratorPolicy, "BACKOFF_MS", "get").mockReturnValue(1 as any);

        const result = await OrchestratorService.runPlannerWithPolicy("goal", "context", { log: () => { } });

        expect(result.success).toBe(true);
        expect(AgentsModule.runAgent).toHaveBeenCalledTimes(2);
    });

    it("fails fast on fatal parse error", async () => {
        vi.mocked(AgentsModule.runAgent).mockResolvedValue({ status: "failed" } as any);

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ error_type: "validation" }));

        const result = await OrchestratorService.runPlannerWithPolicy("goal", "context", { log: () => { } });

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(11); // FATAL_PARSE
        expect(AgentsModule.runAgent).toHaveBeenCalledTimes(1);
    });

    it("fails when max retries exceeded", async () => {
        vi.mocked(AgentsModule.runAgent).mockResolvedValue({ status: "failed" } as any);
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ error_type: "llm_error" }));

        vi.spyOn(Core.OrchestratorPolicy, "BACKOFF_MS", "get").mockReturnValue(1);

        const result = await OrchestratorService.runPlannerWithPolicy("goal", "context", { log: () => { } });

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(10);
        expect(AgentsModule.runAgent).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
});
