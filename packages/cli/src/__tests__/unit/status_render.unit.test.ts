import { describe, it, expect } from "vitest";
import { NormalizedStatus, buildStatusView, readStepsIndex } from "../../status_view";
import { renderStatusView } from "../../status_render";
import path from "path";

describe("status render helpers", () => {
  it("renders a blocked state with errors and metadata", () => {
    const view: NormalizedStatus = {
      run_id: "run-123",
      overall: "finished_failure",
      artifacts_valid: false,
      errors: ["INVALID_JSON run.json"],
      steps: [
        {
          step_index: 0,
          step_id: "step-0",
          agent_name: "planner",
          status: "failed",
          decision_action: "continue",
          model: "llm/unknown",
          duration_ms: 123,
        },
      ],
      current_state: {
        is_blocked: true,
        blocked_reason: "step failed: step-0",
        blocked_step_id: "step-0",
        next_action: "inspect_artifacts",
        required_inputs: ["inputs/context.md"],
        paths: ["steps/step-0/decision_after_step.json"],
      },
    };

    const rendered = renderStatusView(view, "LOCKED");
    expect(rendered).toContain("Run: run-123");
    expect(rendered).toContain("LOCKED");
    expect(rendered).toContain("Artifacts: INVALID");
    expect(rendered).toContain("Blocked step: step-0");
    expect(rendered).toContain("- inputs/context.md");
  });

  it("renders unlocked success without blocked details", () => {
    const view: NormalizedStatus = {
      run_id: "run-234",
      overall: "finished_success",
      artifacts_valid: true,
      errors: [],
      steps: [
        { step_index: 0, step_id: "s0", agent_name: "a", status: "done", decision_action: "continue", model: "m", duration_ms: 1 },
      ],
      current_state: {
        is_blocked: false,
        blocked_reason: null,
        blocked_step_id: null,
        next_action: "none",
        required_inputs: [],
        paths: [],
      },
    };
    const rendered = renderStatusView(view, null);
    expect(rendered).toContain("Artifacts: VALID");
    expect(rendered).toContain("UNBLOCKED");
    expect(rendered).not.toContain("Errors:");
    expect(rendered).not.toContain("Blocked step");
  });
});

describe("status_view helpers", () => {
  const runDir = "runs/run-123";
  const join = (...pieces: string[]) => path.join(runDir, ...pieces);

  function fakeDeps(files: Record<string, string>) {
    return {
      fs: {
        existsSync: (p: string) => p in files,
        statSync: (p: string) => ({
          isFile: () => Boolean(files[p]),
        }),
        readFileSync: (p: string) => {
          if (!(p in files)) throw new Error(`Missing ${p}`);
          return files[p];
        },
      },
    };
  }

  it("builds a normalized status when run artifacts exist", () => {
    const files: Record<string, string> = {};
    files[join("run.json")] = JSON.stringify({ run_id: "run-123", status: "done", exit_code: 0 });
    files[join("steps", "index.json")] = JSON.stringify({
      schema_version: "steps-index.v1",
      run_id: "run-123",
      updated_at: "now",
      steps: [
        {
          step_id: "step-0",
          step_index: 0,
          agent_name: "planner",
          status: "done",
          decision_action: "continue",
          model: "llm/unknown",
          duration_ms: 100,
        },
      ],
    });
    files[join("steps", "step-0", "decision_after_step.json")] = JSON.stringify({
      decision: { action: "continue", reason: "ok" },
    });
    files[join("steps", "step-0", "human_prompt.md")] = "prompt";
    files[join("steps", "step-0", "step_result.json")] = "{}";

    const view = buildStatusView(runDir, fakeDeps(files));
    expect(view).not.toBeNull();
    expect(view?.overall).toBe("finished_success");
    expect(view?.steps).toHaveLength(1);
    expect(view?.current_state.is_blocked).toBe(false);
  });

  it("returns null when index is missing", () => {
    const files: Record<string, string> = {
      [join("run.json")]: JSON.stringify({ run_id: "run-123", status: "in_progress" }),
    };
    const view = buildStatusView(runDir, fakeDeps(files));
    expect(view).not.toBeNull();
    expect(view?.errors).toContain("MISSING steps/index.json");
  });

  it("reads steps index when present", () => {
    const files: Record<string, string> = {};
    files[join("steps", "index.json")] = JSON.stringify({
      schema_version: "steps-index.v1",
      run_id: "run-123",
      updated_at: "now",
      steps: [],
    });
    const index = readStepsIndex(runDir, fakeDeps(files));
    expect(index).not.toBeNull();
    expect(index?.steps).toHaveLength(0);
  });
});
