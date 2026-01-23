import fs from "fs";
import path from "path";
import process from "process";
import { Core, Legacy } from "./imports.ts";
import type { AgentName, AgentStatus } from "./imports.ts";
import type { DecisionAfterStep, ExecutionStatus, ModelRef, StepResult, StepOverride } from "../../core/src/contracts/step.ts";
import { writeDecision, writeEffectiveDecision, writeStepResult, updateStepsIndex } from "./step_persistence.ts";
import { applyOverride, determineStrictness, evaluateStepGates, loadGatingPolicy, readOverride } from "./gating.ts";

// Deconstruct from Legacy where helpful for cleaner code, or use Legacy.*
const {
  readFirstLines,
  readFileText,
  ensureRunAndInputs,
  buildNotes,
  writeJsonFile,
  writeFileAtomic,
} = Legacy;

const {
  PLAN_VERSION,
  isAgentName,
  getStepDir,
} = Core;


const { classifyFlow } = Legacy;

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
export function readDependencyStatus(agent, runDir) {
  const depResult = path.join(runDir, "outputs", agent, "result.json");
  if (!fs.existsSync(depResult) || !fs.statSync(depResult).isFile()) {
    return {
      ok: false,
      message: `Dependency result missing for ${agent}: ${depResult}`,
    };
  }
  try {
    const raw = fs.readFileSync(depResult, "utf8");
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
export function checkDependenciesSatisfied(step, runDir, idToAgent) {
  for (const dep of step.depends_on) {
    const agent = idToAgent?.[dep] ?? dep;
    const status = readDependencyStatus(agent, runDir);
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
export function ensureDependencies(step, runDir, idToAgent) {
  const depsStatus = checkDependenciesSatisfied(step, runDir, idToAgent);
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
export function runAgent(agentName, runId, mode, contextOverridePath = null) {
  const runDir = path.join(process.cwd(), "runs", runId);
  ensureRunAndInputs(runDir);
  const { stepId, stepIndex, priorOutputs, pipelineId } = resolveStepMeta(runDir, agentName);
  const startedAt = new Date();
  const modelRef: ModelRef = {
    provider: "unknown",
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

  const requestExcerpt = readFirstLines(requestPath, 20);
  const contextExcerpt = readFirstLines(contextPath, 20);
  const createdAtUtc = new Date().toISOString();
  const summary = `${mode === "dry-run" ? "Dry run" : "Run"
    } completed for ${agentName} on run ${runId}.`;

  const outputsDir = path.join(runDir, "outputs", agentName);
  fs.mkdirSync(outputsDir, { recursive: true });

  const resultPath = path.join(outputsDir, "result.json");
  /** @type {AgentStatus} */
  const status = "done";
  /** @type {AgentResult} */
  const result = {
    agent: agentName,
    run_id: runId,
    status,
    created_at_utc: createdAtUtc,
    summary,
    mode,
  };
  writeJsonFile(resultPath, result);

  const notesPath = path.join(outputsDir, "notes.md");
  const notes = buildNotes({
    agentName,
    runId,
    createdAtUtc,
    mode,
    requestPath,
    contextPath,
    requestExcerpt,
    contextExcerpt,
  });
  writeFileAtomic(notesPath, notes);
  const statusPath = path.join(outputsDir, "status.json");
  writeJsonFile(statusPath, {
    agent: agentName,
    run_id: runId,
    status,
    created_at_utc: createdAtUtc,
    mode,
    finished_at_utc: createdAtUtc,
  });

  if (agentName === "coordinator") {
    const planPath = path.join(runDir, "plan.json");
    const requestText = readFileText(requestPath);
    const contextText = readFileText(contextPath);
    const classification = classifyFlow(requestText, contextText);
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
      const nowIso = new Date().toISOString();
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
          const outputsDirSkipped = path.join(runDir, "outputs", stepDef.agent);
          fs.mkdirSync(outputsDirSkipped, { recursive: true });
          writeJsonFile(path.join(outputsDirSkipped, "result.json"), {
            agent: stepDef.agent,
            run_id: runId,
            status: "skipped",
            created_at_utc: nowIso,
            summary: lastError,
            mode,
          });
          writeFileAtomic(
            path.join(outputsDirSkipped, "notes.md"),
            `# ${stepDef.agent}\n\nSkipped: no security signals.\n`
          );
          writeJsonFile(path.join(outputsDirSkipped, "status.json"), {
            agent: stepDef.agent,
            run_id: runId,
            status: "skipped",
            created_at_utc: nowIso,
            finished_at_utc: nowIso,
            mode,
            reason: "no security signals",
          });
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
      version: PLAN_VERSION,
      flow_type: classification.pack.flow_type,
      rationale,
      signals: classification.signals,
      confidence: classification.confidence,
      steps,
    };
    writeJsonFile(planPath, plan);
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
  };
  writeStepResult(runId, stepId, finalStepResult);
  const gatingPolicy = loadGatingPolicy();
  const strictness = determineStrictness(gatingPolicy, { pipeline_id: pipelineId, agent_name: agentName, step_id: stepId });
  const gateOutcome = evaluateStepGates(finalStepResult, strictness);
  const missingInputs = detectMissingInputs(runDir, finalStepResult.inputs);
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

function buildDecision(params: {
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
    ? path.join(getStepDir(runId, stepId), "human_prompt.md")
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

function mapAgentStatusToExecutionStatus(status: AgentStatus): ExecutionStatus {
  if (status === "failed") return "failed";
  if (status === "blocked" || status === "in_progress") return "blocked";
  return "ok";
}

function resolveStepMeta(runDir: string, agentName: AgentName) {
  const planPath = path.join(runDir, "plan.json");
  let stepId: string = agentName;
  let stepIndex = 0;
  let priorOutputs: string[] = [];
  let pipelineId: string | null = null;
  if (fs.existsSync(planPath) && fs.statSync(planPath).isFile()) {
    try {
      const raw = fs.readFileSync(planPath, "utf8");
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

function detectMissingInputs(runDir: string, inputs: StepResult["inputs"]) {
  const missing: string[] = [];
  const refs = [
    inputs.context_ref,
    inputs.request_ref,
    ...inputs.artifacts_in,
  ];
  refs.forEach((rel) => {
    const full = path.join(runDir, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      missing.push(rel);
    }
  });
  return missing;
}

function writeHumanPrompt(runId: string, stepId: string, params: { action: DecisionAfterStep["decision"]["action"]; reason: string; required_inputs: string[]; }) {
  const stepDir = getStepDir(runId, stepId);
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
  writeFileAtomic(promptPath, lines);
  return promptPath;
}
