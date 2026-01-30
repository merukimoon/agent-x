import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import { createStepPersistence, type StepPersistenceDeps } from "../../step_persistence.ts";
import type { DecisionAfterStep, SkipReason, StepResult } from "../../../../../contracts/src/index.ts";

describe("step_persistence", () => {
    describe("readJson", () => {
        it("should return null if file does not exist", () => {
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => false,
                },
            });

            const result = persistence.readJson("/nonexistent.json");
            expect(result).toBeNull();
        });

        it("should return null if path exists but is not a file", () => {
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => false } as any),
                },
            });

            const result = persistence.readJson("/is-directory");
            expect(result).toBeNull();
        });

        it("should return null if JSON parsing fails", () => {
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: () => "{ invalid json",
                },
            });

            const result = persistence.readJson("/bad.json");
            expect(result).toBeNull();
        });

        it("should return parsed JSON when file is valid", () => {
            const expected = { foo: "bar", num: 42 };
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: () => JSON.stringify(expected),
                },
            });

            const result = persistence.readJson("/valid.json");
            expect(result).toEqual(expected);
        });
    });

    describe("writeJsonAtomic", () => {
        it("should handle fsync EPERM error gracefully", () => {
            const writtenFiles: string[] = [];
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    writeFileSync: (path, data) => {
                        writtenFiles.push(path as string);
                    },
                    openSync: () => 3,
                    fsyncSync: () => {
                        const err: any = new Error("fsync failed");
                        err.code = "EPERM";
                        throw err;
                    },
                    closeSync: () => { },
                    renameSync: () => { },
                },
            });

            // Should not throw
            persistence.writeJsonAtomic("/test.json", { data: "test" });
            expect(writtenFiles.length).toBeGreaterThan(0);
        });

        it("should handle fsync EINVAL error gracefully", () => {
            const writtenFiles: string[] = [];
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    writeFileSync: (path, data) => {
                        writtenFiles.push(path as string);
                    },
                    openSync: () => 3,
                    fsyncSync: () => {
                        const err: any = new Error("fsync failed");
                        err.code = "EINVAL";
                        throw err;
                    },
                    closeSync: () => { },
                    renameSync: () => { },
                },
            });

            // Should not throw
            persistence.writeJsonAtomic("/test.json", { data: "test" });
            expect(writtenFiles.length).toBeGreaterThan(0);
        });

        it("should handle fsync EACCES error gracefully", () => {
            const writtenFiles: string[] = [];
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    writeFileSync: (path, data) => {
                        writtenFiles.push(path as string);
                    },
                    openSync: () => 3,
                    fsyncSync: () => {
                        const err: any = new Error("fsync failed");
                        err.code = "EACCES";
                        throw err;
                    },
                    closeSync: () => { },
                    renameSync: () => { },
                },
            });

            // Should not throw
            persistence.writeJsonAtomic("/test.json", { data: "test" });
            expect(writtenFiles.length).toBeGreaterThan(0);
        });

        it("should rethrow fsync error if code is not EPERM/EINVAL/EACCES", () => {
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    writeFileSync: () => { },
                    openSync: () => 3,
                    fsyncSync: () => {
                        const err: any = new Error("fsync failed");
                        err.code = "EIO";
                        throw err;
                    },
                    closeSync: () => { },
                    renameSync: () => { },
                },
            });

            expect(() => {
                persistence.writeJsonAtomic("/test.json", { data: "test" });
            }).toThrow("fsync failed");
        });

        it("should close fd even when closeSync throws", () => {
            let closeCalled = false;
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    writeFileSync: () => { },
                    openSync: () => 3,
                    fsyncSync: () => { },
                    closeSync: () => {
                        closeCalled = true;
                        throw new Error("close failed");
                    },
                    renameSync: () => { },
                },
            });

            // Should not throw even though close failed
            persistence.writeJsonAtomic("/test.json", { data: "test" });
            expect(closeCalled).toBe(true);
        });

        it("should not attempt to close if fd is -1", () => {
            let closeCalled = false;
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    writeFileSync: () => { },
                    openSync: () => {
                        throw new Error("open failed");
                    },
                    fsyncSync: () => { },
                    closeSync: () => {
                        closeCalled = true;
                    },
                    renameSync: () => { },
                },
            });

            expect(() => {
                persistence.writeJsonAtomic("/test.json", { data: "test" });
            }).toThrow("open failed");
            expect(closeCalled).toBe(false);
        });

        it("should use deterministic temp file name with pid and timestamp", () => {
            let tempPath = "";
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    writeFileSync: (path, data) => {
                        if ((path as string).includes(".tmp.")) {
                            tempPath = path as string;
                        }
                    },
                    openSync: () => -1, // Skip fd operations
                    renameSync: () => { },
                },
                process: { pid: 12345 },
                now: () => 1234567890,
            });

            persistence.writeJsonAtomic("/output/test.json", { data: "test" });
            expect(tempPath).toContain("test.json.tmp.12345.1234567890");
        });
    });

    describe("updateStepsIndex", () => {
        it("should handle missing existing index (null case)", () => {
            let writtenData: any = null;
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => false,
                    writeFileSync: (path, data) => {
                        writtenData = JSON.parse(data as string);
                    },
                    openSync: () => -1,
                    renameSync: () => { },
                },
            });

            persistence.updateStepsIndex({
                runId: "run-123",
                entry: {
                    step_id: "step-1",
                    step_index: 0,
                    agent_name: "planner",
                    status: "ok",
                    decision_action: "continue",
                },
            });

            expect(writtenData).toBeTruthy();
            expect(writtenData.steps.length).toBe(1);
            expect(writtenData.steps[0].step_id).toBe("step-1");
        });

        it("should filter out existing entry with same step_id", () => {
            let writtenData: any = null;
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: () => JSON.stringify({
                        schema_version: "steps-index.v1",
                        run_id: "run-123",
                        updated_at: "2020-01-01T00:00:00Z",
                        steps: [
                            {
                                step_id: "step-1",
                                step_index: 0,
                                agent_name: "planner",
                                status: "ok",
                                decision_action: "continue",
                            },
                        ],
                    }),
                    writeFileSync: (path, data) => {
                        // Capture data from temp file (will be renamed)
                        writtenData = JSON.parse(data as string);
                    },
                    openSync: () => -1,
                    renameSync: (from, to) => {
                        // Simulate rename
                    },
                },
            });

            persistence.updateStepsIndex({
                runId: "run-123",
                entry: {
                    step_id: "step-1",
                    step_index: 0,
                    agent_name: "planner",
                    status: "ok",
                    decision_action: "halt",
                    duration_ms: 500,
                },
            });

            expect(writtenData.steps.length).toBe(1);
            expect(writtenData.steps[0].decision_action).toBe("halt");
            expect(writtenData.steps[0].duration_ms).toBe(500);
        });

        it("should sort steps by step_index", () => {
            let writtenData: any = null;
            const persistence = createStepPersistence({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: () => JSON.stringify({
                        schema_version: "steps-index.v1",
                        run_id: "run-123",
                        updated_at: "2020-01-01T00:00:00Z",
                        steps: [
                            { step_id: "step-2", step_index: 1, agent_name: "executor", status: "ok", decision_action: "continue" },
                        ],
                    }),
                    writeFileSync: (path, data) => {
                        // Capture data from temp file (will be renamed)
                        writtenData = JSON.parse(data as string);
                    },
                    openSync: () => -1,
                    renameSync: () => { },
                },
            });

            persistence.updateStepsIndex({
                runId: "run-123",
                entry: {
                    step_id: "step-1",
                    step_index: 0,
                    agent_name: "planner",
                    status: "ok",
                    decision_action: "continue",
                },
            });

            expect(writtenData.steps.length).toBe(2);
            expect(writtenData.steps[0].step_id).toBe("step-1");
            expect(writtenData.steps[1].step_id).toBe("step-2");
        });
    });
});

