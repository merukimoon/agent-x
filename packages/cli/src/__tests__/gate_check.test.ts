import { describe, expect, it } from "vitest";
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
});
