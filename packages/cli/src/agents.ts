import fs from "fs";
import path from "path";
import process from "process";
import { Core, Legacy, Runners } from "./imports.ts";
import type { AgentName, AgentStatus, ExecutionMode, Plan, PlanStep, AgentResult } from "./imports.ts";
import type { DecisionAfterStep, ExecutionStatus, ModelRef, SkipReason, SkipReasonCode, StepResult, StepOverride } from "../../contracts/src/index.ts";
import { writeDecision, writeEffectiveDecision, writeSkippedStepArtifacts, writeStepResult, updateStepsIndex } from "./step_persistence.ts";
import { applyOverride, determineStrictness, evaluateStepGates, loadGatingPolicy, readOverride } from "./gating_runtime.ts";
const { requireExecutableRole } = Core;




/**
 * @typedef {import("./imports.ts").Core.AgentName} AgentName
 * @typedef {import("./imports.ts").Core.AgentStatus} AgentStatus
 * @typedef {import("./imports.ts").Core.ExecutionMode} ExecutionMode
 * @typedef {import("./imports.ts").Core.RunId} RunId
 * @typedef {import("./imports.ts").Core.AgentResult} AgentResult
 * @typedef {import("./imports.ts").Core.PlanStep} PlanStep
 */

export const {
  getCanonicalOutputs,
  validateCanonicalOutputs
} = Core;

export type AgentsDeps = {
  fs: {
    existsSync: typeof fs.existsSync;
    statSync: typeof fs.statSync;
    readFileSync: typeof fs.readFileSync;
    mkdirSync: typeof fs.mkdirSync;
  };
  env: NodeJS.ProcessEnv;
  cwd: () => string;
};

export const defaultAgentsDeps: AgentsDeps = {
  fs: {
    existsSync: (p) => fs.existsSync(p),
    statSync: ((p) => fs.statSync(p)) as typeof fs.statSync,
    readFileSync: ((p, ...args) => fs.readFileSync(p, ...args)) as typeof fs.readFileSync,
    mkdirSync: ((p, ...args) => fs.mkdirSync(p, ...args)) as typeof fs.mkdirSync,
  },
  env: process.env,
  cwd: () => process.cwd(),
};

const ALLOWED_SKIP_REASON_CODES: SkipReasonCode[] = ["dry_run", "not_applicable", "precondition_unmet", "policy_disabled"];

export function normalizeStatusLocal(raw: string | undefined | null) {
  const r = (raw || "").toLowerCase().trim();
  if (r === "skipped") return "skipped";
  if (r === "failed") return "failed";
  if (r === "done" || r === "success" || r === "ok") return "done";
  if (r === "running" || r === "in_progress") return "running";
  if (r === "pending") return "pending";
  return "pending";
}

export function buildSkipReason(code: SkipReasonCode, message: string): SkipReason {
  const safeMessage = message && message.trim().length > 0 ? message.trim() : `Skipped (${code})`;
  return {
    code: ALLOWED_SKIP_REASON_CODES.includes(code) ? code : "policy_disabled",
    message: safeMessage,
    at_utc: new Date().toISOString(),
  };
}

export function deriveSkipReason(params: { step: PlanStep; mode: ExecutionMode }): SkipReason {
  const { step, mode } = params;
  const message = step.last_error || "Skipped by policy";
  const code: SkipReasonCode = mode === "dry-run" ? "dry_run" : "not_applicable";
  return buildSkipReason(code, message);
}

export function ensureSkippedArtifactsForPlan(runId: string, plan: Plan, mode: ExecutionMode, deps: Partial<AgentsDeps> = {}) {
  const resolved = {
    ...defaultAgentsDeps,
    ...deps,
    fs: { ...defaultAgentsDeps.fs, ...(deps.fs ?? {}) },
    env: deps.env ?? defaultAgentsDeps.env,
    cwd: deps.cwd ?? defaultAgentsDeps.cwd,
  } satisfies AgentsDeps;

  plan.steps.forEach((step, idx) => {
    if (normalizeStatusLocal(step.status) !== "skipped") return;
    const outputsDir = path.join(resolved.cwd(), "runs", runId, "outputs", step.agent);
    let reason = deriveSkipReason({ step, mode });
    const statusPath = path.join(outputsDir, "status.json");
    if (resolved.fs.existsSync(statusPath)) {
      try {
        const parsed = JSON.parse(resolved.fs.readFileSync(statusPath, "utf8"));
        if (parsed?.reason?.code && parsed?.reason?.message && ALLOWED_SKIP_REASON_CODES.includes(parsed.reason.code)) {
          const derived = buildSkipReason(parsed.reason.code, parsed.reason.message);
          reason = {
            ...derived,
            at_utc: parsed.reason.at_utc || derived.at_utc,
          };
        }
      } catch {
        // ignore and use derived reason
      }
    }
    writeSkippedStepArtifacts({
      runId,
      stepId: step.id,
      stepIndex: idx,
      agentName: step.agent,
      reason,
      outputsDir,
      mode,
    });
  });
}