describe("writeSkippedStepArtifacts integration", () => {
    it("emits all outputs for skipped steps", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "step-persist-skip-"));
        const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
        const runId = "skip-run";
        const stepId = "step-3";
        const outputsDir = path.join("runs", runId, "outputs", "decision-maker");
        const persistence = createStepPersistence({
            now: () => 1700000000000,
            process: { pid: 999 },
        });

        const reason: SkipReason = {
            code: "not_applicable",
            message: "Dependency not ready",
            at_utc: new Date().toISOString(),
        };

        try {
            persistence.writeSkippedStepArtifacts({
                runId,
                stepId,
                stepIndex: 2,
                agentName: "decision-maker",
                reason,
                outputsDir,
                mode: "dry-run",
            });

            const resultPath = path.join(outputsDir, "result.json");
            const statusPath = path.join(outputsDir, "status.json");
            const notesPath = path.join(outputsDir, "notes.md");
            const stepDir = path.join("runs", runId, "steps", stepId);
            const indexPath = path.join("runs", runId, "steps", "index.json");
            const stepResultPath = path.join(stepDir, "step_result.json");
            const decisionPath = path.join(stepDir, "decision_after_step.json");
            const effectivePath = path.join(stepDir, "effective_decision.json");

            expect(fs.existsSync(resultPath)).toBe(true);
            expect(fs.existsSync(statusPath)).toBe(true);
            expect(fs.existsSync(notesPath)).toBe(true);
            expect(fs.existsSync(stepResultPath)).toBe(true);
            expect(fs.existsSync(decisionPath)).toBe(true);
            expect(fs.existsSync(effectivePath)).toBe(true);
            expect(fs.existsSync(indexPath)).toBe(true);

            const resultData = JSON.parse(fs.readFileSync(resultPath, "utf8"));
            expect(resultData.status).toBe("skipped");
            expect(resultData.reason.code).toBe(reason.code);

            const statusData = JSON.parse(fs.readFileSync(statusPath, "utf8"));
            expect(statusData.reason.message).toBe(reason.message);

            const indexData = JSON.parse(fs.readFileSync(indexPath, "utf8"));
            expect(indexData.steps.some((entry: any) => entry.step_id === stepId)).toBe(true);
        } finally {
            cwdSpy.mockRestore();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});

// Helper to create default mock fs
function defaultFsMock(): StepPersistenceDeps["fs"] {
    return {
        mkdirSync: () => { },
        writeFileSync: () => { },
        readFileSync: () => "{}",
        existsSync: () => true,
        statSync: () => ({ isFile: () => true } as any),
        openSync: () => 3,
        fsyncSync: () => { },
        closeSync: () => { },
        renameSync: () => { },
    };
}
