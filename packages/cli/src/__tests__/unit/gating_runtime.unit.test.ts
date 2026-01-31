import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGatingRuntime } from "../../gating_runtime";
import * as persistence from "../../step_persistence";
import type { DecisionAfterStep, StepResult, StepOverride } from "../../../../contracts/src/index";
import type { GateOutcome, GatingPolicy, Strictness } from "../../../../core/src/policy/gating";

const normalizePath = (value: string | Buffer | URL) => value.toString().split(path.sep).join("/");

const makeFakeDeps = () => {
  const files: Record<string, string> = {};
  const fsOps = {
    existsSync: (filePath: any) => normalizePath(filePath) in files,
    statSync: (filePath: any) => ({ isFile: () => normalizePath(filePath) in files }),
    readFileSync: (filePath: any) => {
      const normalized = normalizePath(filePath);
      if (!(normalized in files)) throw new Error("missing");
      return files[normalized];
    },
  };
  const deps = {
    fs: fsOps as any,
    env: {} as Record<string, string | undefined>,
    cwd: () => "/repo",
  };
  return { deps, files, fsOps };
};

describe("gating runtime helpers", () => {
  let context: ReturnType<typeof makeFakeDeps>;

  beforeEach(() => {
    context = makeFakeDeps();
  });

  it("returns the default policy when the file is missing", () => {
    const runtime = createGatingRuntime(context.deps);
    const policy = runtime.loadGatingPolicy();
    expect(policy.system_default.strictness).toBe("soft");
    expect(policy.schema_version).toBe("gating-policy.v1");
  });

  it("loads policy from the config directory", () => {
    const policyPath = normalizePath(path.join(context.deps.cwd(), "config", "gating_policy.json"));
    context.files[policyPath] = JSON.stringify({
      schema_version: "gating-policy.v1" as const,
      system_default: { strictness: "hard" as Strictness },
      pipelines: { myPipeline: { strictness: "soft" as Strictness } },
    });
    const runtime = createGatingRuntime(context.deps);
    const policy = runtime.loadGatingPolicy();
    expect(policy.system_default.strictness).toBe("hard");
    expect(policy.pipelines?.myPipeline?.strictness).toBe("soft");
  });

  it("honors GATING_POLICY_PATH overrides and falls back on invalid data", () => {
    const overridePath = "/tmp/custom-policy.json";
    context.deps.env.GATING_POLICY_PATH = overridePath;
    context.files[normalizePath(overridePath)] = "not-json";
    const runtime = createGatingRuntime(context.deps);
    const policy = runtime.loadGatingPolicy();
    expect(policy.system_default.strictness).toBe("soft");
  });

  it("returns default policy when file read throws", () => {
    const overridePath = "/tmp/custom-policy.json";
    context.deps.env.GATING_POLICY_PATH = overridePath;
    context.files[normalizePath(overridePath)] = JSON.stringify({ schema_version: "gating-policy.v1", system_default: { strictness: "hard" } });
    const runtime = createGatingRuntime({
      ...context.deps,
      fs: {
        ...context.deps.fs,
        readFileSync: () => {
          throw new Error("boom");
        },
      },
    });
    const policy = runtime.loadGatingPolicy();
    expect(policy.system_default.strictness).toBe("soft");
    expect(policy.system_default.strictness).toBe("soft");
  });

  it("handles broken json in readOverride", () => {
    const runtime = createGatingRuntime(context.deps);
    const stepPath = normalizePath(path.join("runs", "run-1", "steps", "step-1", "override.json"));
    context.files[stepPath] = "not-json";
    expect(runtime.readOverride("run-1", "step-1")).toBeNull();
  });

  it("skips overrides that mismatch run/step", () => {
    const runtime = createGatingRuntime(context.deps);
    context.files[normalizePath(path.join("runs", "run-1", "steps", "step-1", "override.json"))] = JSON.stringify({
      schema_version: "step-override.v1",
      run_id: "other",
      step_id: "step-1",
    });
    expect(runtime.readOverride("run-1", "step-1")).toBeNull();
  });

  it("derives strictness from the policy hierarchy", () => {
    const runtime = createGatingRuntime(context.deps);
    const policy = {
      schema_version: "gating-policy.v1",
      system_default: { strictness: "soft" as Strictness },
      pipelines: { special: { strictness: "hard" as Strictness } },
      agents: { planner: { strictness: "hard" as Strictness } },
      steps: { stepA: { strictness: "soft" as Strictness } },
    } as unknown as GatingPolicy;
    expect(runtime.determineStrictness(policy, { pipeline_id: "special" })).toBe("hard");
    expect(runtime.determineStrictness(policy, { agent_name: "planner" })).toBe("hard");
    expect(runtime.determineStrictness(policy, { step_id: "stepA" })).toBe("soft");
    expect(runtime.determineStrictness(policy, {})).toBe("soft");
  });

  it("evaluates gating outcomes based on validation results", () => {
    const runtime = createGatingRuntime(context.deps);
    const hardFailResult = runtime.evaluateStepGates(
      { validation: { hard_checks: [{ id: "hc", ok: false }], soft_checks: [] } } as unknown as StepResult,
      "hard"
    );
    expect(hardFailResult.gate_status).toBe("hard_fail");

    const softFailResult = runtime.evaluateStepGates(
      { validation: { hard_checks: [], soft_checks: [{ id: "sc", ok: false }] } } as unknown as StepResult,
      "soft"
    );
    expect(softFailResult.gate_status).toBe("soft_fail");

    const passResult = runtime.evaluateStepGates(
      { validation: { hard_checks: [], soft_checks: [] } } as unknown as StepResult,
      "soft"
    );
    expect(passResult.gate_status).toBe("pass");
  });

  it("reads overrides from the step or outputs directories", () => {
    const runtime = createGatingRuntime(context.deps);
    const overridePayload = {
      schema_version: "step-override.v1" as const,
      run_id: "run-1",
      step_id: "step-1",
      actor: { type: "user", id: "u" },
      override_action: "halt",
      routing_override: { next_agent: null, next_model: null },
      acknowledged_risks: [],
    } as StepOverride;
    const stepPath = normalizePath(path.join("runs", "run-1", "steps", "step-1", "override.json"));
    context.files[stepPath] = JSON.stringify(overridePayload);
    const found = runtime.readOverride("run-1", "step-1");
    expect(found).toEqual(overridePayload);
  });

  it("skips overrides that do not match schema or run info", () => {
    const runtime = createGatingRuntime(context.deps);
    context.files[normalizePath(path.join("runs", "run-1", "steps", "step-1", "override.json"))] = JSON.stringify({
      schema_version: "wrong" as any,
      run_id: "run-1",
      step_id: "step-1",
    });
    expect(runtime.readOverride("run-1", "step-1")).toBeNull();
  });

  it("applies overrides only when valid", () => {
    const runtime = createGatingRuntime(context.deps);
    const baseDecision: DecisionAfterStep = {
      schema_version: "decision-after-step.v1" as const,
      run_id: "run-1",
      step_id: "step-1",
      decided_at: new Date().toISOString(),
      decision: { action: "require_human", reason: "awaiting" },
      routing: { next_agent: null, next_model: null },
      requirements: { required_inputs: [], human_prompt_ref: null },
      constraints: { immutable_context: true, engine_smartness: "none" },
      audit: { policy_ids: [], rule_ids: [] },
    };
    const override = {
      schema_version: "step-override.v1" as const,
      run_id: "run-1",
      step_id: "step-1",
      actor: { type: "user", id: "u" },
      override_action: "halt",
      routing_override: { next_agent: "planner", next_model: null },
      acknowledged_risks: [],
    } as StepOverride;
    const gateOutcome: GateOutcome = { gate_status: "pass", hard_failed_ids: [], soft_failed_ids: [], notes: [] };
    const applied = runtime.applyOverride({ baseDecision, override, gateOutcome });
    expect(applied.decision.action).toBe("halt");
    expect(applied.routing.next_agent).toBe("planner");
    const hardFailOutcome: GateOutcome = { gate_status: "hard_fail", hard_failed_ids: [], soft_failed_ids: [], notes: [] };
    const continueOverride = { ...override, override_action: "continue" };
    expect(runtime.applyOverride({ baseDecision, override: continueOverride, gateOutcome: hardFailOutcome })).toEqual(baseDecision);
    const invalidBase = { ...baseDecision, decision: { action: "continue", reason: "ok" } } as DecisionAfterStep;
    expect(runtime.applyOverride({ baseDecision: invalidBase, override, gateOutcome })).toEqual(invalidBase);
  });

  it("writes effective decisions via persistence", () => {
    const runtime = createGatingRuntime(context.deps);
    const spy = vi.spyOn(persistence, "writeJsonAtomic").mockImplementation(() => undefined);
    const decision: DecisionAfterStep = {
      schema_version: "decision-after-step.v1" as const,
      run_id: "run-1",
      step_id: "step-1",
      decided_at: new Date().toISOString(),
      decision: { action: "halt", reason: "reason" },
      routing: { next_agent: null, next_model: null },
      requirements: { required_inputs: [], human_prompt_ref: null },
      constraints: { immutable_context: true, engine_smartness: "none" },
      audit: { policy_ids: [], rule_ids: [] },
    } as unknown as DecisionAfterStep;
    runtime.writeEffectiveDecision("run-1", "step-1", decision);
    const [writtenPath, payload] = spy.mock.calls[0];
    expect(normalizePath(writtenPath)).toBe(
      normalizePath(path.join("runs", "run-1", "steps", "step-1", "effective_decision.json"))
    );
    expect(payload).toEqual(decision);
    spy.mockRestore();
  });
});