export function normalizeDepends(depList: string[], agentToId: Record<string, string>) {
  return depList.map((dep) => {
    if (agentToId[dep]) return agentToId[dep];
    const byId = Object.values(agentToId).find((id) => id === dep);
    if (byId) return dep;
    throw new Error(`Unknown dependency "${dep}"`);
  });
}

/**
 * Read dependency result status.
 * @param {AgentName} agent
 * @param {string} runDir
 * @returns {{ ok: boolean; message: string | null }}
 */
export function readDependencyStatus(agent, runDir, deps: Partial<AgentsDeps> = {}) {
  const resolved = {
    ...defaultAgentsDeps,
    ...deps,
    fs: { ...defaultAgentsDeps.fs, ...(deps.fs ?? {}) },
  } satisfies AgentsDeps;
  const depResult = path.join(runDir, "outputs", agent, "result.json");
  if (!resolved.fs.existsSync(depResult) || !resolved.fs.statSync(depResult).isFile()) {
    return {
      ok: false,
      message: `Dependency result missing for ${agent}: ${depResult}`,
    };
  }
  try {
    const raw = resolved.fs.readFileSync(depResult, "utf8");
    const parsed = JSON.parse(raw);
    const status = parsed?.status;
    if (status !== "done") {
      return {
        ok: false,
        message: `Dependency ${agent} status is ${String(
          status
        )}, expected done.`,
      };
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Dependency ${agent} parse failed: ${reason}` };
  }
  return { ok: true, message: null };
}

/**
 * Validate dependencies are satisfied.
 * @param {PlanStep} step
 * @param {string} runDir
 * @returns {{ ready: boolean; blocking: string | null }}
 */
export function checkDependenciesSatisfied(step, runDir, idToAgent, deps: Partial<AgentsDeps> = {}) {
  for (const dep of step.depends_on) {
    const agent = idToAgent?.[dep] ?? dep;
    const status = readDependencyStatus(agent, runDir, deps);
    if (!status.ok) {
      return { ready: false, blocking: status.message ?? `Dependency ${agent} not ready.` };
    }
  }
  return { ready: true, blocking: null };
}

/**
 * Ensure dependencies are satisfied before running a step.
 * @param {PlanStep} step
 * @param {string} runDir
 */
export function ensureDependencies(step, runDir, idToAgent, deps: Partial<AgentsDeps> = {}) {
  const depsStatus = checkDependenciesSatisfied(step, runDir, idToAgent, deps);
  if (!depsStatus.ready) {
    throw new Error(`Dependencies not satisfied for ${step.id}: ${depsStatus.blocking ?? ""}`.trim());
  }
}

/**
 * Execute an agent, producing notes and result outputs.
 * Coordinator additionally writes plan.json.
 * @param {AgentName} agentName
 * @param {RunId} runId
 * @param {ExecutionMode} mode
 * @param {string | null} [contextOverridePath]
 * @returns {AgentResult}
 */
export async function runAgent(agentName, runId, mode, contextOverridePath = null, deps: Partial<AgentsDeps> = {}) {
  const resolved = {
    ...defaultAgentsDeps,
    ...deps,
    fs: { ...defaultAgentsDeps.fs, ...(deps.fs ?? {}) },
    env: deps.env ?? defaultAgentsDeps.env,
    cwd: deps.cwd ?? defaultAgentsDeps.cwd,
  } satisfies AgentsDeps;
  const runDir = path.join(resolved.cwd(), "runs", runId);
  Legacy.ensureRunAndInputs(runDir);
  const registryEntry = requireExecutableRole(agentName);
  const { stepId, stepIndex, priorOutputs, pipelineId } = resolveStepMeta(runDir, agentName, resolved);
  const startedAt = new Date();
  const modelRef: ModelRef = {
    provider: registryEntry.runner,
    name: "unknown",
    mode,
    temperature: null,
  };
  const initialStepResult: StepResult = {
    schema_version: "step-result.v1",
    run_id: runId,
    step_id: stepId,
    step_index: stepIndex,
    agent_name: agentName,
    model: modelRef,
    timestamps: {
      started_at: startedAt.toISOString(),
      finished_at: startedAt.toISOString(),
      duration_ms: 0,
    },
    inputs: {
      context_ref: "inputs/context.md",
      request_ref: "inputs/request.md",
      artifacts_in: priorOutputs,
    },
    outputs: {
      artifacts_out: [],
      summary_ref: null,
    },
    validation: {
      hard_checks: [],
      soft_checks: [],
    },
    execution: {
      status: "ok",
      error: null,
    },
    signals: {
      matched_keywords: [],
      confidence: null,
    },
    notes: {
      warnings: [],
    },
  };
  writeStepResult(runId, stepId, initialStepResult);

  const requestPath = path.join(runDir, "inputs", "request.md");
  const contextPath = contextOverridePath ? path.resolve(contextOverridePath) : path.join(runDir, "inputs", "context.md");

  const requestExcerpt = Legacy.readFirstLines(requestPath, 20);
  const contextExcerpt = Legacy.readFirstLines(contextPath, 20);
  const createdAtUtc = new Date().toISOString();
  const summary = `${mode === "dry-run" ? "Dry run" : "Run"
    } completed for ${agentName} on run ${runId}.`;
  let resultSummary = summary;
  let targetInfo: any = null;
  if (agentName === "planner") {
    const targetPath = path.join(runDir, "planner_llm_target.json");
    if (resolved.fs.existsSync(targetPath)) {
      try {
        targetInfo = JSON.parse(resolved.fs.readFileSync(targetPath, "utf8"));
      } catch {
        targetInfo = null;
      }
    }
    if (targetInfo?.model) {
      modelRef.name = targetInfo.model;
    }
    if (targetInfo?.provider) {
      modelRef.provider = targetInfo.provider;
    }
  }

  const outputsDir = path.join(runDir, "outputs", agentName);
  resolved.fs.mkdirSync(outputsDir, { recursive: true });

  const resultPath = path.join(outputsDir, "result.json");
  /** @type {AgentStatus} */
  let status: AgentStatus = "done";
  const overrideForGate = readOverride(runId, stepId);
  const gateOverrideMissing = agentName === "human_gate" && !overrideForGate;
  if (agentName === "human_gate" && gateOverrideMissing) {
    status = "blocked";
  }
  /** @type {AgentResult} */
  const result: AgentResult & { provider?: string; model?: string } = {
    agent: agentName,
    run_id: runId,
    status,
    created_at_utc: createdAtUtc,
    summary: gateOverrideMissing ? "Awaiting human override for human_gate" : summary,
    mode,
    provider: targetInfo?.provider ?? undefined,
    model: targetInfo?.model ?? undefined,
  };
  let outputsWritten = false;
  if (agentName === "technical-writer") {
    const runnerOutput = Runners.runTechnicalWriter({
      runId,
      outputsDir,
      requestPath,
      contextPath,
      mode,
    });
    status = runnerOutput.status as AgentStatus;
    resultSummary = runnerOutput.summary;
    result.status = status;
    result.summary = resultSummary;
    outputsWritten = true;
  } else if (agentName === "planner") {
    const goalRaw = Legacy.readFileText(requestPath);
    const contextRaw = Legacy.readFileText(contextPath);
    // Extract goal/context text (simple heuristic, or parse markdown sections if possible)
    // For now, pass raw strings as prompt expects.

    // We need prompt template.
    const promptPath = path.join(resolved.cwd(), "prompts", "planner.md");

    try {
      // 1. Generate
      const { rawText, target } = await Legacy.generatePlanFromLLM(promptPath, goalRaw, contextRaw);
      if (target) {
        targetInfo = target;
        result.provider = target.provider;
        result.model = target.model;
      }

      // 2. Parse & Validate
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      let parsed = null;
      let validation = { valid: false, errors: [] as string[], warnings: [] as string[], parsed: null as any };

      try {
        parsed = JSON.parse(jsonStr);
        validation = Legacy.validatePlannerOutput(parsed, Legacy.CAPABILITIES);
      } catch (e: any) {
        validation.errors.push(`JSON Parse Fail: ${e.message}`);
      }

      // 3. Write artifacts
      Legacy.writeJsonFile(path.join(runDir, "planner_validation.json"), {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      });

      if (!validation.valid) {
        Legacy.writeJsonFile(path.join(runDir, "planner_validation_error.json"), {
          error_type: "validation",
          message: "Planner output failed validation",
          details: validation.errors
        });
        result.status = "failed";
        result.summary = `Planner failed validation: ${validation.errors.length} errors.`;
      } else {
        result.status = "done";
        result.summary = `${mode === "dry-run" ? "Dry run: " : ""}Plan generated and validated.`;
        // Write result.json with the parsed plan
        Legacy.writeJsonFile(resultPath, parsed); // We write the LLM output as result
        outputsWritten = true; // prevent generic write
      }

    } catch (err: any) {
      // Network/LLM error
      Legacy.writeJsonFile(path.join(runDir, "planner_validation_error.json"), {
        error_type: "llm_error",
        message: err.message
      });
      result.status = "failed";
      result.summary = `Planner LLM error: ${err.message}`;
    }
  } else {
    Legacy.writeJsonFile(resultPath, result);
  }

  const notesPath = path.join(outputsDir, "notes.md");
  const gateNote = gateOverrideMissing
    ? [
      `Agent "${agentName}" is blocked until override.json is provided.`,
      "",
      `Create: outputs/${agentName}/override.json`,
      `Inspect prompt: steps/${stepId}/human_prompt.md`,
    ].join("\n")
    : null;
  const notes = gateNote ?? Legacy.buildNotes({
    agentName,
    runId,
    createdAtUtc,
    mode,
    requestPath,
    contextPath,
    requestExcerpt,
    contextExcerpt,
  });
  if (!outputsWritten) {
    Legacy.writeFileAtomic(notesPath, notes);
  }
  const statusPath = path.join(outputsDir, "status.json");
  if (!outputsWritten) {
    Legacy.writeJsonFile(statusPath, {
      agent: agentName,
      run_id: runId,
      status,
      created_at_utc: createdAtUtc,
      mode,
      finished_at_utc: createdAtUtc,
    });
  }

  if (agentName === "coordinator") {
    const planPath = path.join(runDir, "plan.json");
    const requestText = Legacy.readFileText(requestPath);
    const contextText = Legacy.readFileText(contextPath);
    const classification = Legacy.classifyFlow(requestText, contextText);
    /** @type {PlanStep[]} */
    const steps = [];
    const matchedSet = new Set(classification.signals.map((s) => s.replace(/^keyword:/, "")));
    const agentToId: Record<string, string> = {
      planner: "planner",
      coordinator: "coordinator",
    };
    const idToAgent: Record<string, string> = {
      planner: "planner",
      coordinator: "coordinator",
    };
    classification.pack.steps.forEach((stepDef) => {
      agentToId[stepDef.agent] = stepDef.id;
      idToAgent[stepDef.id] = stepDef.agent;
    });

    classification.pack.steps.forEach((stepDef) => {
      const outputs = getCanonicalOutputs(stepDef.agent);
      const mappedDepends = normalizeDepends(stepDef.depends_on, agentToId);
      const priorOutputs = mappedDepends.flatMap((dep) => {
        const depAgent = idToAgent[dep];
        if (!depAgent) {
          throw new Error(`Unknown dependency mapping for ${dep}`);
        }
        const depOutputs = getCanonicalOutputs(depAgent as any);
        return [depOutputs.result, depOutputs.notes];
      });

      let statusForStep = "pending";
      let lastError: string | null = null;
      if (
        Array.isArray(stepDef.enabled_if_keywords) &&
        stepDef.enabled_if_keywords.length > 0
      ) {
        const enabled = stepDef.enabled_if_keywords.some((k) =>
          matchedSet.has(k)
        );
        if (!enabled) {
          statusForStep = "skipped";
          lastError = "Skipped: no security signals";
        }
      }

      steps.push({
        id: stepDef.id,
        agent: stepDef.agent,
        depends_on: mappedDepends,
        inputs: {
          request: "inputs/request.md",
          context: "inputs/context.md",
          prior_outputs: priorOutputs,
        },
        outputs,
        status: statusForStep,
        attempt: 0,
        max_attempts: 1,
        last_error: lastError,
        allow_skip: true,
      });
    });

    // Coordinator explicit step
    const coordOutputs = getCanonicalOutputs("coordinator");
    steps.unshift({
      id: "coordinator",
      agent: "coordinator",
      depends_on: [],
      inputs: {
        request: "inputs/request.md",
        context: "inputs/context.md",
        prior_outputs: [],
      },
      outputs: coordOutputs,
      status: "done",
      attempt: 0,
      max_attempts: 1,
      last_error: null,
      allow_skip: true,
    });

    // Planner explicit step (already executed before coordinator in verify-flow)
    const plannerOutputs = getCanonicalOutputs("planner");
    steps.unshift({
      id: "planner",
      agent: "planner",
      depends_on: [],
      inputs: {
        request: "inputs/request.md",
        context: "inputs/context.md",
        prior_outputs: [],
      },
      outputs: plannerOutputs,
      status: "done",
      attempt: 0,
      max_attempts: 1,
      last_error: null,
      allow_skip: true,
    });

    const rationaleSample = classification.signals.slice(0, 3).join(", ");
    const rationale =
      rationaleSample.length > 0
        ? `Selected ${classification.pack.flow_type} via keywords: ${rationaleSample}`
        : `Selected ${classification.pack.flow_type}.`;

    const plan = {
      run_id: runId,
      created_at_utc: createdAtUtc,
      version: Core.PLAN_VERSION,
      flow_type: classification.pack.flow_type,
      rationale,
      signals: classification.signals,
      confidence: classification.confidence,
      steps,
    };
    Legacy.writeJsonFile(planPath, plan);
  }

  const modeLabel = mode === "dry-run" ? "Dry run" : "Run";
  console.log(
    `${modeLabel} complete for agent "${agentName}" on run "${runId}". Outputs written to ${outputsDir}`
  );

  const finishedAt = new Date();
  const executionStatus: ExecutionStatus = mapAgentStatusToExecutionStatus(status);
  const finalStepResult: StepResult = {
    ...initialStepResult,
    timestamps: {
      started_at: initialStepResult.timestamps.started_at,
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
    },
    outputs: {
      artifacts_out: [path.join("outputs", agentName, "result.json"), path.join("outputs", agentName, "notes.md")],
      summary_ref: path.join("outputs", agentName, "notes.md"),
    },
    execution: {
      status: executionStatus,
      error: null,
    },
    validation: initialStepResult.validation,
  };
  writeStepResult(runId, stepId, finalStepResult);
  const gatingPolicy = loadGatingPolicy();
  const strictness = determineStrictness(gatingPolicy, { pipeline_id: pipelineId, agent_name: agentName, step_id: stepId });
  const gateOutcome = evaluateStepGates(finalStepResult, strictness);
  const missingInputs = detectMissingInputs(runDir, finalStepResult.inputs, resolved);
  if (agentName === "human_gate" && gateOverrideMissing) {
    missingInputs.push(path.join("outputs", agentName, "override.json"));
  }
  const baseDecision = buildDecision({
    runId,
    stepId,
    finishedAt,
    strictness,
    gateOutcome,
    missingInputs,
  });
  writeDecision(runId, stepId, baseDecision);
  const override = readOverride(runId, stepId);
  const effectiveDecision = applyOverride({ baseDecision, override, gateOutcome });
  writeEffectiveDecision(runId, stepId, effectiveDecision);
  updateStepsIndex({
    runId,
    entry: {
      step_id: stepId,
      step_index: stepIndex,
      agent_name: agentName,
      status: executionStatus,
      decision_action: effectiveDecision.decision.action,
      model: modelRef,
      duration_ms: finalStepResult.timestamps.duration_ms,
    },
  });

  return result;
}

export function buildDecision(params: {
  runId: string;
  stepId: string;
  finishedAt: Date;
  strictness: import("../../core/src/policy/gating.ts").Strictness;
  gateOutcome: import("../../core/src/policy/gating.ts").GateOutcome;
  missingInputs: string[];
}): DecisionAfterStep {
  const { runId, stepId, finishedAt, strictness, gateOutcome, missingInputs } = params;
  let action: DecisionAfterStep["decision"]["action"] = "continue";
  let reason = "checks passed";
  const required_inputs = [...missingInputs];
  const rule_ids: string[] = [];

  if (missingInputs.length > 0) {
    action = "request_clarification";
    reason = `missing inputs: ${missingInputs.join(", ")}`;
    rule_ids.push("missing_inputs");
  } else if (gateOutcome.gate_status === "hard_fail") {
    action = "halt";
    reason = `hard checks failed: ${gateOutcome.hard_failed_ids.join(", ")}`;
    rule_ids.push("hard_checks_fail");
  } else if (gateOutcome.gate_status === "soft_fail" && strictness === "hard") {
    action = "require_human";
    reason = "soft failures under hard policy";
    rule_ids.push("soft_checks_fail");
  } else if (gateOutcome.gate_status === "soft_fail") {
    action = "continue";
    reason = "soft failures tolerated under soft policy";
    rule_ids.push("soft_checks_warn");
  }

  const humanPromptRef = (action === "require_human" || action === "request_clarification")
    ? path.join(Core.getStepDir(runId, stepId), "human_prompt.md")
    : null;
  if (humanPromptRef) {
    writeHumanPrompt(runId, stepId, { action, reason, required_inputs });
  }

  const decision: DecisionAfterStep = {
    schema_version: "decision-after-step.v1",
    run_id: runId,
    step_id: stepId,
    decided_at: finishedAt.toISOString(),
    decision: {
      action,
      reason,
    },
    routing: {
      next_agent: null,
      next_model: null,
    },
    requirements: {
      required_inputs,
      human_prompt_ref: humanPromptRef,
    },
    constraints: {
      immutable_context: true,
      engine_smartness: "none",
    },
    audit: {
      policy_ids: ["gating-policy.v1"],
      rule_ids,
    },
  };
  return decision;
}

export function mapAgentStatusToExecutionStatus(status: AgentStatus): ExecutionStatus {
  if (status === "failed") return "failed";
  if (status === "blocked" || status === "in_progress") return "blocked";
  if (status === "skipped") return "skipped";
  return "ok";
}

export function resolveStepMeta(runDir: string, agentName: AgentName, deps: Partial<AgentsDeps> = {}) {
  const resolved = {
    ...defaultAgentsDeps,
    ...deps,
    fs: { ...defaultAgentsDeps.fs, ...(deps.fs ?? {}) },
  } satisfies AgentsDeps;
  const planPath = path.join(runDir, "plan.json");
  let stepId: string = agentName;
  let stepIndex = 0;
  let priorOutputs: string[] = [];
  let pipelineId: string | null = null;
  if (resolved.fs.existsSync(planPath) && resolved.fs.statSync(planPath).isFile()) {
    try {
      const raw = resolved.fs.readFileSync(planPath, "utf8");
      const parsed = JSON.parse(raw) as { steps?: Array<{ id: string; agent: string; inputs?: { prior_outputs?: string[] } }>; flow_type?: string };
      pipelineId = parsed?.flow_type ?? null;
      const steps = parsed?.steps ?? [];
      const idx = steps.findIndex((s) => s.agent === agentName);
      if (idx >= 0) {
        stepIndex = idx;
        stepId = steps[idx].id ?? agentName;
        priorOutputs = steps[idx].inputs?.prior_outputs ?? [];
      }
    } catch {
      // ignore malformed plan
    }
  }
  return { stepId, stepIndex, priorOutputs, pipelineId };
}

export function detectMissingInputs(runDir: string, inputs: StepResult["inputs"], deps: Partial<AgentsDeps> = {}) {
  const resolved = {
    ...defaultAgentsDeps,
    ...deps,
    fs: { ...defaultAgentsDeps.fs, ...(deps.fs ?? {}) },
    env: deps.env ?? defaultAgentsDeps.env,
  } satisfies AgentsDeps;
  const missing: string[] = [];
  const refs = [
    inputs.context_ref,
    inputs.request_ref,
    ...inputs.artifacts_in,
  ];
  refs.forEach((rel) => {
    const full = path.join(runDir, rel);
    if (!resolved.fs.existsSync(full) || !resolved.fs.statSync(full).isFile()) {
      missing.push(rel);
    }
  });
  const forcedMissing = resolved.env.FORCE_MISSING_INPUTS;
  if (forcedMissing) {
    forcedMissing.split(",").map((s) => s.trim()).filter(Boolean).forEach((item) => missing.push(item));
  }
  return missing;
}

function writeHumanPrompt(runId: string, stepId: string, params: { action: DecisionAfterStep["decision"]["action"]; reason: string; required_inputs: string[]; }) {
  const stepDir = Core.getStepDir(runId, stepId);
  const promptPath = path.join(stepDir, "human_prompt.md");
  const lines = [
    `# Human decision needed for ${stepId}`,
    "",
    `Action requested: ${params.action}`,
    `Reason: ${params.reason}`,
    "",
    "Required inputs:",
    ...(params.required_inputs.length ? params.required_inputs.map((r) => `- ${r}`) : ["- none"]),
    "",
    "Provide the missing inputs and re-run the step.",
  ].join("\n");
  Legacy.writeFileAtomic(promptPath, lines);
  return promptPath;
}
