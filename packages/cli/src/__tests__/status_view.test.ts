import { describe, expect, it, vi } from "vitest";
import path from "path";
import { buildStatusView, type StatusViewDeps } from "../status_view.ts";
import { renderStatusView } from "../status_render.ts";
import type { NormalizedStatus } from "../status_view.ts";

describe("buildStatusView (unit)", () => {
    const mockRunId = "run-unit-test";
    const runDirName = "runs";
    const mockRunDir = path.join(process.cwd(), runDirName, mockRunId);

    function createMockDeps(files: Record<string, string> = {}): StatusViewDeps {
        return {
            fs: {
                existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
                statSync: (p) => ({ isFile: () => true }),
                readFileSync: (p) => files[p],
            },
        };
    }

    it("returns invalid status when run.json is missing", () => {
        const deps = createMockDeps({});
        const view = buildStatusView(mockRunDir, deps);
        expect(view?.overall).toBe("invalid");
        expect(view?.errors).toContain("MISSING run.json");
    });

    it("returns invalid status when steps/index.json is missing", () => {
        const files = {
            [path.join(mockRunDir, "run.json")]: JSON.stringify({ id: mockRunId, status: "pending" }),
        };
        const deps = createMockDeps(files);
        const view = buildStatusView(mockRunDir, deps);
        expect(view?.errors).toContain("MISSING steps/index.json");
    });

    it("builds correct view for finished success run", () => {
        const files = {
            [path.join(mockRunDir, "run.json")]: JSON.stringify({
                id: mockRunId,
                status: "done",
                exit_code: 0,
            }),
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                run_id: mockRunId,
                steps: [
                    { step_index: 0, step_id: "step-1", agent_name: "planner", status: "done", decision_action: "continue" },
                ],
            }),
            [path.join(mockRunDir, "steps", "step-1", "effective_decision.json")]: JSON.stringify({
                decision: { action: "continue" }
            }),
            [path.join(mockRunDir, "steps", "step-1", "decision_after_step.json")]: JSON.stringify({
                decision: { action: "continue" }
            }),
            [path.join(mockRunDir, "steps", "step-1", "step_result.json")]: JSON.stringify({
                status: "done"
            }),
        };
        const deps = createMockDeps(files);
        const view = buildStatusView(mockRunDir, deps);

        expect(view?.overall).toBe("finished_success");
        expect(view?.steps).toHaveLength(1);
        expect(view?.current_state.is_blocked).toBe(false);
    });

    it("detects blocked state from require_human decision", () => {
        const files = {
            [path.join(mockRunDir, "run.json")]: JSON.stringify({
                id: mockRunId,
                status: "running",
            }),
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                run_id: mockRunId,
                steps: [
                    { step_index: 0, step_id: "step-1", agent_name: "planner", status: "done", decision_action: "require_human" },
                ],
            }),
            [path.join(mockRunDir, "steps", "step-1", "effective_decision.json")]: JSON.stringify({
                decision: { action: "require_human", reason: "confirm plan" },
                requirements: { required_inputs: ["confirmation"] }
            }),
            [path.join(mockRunDir, "steps", "step-1", "human_prompt.md")]: "Please confirm",
        };
        const deps = createMockDeps(files);
        const view = buildStatusView(mockRunDir, deps);

        expect(view?.current_state.is_blocked).toBe(true);
        expect(view?.current_state.blocked_reason).toBe("confirm plan");
        expect(view?.current_state.next_action).toBe("approve_or_override");
        expect(view?.current_state.paths.some(p => p.includes("human_prompt.md"))).toBe(true);
    });
    it("handles corrupt run.json", () => {
        const files = {
            [path.join(mockRunDir, "run.json")]: "{ bad json",
        };
        const deps = createMockDeps(files);
        const view = buildStatusView(mockRunDir, deps);
        expect(view?.errors).toContain("INVALID_JSON run.json");
    });

    it("handles corrupt decision files gracefully", () => {
        const files = {
            [path.join(mockRunDir, "run.json")]: JSON.stringify({ id: mockRunId, status: "done", exit_code: 0 }),
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                run_id: mockRunId,
                steps: [{ step_index: 0, step_id: "s1", status: "done" }]
            }),
            [path.join(mockRunDir, "steps", "s1", "effective_decision.json")]: "{ bad json"
        };
        const deps = createMockDeps(files);
        const view = buildStatusView(mockRunDir, deps);
        expect(view?.overall).toBe("finished_success");
    });

    it("detects blocked state from request_clarification", () => {
        const files = {
            [path.join(mockRunDir, "run.json")]: JSON.stringify({ id: mockRunId, status: "running" }),
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                run_id: mockRunId,
                steps: [
                    { step_index: 0, step_id: "s1", status: "done", decision_action: "request_clarification" },
                ],
            }),
            [path.join(mockRunDir, "steps", "s1", "effective_decision.json")]: JSON.stringify({
                decision: { action: "request_clarification", reason: "need info" },
                requirements: { required_inputs: ["docs"] }
            }),
        };
        const deps = createMockDeps(files);
        const view = buildStatusView(mockRunDir, deps);

        expect(view?.current_state.is_blocked).toBe(true);
        expect(view?.current_state.next_action).toBe("provide_inputs");
        expect(view?.current_state.required_inputs).toContain("docs");
    });

    it("detects failed step state", () => {
        const files = {
            [path.join(mockRunDir, "run.json")]: JSON.stringify({ id: mockRunId, status: "failed", exit_code: 1 }),
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                run_id: mockRunId,
                steps: [
                    { step_index: 0, step_id: "s1", status: "failed" },
                ],
            }),
        };
        const deps = createMockDeps(files);
        const view = buildStatusView(mockRunDir, deps);

        expect(view?.current_state.is_blocked).toBe(true);
        expect(view?.current_state.next_action).toBe("inspect_artifacts");
        expect(view?.overall).toBe("finished_failure");
    });
    it("uses default deps (coverage)", () => {
        const view = buildStatusView("/non-existent/path");
        expect(view?.overall).toBe("invalid");
    });

    it("handles corrupt steps/index.json", () => {
        const files = {
            [path.join(mockRunDir, "run.json")]: JSON.stringify({ id: mockRunId, status: "pending" }),
            [path.join(mockRunDir, "steps", "index.json")]: "{ bad json",
        };
        const deps = createMockDeps(files);
        const view = buildStatusView(mockRunDir, deps);
        expect(view?.errors).toContain("MISSING steps/index.json"); // Returns null from readStepsIndex, so error is pushed
    });

    it("fully exercises defaultDeps via fs mock", () => {
        const fs = require("fs");
        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true });
        vi.spyOn(fs, "readFileSync").mockImplementation((p: any) => {
            if (p.endsWith("run.json")) return JSON.stringify({ id: mockRunId, status: "done", exit_code: 0 });
            if (p.endsWith("index.json")) return JSON.stringify({ run_id: mockRunId, steps: [] });
            return "";
        });

        const view = buildStatusView(mockRunDir); // Use defaultDeps
        expect(view?.overall).toBe("finished_success");

        vi.restoreAllMocks();
    });
});

