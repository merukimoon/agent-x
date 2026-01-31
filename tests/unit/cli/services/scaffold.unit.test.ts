
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { ScaffoldService } from "../../../../packages/cli/src/services/scaffold.ts";

describe("ScaffoldService", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scaffold-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates run structure with generated ID", () => {
        const runDir = ScaffoldService.createRun({ name: "test-run", cwd: tmpDir, log: () => { } });

        expect(fs.existsSync(runDir)).toBe(true);
        expect(fs.existsSync(path.join(runDir, "run.json"))).toBe(true);
        expect(fs.existsSync(path.join(runDir, "README.md"))).toBe(true);
        expect(fs.existsSync(path.join(runDir, "inputs/request.md"))).toBe(true);
        expect(fs.existsSync(path.join(runDir, "inputs/context.md"))).toBe(true);
        expect(fs.existsSync(path.join(runDir, "outputs/coordinator/result.json"))).toBe(true);
        expect(fs.existsSync(path.join(runDir, "summary/final.md"))).toBe(true);
    });

    it("creates run structure with explicit ID", () => {
        const explicitId = "explicit-id-123";
        const runDir = ScaffoldService.createRun({ runId: explicitId, cwd: tmpDir, log: () => { } });

        expect(path.basename(runDir)).toBe(explicitId);
        expect(fs.existsSync(runDir)).toBe(true);
    });

    it("throws if run directory already exists", () => {
        const name = "duplicate-run";
        const runDir = ScaffoldService.createRun({ name, cwd: tmpDir, log: () => { } });

        // Mock timestamp to ensure collision (or just reuse generated ID if deterministic enough, 
        // but easier to try force collision by passing runId)
        const id = path.basename(runDir);

        expect(() => {
            ScaffoldService.createRun({ runId: id, cwd: tmpDir, log: () => { } });
        }).toThrow(/Run already exists/);
    });

    it("fills inputs from content options", () => {
        const goal = "Fix bug #123";
        const context = "Repo is broken";
        const runDir = ScaffoldService.createRun({ name: "inputs-test", cwd: tmpDir, goal, context, log: () => { } });

        const requestContent = fs.readFileSync(path.join(runDir, "inputs/request.md"), "utf-8");
        const contextContent = fs.readFileSync(path.join(runDir, "inputs/context.md"), "utf-8");

        expect(requestContent).toContain(goal);
        expect(contextContent).toContain(context);
    });

    it("throws for invalid name characters", () => {
        expect(() => {
            ScaffoldService.createRun({ name: "bad name!", cwd: tmpDir });
        }).toThrow(/NAME must use only/);
    });

    it("throws if no name or runId provided", () => {
        expect(() => {
            ScaffoldService.createRun({ cwd: tmpDir });
        }).toThrow(/NAME is required/);
    });
});
