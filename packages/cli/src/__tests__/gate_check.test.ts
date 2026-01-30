import { describe, expect, it, vi } from "vitest";
import path from "path";
import { detectGate, type GateCheckDeps } from "../gate_check.ts";

function createMockDeps(files: Record<string, string> = {}): GateCheckDeps {
    return {
        fs: {
            existsSync: (p: string) => Object.prototype.hasOwnProperty.call(files, p),
            statSync: (p: string) => ({ isFile: () => true } as any),
            readFileSync: (p: string) => files[p] || "",
        },
    };
}

describe("detectGate", () => {
    const mockRunDir = path.join("/", "mock", "run");

    it("returns null if steps/index.json is missing", () => {
        const deps = createMockDeps({});
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("returns null if no steps are blocked", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({ steps: [] }),
        };
        const deps = createMockDeps(files);
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("returns gate info for require_human", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                run_id: "test-run",
                steps: [
                    { step_index: 0, step_id: "s1", decision_action: "require_human", agent_name: "a1" },
                ],
            }),
            [path.join(mockRunDir, "steps", "s1", "human_prompt.md")]: "prompt",
            [path.join(mockRunDir, "steps", "s1", "decision_after_step.json")]: "{}",
            [path.join(mockRunDir, "steps", "s1", "effective_decision.json")]: "{}",
            // override.json must NOT exist for gate to be detected
        };
        const deps = createMockDeps(files);
        const info = detectGate(mockRunDir, deps);

        expect(info).not.toBeNull();
        expect(info?.step_id).toBe("s1");
        expect(info?.decision_action).toBe("require_human");
        expect(info?.human_prompt).toContain("human_prompt.md");
    });

    it("returns null if override exists in outputs", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                steps: [{ step_index: 0, step_id: "s1", decision_action: "require_human" }]
            }),
            [path.join(mockRunDir, "outputs", "s1", "override.json")]: "{}",
        };
        const deps = createMockDeps(files);
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("returns null if override exists in step dir", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                steps: [{ step_index: 0, step_id: "s1", decision_action: "require_human" }]
            }),
            [path.join(mockRunDir, "steps", "s1", "override.json")]: "{}",
        };
        const deps = createMockDeps(files);
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("returns null if index.json is corrupt", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: "{ invalid json",
        };
        const deps = createMockDeps(files);
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("uses default deps (coverage)", () => {
        const result = detectGate("/non-existent/path");
        expect(result).toBeNull();
    });

    it("handles missing run_id and required_inputs", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                steps: [
                    { step_index: 0, step_id: "s1", decision_action: "require_human", agent_name: "a1" }
                ],
            }),
            [path.join(mockRunDir, "steps", "s1", "human_prompt.md")]: "prompt",
        };
        const deps = createMockDeps(files);
        const info = detectGate(mockRunDir, deps);
        expect(info?.run_id).toBe("run");
        expect(info?.required_inputs).toEqual([]);
    });

    it("handles malformed steps array", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                steps: "not-an-array"
            }),
        };
        const deps = createMockDeps(files);
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("returns explicit required_inputs from blocked step", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                steps: [
                    {
                        step_index: 0,
                        step_id: "s1",
                        decision_action: "require_human",
                        required_inputs: ["foo", "bar"]
                    }
                ],
            }),
            [path.join(mockRunDir, "steps", "s1", "human_prompt.md")]: "prompt",
        };
        const deps = createMockDeps(files);
        const info = detectGate(mockRunDir, deps);
        expect(info?.required_inputs).toEqual(["foo", "bar"]);
    });

    it("fully exercises defaultDeps via fs mock", () => {
        // This test validates the defaultDeps lambdas (existsSync, statSync, readFileSync)
        // We simulate a basic blocked scenario using real fs calls (which are mocked by vitest if we choose, or we mock fs methods)
        // Here we mock fs methods on the fs module itself, so defaultDeps (which imports fs) calls our mocks.
        const fs = require("fs");
        vi.spyOn(fs, "existsSync").mockImplementation((p: any) => {
            if (p.toString().includes("override.json")) return false;
            return true;
        });
        vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true });
        vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({
            steps: [
                { step_index: 0, step_id: "s1", decision_action: "require_human", required_inputs: [] }
            ]
        }));

        // Call WITHOUT deps to trigger defaultDeps
        const info = detectGate(mockRunDir);
        expect(info?.decision_action).toBe("require_human");

        vi.restoreAllMocks(); // Cleanup
    });
});
