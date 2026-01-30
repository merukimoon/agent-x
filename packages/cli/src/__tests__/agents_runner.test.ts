import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import path from "path";
import fs from "fs";
import { requireExecutableRole } from "../../../../scripts/agentic/roles_registry.ts";
import { Legacy, Core, Runners } from "../imports.ts";
import * as agents from "../agents.ts";

vi.mock("fs");
vi.mock("../../../../scripts/agentic/roles_registry.ts");

// Explicit mock for step_persistence
vi.mock("../step_persistence.ts", () => ({
    writeStepResult: vi.fn(),
    writeDecision: vi.fn(),
    writeEffectiveDecision: vi.fn(),
    updateStepsIndex: vi.fn(),
}));

vi.mock("../gating_runtime.ts", () => ({
    loadGatingPolicy: vi.fn(),
    determineStrictness: vi.fn().mockReturnValue("soft"),
    applyOverride: vi.fn().mockReturnValue({ decision: { action: "continue", reason: "mock-reason" } }),
    readOverride: vi.fn().mockReturnValue(null),
    evaluateStepGates: vi.fn().mockReturnValue({ gate_status: "pass", hard_failed_ids: [], soft_failed_ids: [], notes: [] }),
}));
vi.mock("../../../../scripts/agentic/runners.ts");

vi.mock("../imports.ts", () => {
    const path = require("path");
    return {
        Legacy: {
            ensureRunAndInputs: vi.fn(),
            readFirstLines: vi.fn(),
            readFileText: vi.fn(),
            writeJsonFile: vi.fn(),
            writeFileAtomic: vi.fn(),
            buildNotes: vi.fn(),
            classifyFlow: vi.fn(),
        },
        Core: {
            PLAN_VERSION: "plan.v1",
            isAgentName: vi.fn().mockReturnValue(true),
            getStepDir: vi.fn((runDir, stepId) => path.join(runDir, "steps", stepId)),
            getCanonicalOutputs: vi.fn(),
            validateCanonicalOutputs: vi.fn(),
        },
        Runners: {
            runTechnicalWriter: vi.fn(),
        }
    };
});

describe("agents execution (main path)", () => {
    const mockRunId = "run-unit-test";

    beforeEach(() => {
        vi.clearAllMocks();

        // FS setup
        vi.spyOn(process, "cwd").mockReturnValue("/mock/cwd");
        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
        vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
        vi.spyOn(fs, "readFileSync").mockReturnValue("{}");

        // Role registry setup
        (requireExecutableRole as Mock).mockReturnValue({ runner: "mock-runner", script: "mock.ts" });

        // Legacy/Core Setup
        (Legacy.ensureRunAndInputs as Mock).mockReturnValue({
            status: "ok",
            inputs: { context_ref: "c.md", request_ref: "r.md", artifacts_in: [] }
        });
        (Legacy.readFirstLines as Mock).mockReturnValue("mock excerpt");
        (Legacy.readFileText as Mock).mockReturnValue("mock text");
        (Legacy.buildNotes as Mock).mockReturnValue("mock notes");
        (Legacy.classifyFlow as Mock).mockReturnValue({
            signals: [],
            pack: { steps: [{ id: "s1", agent: "planner", depends_on: [] }], flow_type: "mock-flow" }
        });

        (Core.getCanonicalOutputs as Mock).mockReturnValue({ result: "out.json", notes: "notes.md" });

        // Runners Setup
        (Runners.runTechnicalWriter as Mock).mockReturnValue({ status: "done", summary: "mock-execution" });
    });

    it("executes planner happy path", async () => {
        const result = await agents.runAgent("planner", mockRunId, "dry-run");
        expect(result.agent).toBe("planner");
        expect(result.status).toBe("done");
        expect(Legacy.writeJsonFile).toHaveBeenCalled();
    });

    it("executes technical-writer happy path", async () => {
        const result = await agents.runAgent("technical-writer", mockRunId, "dry-run");
        expect(result.agent).toBe("technical-writer");
        expect(result.status).toBe("done");
        expect(Runners.runTechnicalWriter).toHaveBeenCalled();
    });
});