describe("renderStatusView (unit)", () => {
    const baseView: NormalizedStatus = {
        run_id: "test-run",
        overall: "in_progress",
        artifacts_valid: true,
        errors: [],
        steps: [],
        current_state: {
            is_blocked: false,
            blocked_reason: null,
            blocked_step_id: null,
            next_action: "none",
            required_inputs: [],
            paths: [],
        },
    };

    it("renders basic info", () => {
        const output = renderStatusView(baseView);
        expect(output).toContain("Run: test-run");
        expect(output).toContain("Overall: IN_PROGRESS");
        expect(output).toContain("Blocking: UNBLOCKED");
    });

    it("renders blocked state details", () => {
        const blockedView: NormalizedStatus = {
            ...baseView,
            current_state: {
                ...baseView.current_state,
                is_blocked: true,
                blocked_step_id: "step-X",
                blocked_reason: "waiting",
                next_action: "provide_inputs",
                required_inputs: ["input1"],
                paths: ["doc.md"]
            }
        };
        const output = renderStatusView(blockedView);
        expect(output).toContain("Blocking: BLOCKED");
        expect(output).toContain("Blocked step: step-X");
        expect(output).toContain("Reason: waiting");
        expect(output).toContain("Required inputs:");
        expect(output).toContain("- input1");
        expect(output).toContain("Relevant files:");
        expect(output).toContain("- doc.md");
    });

    it("renders errors if present", () => {
        const errorView: NormalizedStatus = {
            ...baseView,
            overall: "invalid",
            artifacts_valid: false,
            errors: ["File not found"],
        };
        const output = renderStatusView(errorView);
        expect(output).toContain("Errors:");
        expect(output).toContain("- File not found");
    });

    it("renders step table", () => {
        const stepView: NormalizedStatus = {
            ...baseView,
            steps: [
                {
                    step_index: 0,
                    step_id: "step-1",
                    agent_name: "agentA",
                    status: "done",
                    decision_action: "continue",
                    duration_ms: 100
                }
            ]
        };
        const output = renderStatusView(stepView);
        expect(output).toContain("0   agentA          done         continue    -                    100");
    });
});
