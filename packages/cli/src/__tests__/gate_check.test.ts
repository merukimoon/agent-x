import { describe, expect, it } from "vitest";
import path from "path";
import { detectGate, type GateCheckDeps } from "../gate_check.ts";

describe("detectGate (unit)", () => {
    const mockRunId = "gate-run";
    const runDirName = "runs";
    const mockRunDir = path.join(process.cwd(), runDirName, mockRunId);

    function createMockDeps(files: Record<string, string> = {}): GateCheckDeps {
        return {
            fs: {
                existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
                statSync: (p) => ({ isFile: () => true }),
                readFileSync: (p) => files[p],
            },
        };
    }

    it("returns null if index.json missing", () => {
        const deps = createMockDeps({});
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("returns null if no step is blocked", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                steps: [
                    { step_index: 0, decision_action: "continue", step_id: "s1" },
                ],
            }),
        };
        const deps = createMockDeps(files);
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("returns null if override exists", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                steps: [
                    { step_index: 0, decision_action: "require_human", step_id: "s1", agent_name: "a1" },
                ],
            }),
            [path.join(mockRunDir, "steps", "s1", "override.json")]: "{}",
        };
        const deps = createMockDeps(files);
        expect(detectGate(mockRunDir, deps)).toBeNull();
    });

    it("returns gate info if blocked and no override", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                run_id: mockRunId,
                steps: [
                    { step_index: 0, decision_action: "require_human", step_id: "s1", agent_name: "a1", required_inputs: ["i1"] },
                ],
            }),
        };
        const deps = createMockDeps(files);
        const info = detectGate(mockRunDir, deps);

        expect(info).not.toBeNull();
        expect(info?.step_id).toBe("s1");
        expect(info?.decision_action).toBe("require_human");
        expect(info?.required_inputs).toEqual(["i1"]);
        expect(info?.override_path).toContain("override.json");
    });

    it("returns gate info for request_clarification", () => {
        const files = {
            [path.join(mockRunDir, "steps", "index.json")]: JSON.stringify({
                steps: [
                    { step_index: 0, decision_action: "request_clarification", step_id: "s2" },
                ],
            }),
        };
        const deps = createMockDeps(files);
        const info = detectGate(mockRunDir, deps);

        expect(info).not.toBeNull();
        expect(info?.step_id).toBe("s2");
        expect(info?.decision_action).toBe("request_clarification");
    });
});
