import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import path from "path";

// Mock external dependencies
vi.mock("fs");
import fs from "fs";

vi.mock("../../../../scripts/agentic/roles_registry.ts", () => ({
    requireExecutableRole: vi.fn(),
}));
import { requireExecutableRole } from "../../../../scripts/agentic/roles_registry.ts";

vi.mock("../step_persistence.ts", () => ({
    writeStepResult: vi.fn(),
    writeDecision: vi.fn(),
    writeEffectiveDecision: vi.fn(),
    writeSkippedStepArtifacts: vi.fn(),
    updateStepsIndex: vi.fn(),
}));

vi.mock("../gating_runtime.ts", () => ({
    loadGatingPolicy: vi.fn().mockReturnValue({ strictness: "soft", rules: [] }),
    determineStrictness: vi.fn().mockReturnValue("soft"),
    applyOverride: vi.fn(),
    readOverride: vi.fn().mockReturnValue(null),
    evaluateStepGates: vi.fn().mockReturnValue({ gate_status: "pass", hard_failed_ids: [], soft_failed_ids: [], notes: [] }),
}));

// Synchronous mock for imports.ts including Runners
vi.mock("../imports.ts", () => {
    const path = require("path");
    return {
        Legacy: {
            ensureRunAndInputs: vi.fn(),
            readFirstLines: vi.fn().mockReturnValue("mock excerpt"),
            readFileText: vi.fn().mockReturnValue("mock text"),
            writeJsonFile: vi.fn(),
            writeFileAtomic: vi.fn(),
            buildNotes: vi.fn().mockReturnValue("mock notes"),
            classifyFlow: vi.fn().mockReturnValue({ signals: [], pack: { steps: [{ id: "s1", agent: "planner", depends_on: [] }], flow_type: "mock-flow" } }),
        },
        Core: {
            PLAN_VERSION: "plan.v1",
            isAgentName: vi.fn().mockReturnValue(true),
            getStepDir: vi.fn((runDir, stepId) => path.join(runDir, "steps", stepId)),
            getCanonicalOutputs: vi.fn().mockReturnValue({ result: "out.json", notes: "notes.md" }),
            validateCanonicalOutputs: vi.fn(),
        },
        Runners: {
            runTechnicalWriter: vi.fn().mockReturnValue({ status: "done", summary: "mock summary" }),
        }
    };
});

import * as agents from "../agents.ts";

describe("runAgent (integration-unit)", () => {
    const mockRunId = "run-unit";
    const runDirName = "runs";
    const mockRunDir = path.join(process.cwd(), runDirName, mockRunId);

    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(process, "cwd").mockReturnValue("/mock/cwd");

        // Setup fs mocks
        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
        vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ steps: [] }));
        vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);

        // Setup registry mock
        (requireExecutableRole as any).mockReturnValue({
            runner: "mock-runner",
            script: "mock-script.ts",
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.skip("executes happy path for planner (skipped runner logic)", async () => {
        try {
            const result = await agents.runAgent("planner", mockRunId, "dry-run");
            expect(result).toBeDefined();
            expect(result.agent).toBe("planner");
        } catch (e) {
            console.error("FAIL: planner run", e);
            throw e;
        }
    });

    it.skip("executes technical-writer flow (invokes runner)", async () => {
        try {
            const result = await agents.runAgent("technical-writer", mockRunId, "dry-run");
            expect(result.agent).toBe("technical-writer");
            expect(result.summary).toBe("mock summary");
        } catch (e) {
            console.error("FAIL: tech-writer run", e);
            throw e;
        }
    });

    it.skip("executes coordinator flow (classification)", async () => {
        try {
            const result = await agents.runAgent("coordinator", mockRunId, "dry-run");
            expect(result.agent).toBe("coordinator");
        } catch (e) {
            console.error("FAIL: coordinator run", e);
            throw e;
        }
    });
});
