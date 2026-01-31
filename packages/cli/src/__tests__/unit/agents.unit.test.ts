import fs from "fs";
import path from "path";
import { describe, it, expect, vi, afterEach } from "vitest";
import * as agents from "../../agents";
import * as stepPersistence from "../../step_persistence";

describe("agents helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes statuses to canonical buckets", () => {
    expect(agents.normalizeStatusLocal("SKIPPED")).toBe("skipped");
    expect(agents.normalizeStatusLocal("running")).toBe("running");
    expect(agents.normalizeStatusLocal("unknown")).toBe("pending");
  });

  it("builds skip reasons with fallback messaging", () => {
    const reason = agents.buildSkipReason("dry_run", "");
    expect(reason.code).toBe("dry_run");
    expect(reason.message).toContain("Skipped");
  });

  it("derives dry run skip reason", () => {
    const step = { last_error: "boom" } as any;
    const result = agents.deriveSkipReason({ step, mode: "dry-run" });
    expect(result.code).toBe("dry_run");
    expect(result.message).toContain("boom");
  });

  it("normalizes dependencies via mapping", () => {
    const run = { planner: "planner", coordinator: "coordinator" };
    const result = agents.normalizeDepends(["planner", "coordinator"], run);
    expect(result).toEqual(["planner", "coordinator"]);
    expect(() => agents.normalizeDepends(["unknown"], run)).toThrow(/Unknown dependency/);
  });

  it("checks dependency status against filesystem", () => {
    const normalizeFilePath = (value: string | Buffer | URL) => value.toString().split(path.sep).join("/");
    const resultPath = normalizeFilePath(path.join("runs", "run-1", "outputs", "planner", "result.json"));
    const files: Record<string, string> = {
      [resultPath]: JSON.stringify({ status: "done" }),
    };
    vi.spyOn(fs, "existsSync").mockImplementation((p) => Boolean(files[normalizeFilePath(p.toString())]));
    vi.spyOn(fs, "statSync").mockImplementation(() => ({ isFile: () => true } as any));
    vi.spyOn(fs, "readFileSync").mockImplementation((p) => files[normalizeFilePath(p.toString())] ?? "null");
    const status = agents.readDependencyStatus("planner", "runs/run-1");
    expect(status.ok).toBe(true);
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("bad");
    });
    const errorStatus = agents.readDependencyStatus("planner", "runs/run-1");
    expect(errorStatus.ok).toBe(false);
  });

  it("throws when dependencies not ready", () => {
    const stub = vi.spyOn(agents, "readDependencyStatus").mockReturnValue({ ok: false, message: "blocked" });
    expect(() =>
      agents.ensureDependencies({ depends_on: ["planner"] } as any, "run", { planner: "planner" })
    ).toThrow(/Dependencies not satisfied/);
    stub.mockRestore();
  });

  it("ensures skipped artifacts are written", () => {
    const spy = vi.spyOn(stepPersistence, "writeSkippedStepArtifacts").mockImplementation(() => {});
    const plan = {
      steps: [
        { id: "step-1", agent: "planner", status: "skipped", last_error: null },
        { id: "step-2", agent: "coordinator", status: "done" },
      ],
    } as any;
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    agents.ensureSkippedArtifactsForPlan("run-1", plan, "dry-run");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
