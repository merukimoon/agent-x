import { describe, expect, it } from "vitest";
import { normalizeDepends } from "../../../cli/src/agents";
import { runFlow } from "../../../cli/src/cli";
import fs from "fs";
import os from "os";
import path from "path";

describe("normalizeDepends", () => {
  it("maps agent names to step ids", () => {
    const agentToId = { planner: "planner", coordinator: "coordinator", "decision-maker": "step-1" };
    const out = normalizeDepends(["coordinator", "decision-maker"], agentToId);
    expect(out).toEqual(["coordinator", "step-1"]);
  });

  it("throws on unknown dependency", () => {
    const agentToId = { planner: "planner" };
    expect(() => normalizeDepends(["missing"], agentToId)).toThrow(/Unknown dependency/);
  });
});

describe("plan dependency validation", () => {
  it("fails when depends_on references unknown id", () => {
    const runId = `bad-deps-${Date.now()}`;
    const runDir = path.join(process.cwd(), "runs", runId);
    fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "req", "utf8");
    fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "ctx", "utf8");
    const plan = {
      run_id: runId,
      created_at_utc: new Date().toISOString(),
      version: "0.1",
      flow_type: "test",
      rationale: "",
      signals: [],
      confidence: "low",
      steps: [
        {
          id: "step-1",
          agent: "decision-maker",
          depends_on: ["not-a-step"],
          inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
          outputs: { result: "outputs/decision-maker/result.json", notes: "outputs/decision-maker/notes.md" },
          status: "pending",
          attempt: 0,
          max_attempts: 1,
          last_error: null,
          allow_skip: true,
        },
      ],
    };
    fs.writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan, null, 2), "utf8");
    expect(() => runFlow(runId, "dry-run")).toThrow(/Validation failed/);
  });
});
