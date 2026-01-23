import fs from "fs";
import path from "path";
import process from "process";
import { Core, Legacy } from "./imports.ts";

const { PLAN_VERSION, VALID_AGENTS, isAgentName } = Core;
const { fail } = Legacy;
const { createFlowLock, removeLock } = Legacy;
const {
  validatePlan,
  gatherPlanSchemaErrors,
  runValidationChecks,
  validatePlanFiles,
  loadPlan,
  persistPlan,
} = Legacy;
const { readFirstLines, ensureRunAndInputs, writeJsonFile, writeFileAtomic } = Legacy;
const { generatePlanFromLLM, validatePlannerOutput, CAPABILITIES, cleanJsonOutput } = Legacy;

import {
  isAllowedStatusTransition,
  applyStatusTransition as applyStatusTransitionInternal,
} from "./status.ts";
import { normalizeStatus as normalizeStepsStatus, renderNormalizedStatus } from "./status_view.ts";

import {
  runAgent,
  ensureDependencies,
  checkDependenciesSatisfied,
  getCanonicalOutputs,
  validateCanonicalOutputs,
} from "./agents.ts";

import type {
  AgentName,
  AgentStatus,
  ExecutionMode,
  StepStatus,
  RunId,
  PlanStep,
  Plan,
} from "./imports.ts"; // We can't use named 'type' import from default export effectively?
// Core is a namespace object.
// We should import types from the source or via Core.<Type> in JSDoc.
// For typescript 'import type' it needs to resolve to a type definition.
// "./imports.ts" exports Core which exports * from core.ts.
// So import type { Plan } from "./imports.ts"; might fail if imports.ts is not re-exporting types by name?
// 'export * as Core' in imports.ts makes Core a value.
// We need to check if 'export * from ...' preserves types.
// The imports.ts does: 'import * as _Core ... export const Core = _Core'. This LOSES types.
// We need imports.ts to ALSO 'export * from ...' for types?
// Or we import types from `../../core/src/index.ts` directly for TYPE imports.
// Constraint: "Core public surface must be stable".
// I will update imports.ts to re-export types properly or import directly from core for types.


/**
 * Apply a status transition with optional mutation and persist atomically.
 * @param {Plan} plan
 * @param {string} stepId
 * @param {StepStatus} nextStatus
 * @param {string} planPath
 * @param {(step: PlanStep) => void} [mutator]
 */
function applyStatusTransition(
  plan: Plan,
  stepId: string,
  nextStatus: StepStatus,
  planPath: string,
  mutator?: (step: PlanStep) => void
) {
  applyStatusTransitionInternal(plan, stepId, nextStatus, planPath, persistPlan, mutator);
}

/**
 * Parse run id and dry-run flag from args array.
 * @param {string[]} args
 * @returns {{ runId: RunId; dryRun: boolean; remainder: string[] }}
 */
export function parseRunArgs(args) {
  /** @type {RunId | null} */
  let runId = null;
  let dryRun = false;
  let contextPath = null;
  const remainder = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--run") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        fail("Value required for --run <RUN_ID>.", { showUsage: true });
      }
      runId = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--run=")) {
      runId = arg.slice("--run=".length);
      continue;
    }
    if (arg === "--context") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        fail("Value required for --context <PATH>.", { showUsage: true });
      }
      contextPath = value;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    remainder.push(arg);
  }

  if (!runId) {
    fail("RUN_ID is required via --run <RUN_ID>.", { showUsage: true });
  }

  return { runId, dryRun, contextPath, remainder };
}

/**
 * Parse run id and step id from args.
 * @param {string[]} args
 * @returns {{ runId: RunId; stepId: string; remainder: string[] }}
 */
export function parseRunAndStepArgs(args) {
  /** @type {RunId | null} */
  let runId = null;
  let stepId = null;
  const remainder = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--run") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        fail("Value required for --run <RUN_ID>.", { showUsage: true });
      }
      runId = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--run=")) {
      runId = arg.slice("--run=".length);
      continue;
    }
    if (arg === "--step") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        fail("Value required for --step <STEP_ID>.", { showUsage: true });
      }
      stepId = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--step=")) {
      stepId = arg.slice("--step=".length);
      continue;
    }
    remainder.push(arg);
  }

  if (!runId) {
    fail("RUN_ID is required via --run <RUN_ID>.", { showUsage: true });
  }
  if (!stepId) {
    fail("STEP_ID is required via --step <STEP_ID>.", { showUsage: true });
  }

  return { runId, stepId, remainder };
}

/**
 * Execute the "agent" command.
 * @param {string[]} args
 */
export function handleAgentCommand(args) {
  if (args.length === 0 || (args[0]?.startsWith("-") ?? false)) {
    fail('Agent name is required as the first argument after "agent".', {
      showUsage: true,
    });
  }

  const agentCandidate = args.shift();

  if (!agentCandidate) {
    fail("Agent name could not be read from arguments.", { showUsage: true });
  }

  if (!isAgentName(agentCandidate)) {
    fail(
      `Unknown agent "${agentCandidate}". Supported agents: ${Array.from(
        VALID_AGENTS
      ).join(", ")}`
    );
  }

  const parsed = parseRunArgs(args);
  if (parsed.remainder.length > 0) {
    fail(`Unknown arguments: ${parsed.remainder.join(" ")}`, { showUsage: true });
  }
  const runId = parsed.runId;
  const mode = parsed.dryRun ? "dry-run" : "live";

  runAgent(agentCandidate, runId, mode, parsed.contextPath);
}

function readRunJson(runDir) {
  const runPath = path.join(runDir, "run.json");
  if (!fs.existsSync(runPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(runPath, "utf8"));
  } catch {
    return null;
  }
}

export function updateRunMetadata(runDir, updates) {
  const runPath = path.join(runDir, "run.json");
  const current = readRunJson(runDir) || {};
  const next = {
    ...current,
    ...updates,
  };
  writeJsonFile(runPath, next);
}

function writeFlowSummary(runDir, plan, runMeta) {
  const summaryPath = path.join(runDir, "summary", "final.md");
  const steps = plan?.steps || [];
  const started = runMeta?.started_at_utc || runMeta?.created_at || "-";
  const finished = runMeta?.finished_at_utc || "-";
  const flowType = runMeta?.flow || plan?.flow_type || "-";
  const status = runMeta?.status || "-";

  const stepLines = steps.length
    ? steps.map((s) => `- ${s.id} (${s.agent}): ${s.status}`).join("\n")
    : "- none";

  const artifactLines = steps
    .map((s) => {
      const out = s.outputs || {};
      return [
        `- ${s.agent}:`,
        `  - result: ${out.result ?? "?"}`,
        `  - notes: ${out.notes ?? "?"}`,
      ].join("\n");
    })
    .join("\n");

  const body = [
    "# Run summary",
    "",
    `- Run: ${runMeta?.id ?? path.basename(runDir)}`,
    `- Flow: ${flowType}`,
    `- Status: ${status}`,
    `- Started: ${started}`,
    `- Finished: ${finished}`,
    "",
    "## Steps",
    stepLines,
    "",
    "## Key artifacts",
    `- run.json`,
    `- plan.json`,
    artifactLines ? artifactLines : "- none",
  ].join("\n");

  writeFileAtomic(summaryPath, body);
}

function ensureCoordinatorStep(plan) {
  const hasCoordinator = plan.steps.some((s) => s.id === "coordinator" || s.agent === "coordinator");
  if (hasCoordinator) return plan;
  const coordOutputs = {
    result: "outputs/coordinator/result.json",
    notes: "outputs/coordinator/notes.md",
  };
  const coordinatorStep = {
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
  };
  plan.steps.unshift(coordinatorStep);
  return plan;
}

function validatePlanDependenciesStrict(plan) {
  const ids = new Set(plan.steps.map((s) => s.id));
  plan.steps.forEach((step) => {
    step.depends_on.forEach((dep) => {
      if (!ids.has(dep)) {
        fail(`Invalid dependency "${dep}" on step ${step.id}; no such step id in plan.`);
      }
    });
  });
}

export function verifyRun(runDir) {
  /** @type {string[]} */
  const errors = [];

  const runPath = path.join(runDir, "run.json");
  const planPath = path.join(runDir, "plan.json");
  const summaryPath = path.join(runDir, "summary", "final.md");

  const requireFile = (p, code) => {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
      errors.push(`${code} ${p}`);
      return false;
    }
    return true;
  };

  const runOk = requireFile(runPath, "MISSING_FILE");
  const planOk = requireFile(planPath, "MISSING_FILE");
  const summaryOk = requireFile(summaryPath, "MISSING_FILE");

  /** @type {any} */
  let runJson = null;
  if (runOk) {
    try {
      runJson = JSON.parse(fs.readFileSync(runPath, "utf8"));
    } catch {
      errors.push(`INVALID_JSON ${runPath}`);
    }
  }

  if (runJson) {
    const rid = runJson.run_id || runJson.id;
    ["status", "flow"].forEach((f) => {
      if (!runJson[f] || typeof runJson[f] !== "string") {
        errors.push(`INVALID_RUN missing ${f}`);
      }
    });
    if (!runJson.started_at_utc) {
      errors.push("INVALID_RUN missing started_at_utc");
    }
    if (runJson.status === "done" || runJson.status === "failed") {
      if (!runJson.finished_at_utc) errors.push("INVALID_RUN missing finished_at_utc");
      if (typeof runJson.exit_code !== "number") errors.push("INVALID_RUN missing exit_code");
      if (runJson.status === "done" && runJson.exit_code !== 0) {
        errors.push("INVALID_RUN done exit_code must be 0");
      }
      if (runJson.status === "failed" && (!runJson.exit_code || runJson.exit_code === 0)) {
        errors.push("INVALID_RUN failed exit_code must be non-zero");
      }
      if (runJson.status === "failed" && (!runJson.error || String(runJson.error).trim() === "")) {
        errors.push("INVALID_RUN failed requires error");
      }
    }
  }

  /** @type {{ steps: any[] } | null} */
  let plan = null;
  if (planOk) {
    try {
      plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    } catch {
      errors.push(`INVALID_JSON ${planPath}`);
    }
  }

  if (plan && Array.isArray(plan.steps)) {
    const ids = plan.steps.map((s) => s.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      errors.push("INVALID_PLAN duplicate step ids");
    }
    plan.steps.forEach((step) => {
      if (!step.id) errors.push("INVALID_PLAN step missing id");
      if (!step.agent) errors.push(`INVALID_PLAN ${step.id} missing agent`);
      if (!Array.isArray(step.depends_on)) {
        errors.push(`INVALID_PLAN ${step.id} depends_on must be array`);
      } else {
        step.depends_on.forEach((dep) => {
          if (typeof dep !== "string") {
            errors.push(`INVALID_DEP ${step.id} non-string dependency`);
          } else if (!uniqueIds.has(dep)) {
            errors.push(`INVALID_DEP ${step.id} references unknown step id "${dep}"`);
          }
        });
      }
    });

    // simple cycle check
    const graph = new Map();
    plan.steps.forEach((s) => graph.set(s.id, s.depends_on || []));
    const seen = new Set();
    const stack = new Set();
    const dfs = (id) => {
      if (stack.has(id)) {
        throw new Error(`CYCLE ${id}`);
      }
      if (seen.has(id)) return;
      stack.add(id);
      (graph.get(id) || []).forEach((d) => dfs(d));
      stack.delete(id);
      seen.add(id);
    };
    try {
      plan.steps.forEach((s) => dfs(s.id));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    // artifacts per step
    const sortedSteps = [...plan.steps].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    sortedSteps.forEach((step) => {
      const stepDir = path.join(runDir, "outputs", step.agent);
      if (!fs.existsSync(stepDir) || !fs.statSync(stepDir).isDirectory()) {
        errors.push(`MISSING_DIR outputs/${step.agent}`);
        return;
      }
      ["notes.md", "result.json", "status.json"].forEach((fname) => {
        const p = path.join(stepDir, fname);
        if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
          errors.push(`MISSING_ARTIFACT ${path.relative(runDir, p)}`);
        }
      });
      const statusPath = path.join(stepDir, "status.json");
      if (fs.existsSync(statusPath)) {
        try {
          const statusJson = JSON.parse(fs.readFileSync(statusPath, "utf8"));
          const st = normalizeStatus(statusJson.status);
          const needsFinished = ["done", "failed", "skipped"];
          const finished = statusJson.finished_at_utc || statusJson.finished_at;
          if (needsFinished.includes(st) && !finished) {
            errors.push(`INVALID_STATUS ${path.relative(runDir, statusPath)} missing finished_at_utc`);
          }
          const planStatusNorm = normalizeStatus(step.status);
          if (planStatusNorm && st && planStatusNorm !== st) {
            errors.push(`STATUS_MISMATCH ${step.id} plan=${step.status} artifact=${st}`);
          }
        } catch {
          errors.push(`INVALID_JSON ${statusPath}`);
        }
      }
      if (step.status === "failed") {
        const stderrPath = path.join(stepDir, "stderr.txt");
        if (!fs.existsSync(stderrPath) || !fs.statSync(stderrPath).isFile()) {
          errors.push(`MISSING_ARTIFACT ${path.relative(runDir, stderrPath)}`);
        }
      }
    });
  }

  if (summaryOk) {
    try {
      const content = fs.readFileSync(summaryPath, "utf8");
      if (/TODO/i.test(content)) {
        errors.push("INVALID_SUMMARY contains TODO");
      }
      if (runJson) {
        const rid = runJson.run_id || runJson.id || "";
        if (!content.includes(String(rid))) errors.push("INVALID_SUMMARY missing run id");
        if (runJson.flow && !content.includes(String(runJson.flow))) errors.push("INVALID_SUMMARY missing flow");
        if (runJson.status && !content.includes(String(runJson.status))) errors.push("INVALID_SUMMARY missing status");
      }
    } catch {
      errors.push("INVALID_SUMMARY unreadable");
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Execute steps defined in plan.json in order.
 * @param {RunId} runId
 * @param {ExecutionMode} mode
 */
export function runFlow(runId, mode) {
  const runDir = path.join(process.cwd(), "runs", runId);
  if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
    fail(`Run directory not found: ${runDir}`, { exitCode: 11 });
  }

  const startedAt = new Date().toISOString();
  updateRunMetadata(runDir, {
    status: "in_progress",
    started_at_utc: readRunJson(runDir)?.started_at_utc ?? startedAt,
  });

  const missingInputs = validatePlanFiles(
    {
      run_id: runId,
      created_at_utc: "",
      version: PLAN_VERSION,
      flow_type: "",
      rationale: "",
      signals: [],
      confidence: "low",
      steps: [],
    },
    runDir
  ).filter((msg) => msg.startsWith("Missing input"));
  if (missingInputs.length > 0) {
    missingInputs.forEach((msg) => console.error(`ERROR: ${msg}`));
    fail("Missing required inputs.", { exitCode: 11 });
  }

  const lockPath = createFlowLock(runDir, runId, mode);
  let resolvedFlowType = "";
  /** @type {Plan | null} */
  let planForSummary = null;
  try {
    const planPath = path.join(runDir, "plan.json");

    if (!fs.existsSync(planPath)) {
      console.log("plan.json not found; running coordinator to generate plan.");
      runAgent("coordinator", runId, mode);
    }

    let validation = runValidationChecks(runId, runDir, planPath);
    if (validation.planLoadError) {
      console.error(`ERROR: ${validation.planLoadError}`);
      fail("Validation failed.", { exitCode: 10 });
    }
    if (validation.schemaErrors.length > 0) {
      validation.schemaErrors.forEach((err) => console.error(`ERROR: ${err}`));
      fail("Validation failed.", { exitCode: 12 });
    }
    if (validation.missingPaths.length > 0) {
      validation.missingPaths.forEach((err) => console.error(`ERROR: ${err}`));
      fail("Validation failed.", { exitCode: 11 });
    }
    const planMaybe = validation.plan;
    if (!planMaybe) {
      fail("Unable to load plan.", { exitCode: 10 });
    }

    const planPathFinal = planPath;
    /** @type {Plan} */
    let plan = ensureCoordinatorStep(planMaybe);
    if (plan !== planMaybe) {
      persistPlan(planPathFinal, plan);
    }
    validatePlanDependenciesStrict(plan);
    resolvedFlowType = plan.flow_type || resolvedFlowType || "flow";
    planForSummary = plan;

    const idToAgent = Object.fromEntries(plan.steps.map((s) => [s.id, s.agent]));
    plan.steps.forEach((step) => {
      if (step.status === "failed") {
        fail(
          `Cannot continue: step ${step.id} is already failed. Update plan.json before rerunning flow.`
        );
      }
      if (step.status === "running") {
        fail(
          `Cannot continue: step ${step.id} is marked running. Update plan.json before rerunning flow.`
        );
      }
      if (step.status === "done" || step.status === "skipped") {
        return;
      }

      if (step.attempt > step.max_attempts) {
        fail(
          `Step ${step.id} has reached max attempts (${step.attempt}/${step.max_attempts}). Use retry or skip to continue.`
        );
      }

      ensureDependencies(step, runDir, idToAgent);

      applyStatusTransition(
        plan,
        step.id,
        "running",
        planPathFinal,
        (s) => {
          s.last_error = null;
        }
      );
      plan = loadPlan(planPathFinal, runId);

      try {
        runAgent(step.agent, runId, mode);
        applyStatusTransition(
          plan,
          step.id,
          "done",
          planPathFinal,
          (s) => {
            s.last_error = null;
          }
        );
        plan = loadPlan(planPathFinal, runId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const truncated = reason.replace(/\s+/g, " ").slice(0, 200);
        applyStatusTransition(
          plan,
          step.id,
          "failed",
          planPathFinal,
          (s) => {
            s.last_error = truncated;
          }
        );
        throw error;
      }
    });

    planForSummary = plan;
    const summary = plan.steps
      .map((step) => `${step.id}:${step.agent}=${step.status}`)
      .join(", ");
    console.log(`Flow complete for run ${runId}. Steps: ${summary}`);
    updateRunMetadata(runDir, {
      status: "done",
      finished_at_utc: new Date().toISOString(),
      flow: resolvedFlowType || "flow",
      exit_code: 0,
      error: null,
    });
    const metaDone = readRunJson(runDir);
    writeFlowSummary(runDir, planForSummary, metaDone);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateRunMetadata(runDir, {
      status: "failed",
      finished_at_utc: new Date().toISOString(),
      flow: resolvedFlowType || "flow",
      exit_code: 1,
      error: message,
    });
    const metaFailed = readRunJson(runDir);
    if (planForSummary) {
      try { writeFlowSummary(runDir, planForSummary, metaFailed); } catch { /* best effort */ }
    }
    throw error;
  } finally {
    removeLock(lockPath);
  }
}

/**
 * Execute the "flow" command.
 * @param {string[]} args
 */
export function handleFlowCommand(args) {
  const parsed = parseRunArgs(args);
  if (parsed.remainder.length > 0) {
    fail(`Unknown arguments: ${parsed.remainder.join(" ")}`, { showUsage: true });
  }
  const mode = parsed.dryRun ? "dry-run" : "live";
  runFlow(parsed.runId, mode);
}

/**
 * Execute the "validate" command.
 * @param {string[]} args
 */
export function handleValidateCommand(args) {
  const parsed = parseRunArgs(args);
  if (parsed.remainder.length > 0) {
    fail(`Unknown arguments: ${parsed.remainder.join(" ")}`, { showUsage: true });
  }
  const runDir = path.join(process.cwd(), "runs", parsed.runId);
  if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
    console.error(`ERROR: Run directory not found: ${runDir}`);
    process.exit(11);
  }
  const planPath = path.join(runDir, "plan.json");
  const result = runValidationChecks(parsed.runId, runDir, planPath);
  if (result.planLoadError) {
    console.error(`ERROR: ${result.planLoadError}`);
    process.exit(10);
  }
  if (result.schemaErrors.length > 0) {
    result.schemaErrors.forEach((err) => console.error(`ERROR: ${err}`));
    process.exit(12);
  }
  if (result.missingPaths.length > 0) {
    result.missingPaths.forEach((err) => console.error(`ERROR: ${err}`));
    process.exit(11);
  }
  console.log("OK");
}

/**
 * Execute the "retry" command.
 * @param {string[]} args
 */
export function handleRetryCommand(args) {
  const parsed = parseRunAndStepArgs(args);
  if (parsed.remainder.length > 0) {
    fail(`Unknown arguments: ${parsed.remainder.join(" ")}`, { showUsage: true });
  }
  const runDir = path.join(process.cwd(), "runs", parsed.runId);
  const planPath = path.join(runDir, "plan.json");
  if (!fs.existsSync(planPath)) {
    fail(`plan.json not found at ${planPath}`);
  }
  const plan = loadPlan(planPath, parsed.runId);
  const target = plan.steps.find((s) => s.id === parsed.stepId);
  if (!target) {
    fail(`Step not found: ${parsed.stepId}`);
  }
  if (target.status !== "failed") {
    fail(`Retry allowed only when status is failed (current ${target.status}).`);
  }
  if (target.attempt >= target.max_attempts) {
    fail(
      `Max attempts reached for step ${target.id} (${target.attempt}/${target.max_attempts}).`
    );
  }
  const nextAttempt = target.attempt + 1;
  applyStatusTransition(
    plan,
    target.id,
    "pending",
    planPath,
    (s) => {
      s.attempt = nextAttempt;
      s.last_error = null;
    }
  );
  console.log(
    `Step ${target.id} marked pending for retry (attempt ${nextAttempt}/${target.max_attempts}).`
  );
}

/**
 * Execute the "skip" command.
 * @param {string[]} args
 */
export function handleSkipCommand(args) {
  const parsed = parseRunAndStepArgs(args);
  if (parsed.remainder.length > 0) {
    fail(`Unknown arguments: ${parsed.remainder.join(" ")}`, { showUsage: true });
  }
  const runDir = path.join(process.cwd(), "runs", parsed.runId);
  const planPath = path.join(runDir, "plan.json");
  if (!fs.existsSync(planPath)) {
    fail(`plan.json not found at ${planPath}`);
  }
  const plan = loadPlan(planPath, parsed.runId);
  const target = plan.steps.find((s) => s.id === parsed.stepId);
  if (!target) {
    fail(`Step not found: ${parsed.stepId}`);
  }
  if (!target.allow_skip) {
    fail(`Step ${target.id} does not allow skipping.`);
  }
  if (target.status !== "pending" && target.status !== "failed") {
    fail(
      `Skip allowed only when status is pending or failed (current ${target.status}).`
    );
  }
  applyStatusTransition(plan, target.id, "skipped", planPath);
  console.log(`Step ${target.id} marked skipped.`);
}

/**
 * Execute the "verify-run" command.
 * @param {string[]} args
 */
export function handleVerifyRunCommand(args) {
  let runId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run") {
      runId = args[i + 1];
      i += 1;
    } else if (args[i].startsWith("--run=")) {
      runId = args[i].slice("--run=".length);
    }
  }
  if (!runId) {
    fail("RUN is required via --run <RUN>", { showUsage: true });
  }
  const runDir = path.join(process.cwd(), "runs", runId);
  const result = verifyRun(runDir);
  if (result.ok) {
    console.log(`verify-run OK: ${runId}`);
    return;
  }
  result.errors.forEach((e) => console.error(e));
  process.exit(1);
}

/**
 * Execute the "status" command.
 * @param {string[]} args
 */
// (Removed duplicate implementation)

// ... wait, I need to update parseRunArgs to be optional for RUN_ID? 
// Or I can just check args manually here since I have access to raw `args`.
// But `parseRunArgs` is exported and used by others.
// Providing a new helper `parseRunArgsOptional` or similar is better. 
// Or just duplicating simplistic parsing for status command to allow "no run id".

/**
 * Normalize a raw status string to canonical vocabulary.
 * @param {string} raw
 * @returns {import("./core.ts").StepStatus}
 */
function normalizeStatus(raw) {
  const r = (raw || "").toLowerCase().trim();
  switch (r) {
    case "done":
    case "success":
    case "completed":
    case "ok":
      return "done";
    case "failed":
    case "error":
    case "failure":
      return "failed";
    case "running":
    case "in_progress":
    case "active":
      return "running";
    case "skipped":
      return "skipped";
    case "pending":
    case "blocked":
    case "incomplete":
      return "pending";
    default:
      // Safety fallback
      return "pending";
  }
}

export function selectArtifactPath(agentDir, normalizedStatus) {
  const candidates = ["notes.md", "stderr.txt", "status.json", "result.json"];

  for (const candidate of candidates) {
    const full = path.join(agentDir, candidate);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolve latest run ID from runs directory.
 * @returns {string | null}
 */
function getLatestRunId() {
  const runsDir = path.join(process.cwd(), "runs");
  if (!fs.existsSync(runsDir)) return null;

  const entries = fs.readdirSync(runsDir).filter(name => {
    // Basic check: is directory and looks like a run?
    // Our runs usually start with date or 'orch-' or 'test-'
    // Just filter for directories.
    try {
      return fs.statSync(path.join(runsDir, name)).isDirectory();
    } catch { return false; }
  });

  if (entries.length === 0) return null;

  // Lexicographical sort (ISO dates and prefixes generally sort correctly for "latest at end")
  entries.sort();
  return entries[entries.length - 1];
}

/**
 * Execute the "status" command.
 * @param {string[]} args
 */
export function handleStatusCommand(args) {
  let runId = null;

  // Custom arg parsing to allow optional --run
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--run") {
      runId = args[i + 1];
      i += 2;
    } else if (args[i].startsWith("--run=")) {
      runId = args[i].slice(6);
      i += 1;
    } else {
      i++;
    }
  }

  if (!runId) {
    runId = getLatestRunId();
    if (!runId) {
      fail("No runs found and no --run <RUN_ID> specified.");
    }
    console.log(`Auto-resolved latest run: ${runId}`);
  }

  const runDir = path.join(process.cwd(), "runs", runId);
  if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
    fail(`Run directory not found: ${runDir}`);
  }

  const planPath = path.join(runDir, "plan.json");
  const lockPath = path.join(runDir, ".lock");
  const lockStatus = fs.existsSync(lockPath) ? `LOCK: present (${lockPath})` : "LOCK: none";

  /** @type {Array<{id: string, agent: string, status: string, artifacts: string, created_at?: string, depends_on?: string}>} */
  let rows = [];
  let flowMeta = "";
  let overallStatus = "UNKNOWN";

  // === MODE A: PLAN MODE (plan.json exists) ===
  if (fs.existsSync(planPath)) {
    const validation = runValidationChecks(runId, runDir, planPath);
    if (validation.planLoadError) { console.error(`ERROR: ${validation.planLoadError}`); process.exit(10); }

    const plan = validation.plan;
    if (!plan) process.exit(10);

    // Plan-level metadata
    const signalsPreview = plan.signals.length > 8 ? `${plan.signals.slice(0, 8).join(",")}, ...` : plan.signals.join(",") || "-";
    flowMeta = `Flow: ${plan.flow_type} | confidence=${plan.confidence} | signals=${signalsPreview}`;

    // Rows
    rows = plan.steps.map(step => {
      // Note: plan.json does not currently store start timestamps per step, only plan creation time.
      // Future hooks: if step was updated with created_at, read it here.
      return {
        id: step.id,
        agent: step.agent,
        status: normalizeStatus(step.status),
        artifacts: "-", // Plan mode relies on step status, not specific artifacts in summary
        created_at: undefined, // Plan.json doesn't track execution start time per step yet
        depends_on: step.depends_on.join(",") || "-"
      };
    });

    // Calc Overall
    const counts = { pending: 0, running: 0, done: 0, failed: 0, skipped: 0 };
    rows.forEach(r => counts[r.status] = (counts[r.status] || 0) + 1);

    let next = "NEXT: run flow";
    if (counts.failed > 0) next = `NEXT: retry or skip failed step(s)`;
    else if (counts.done + counts.skipped === rows.length) next = "DONE: plan complete";
    else if (counts.running > 0) next = "IN PROGRESS: steps running";

    overallStatus = next;
    console.log(`Run: ${runId}`);
    console.log(`Plan: version=${plan.version} created_at_utc=${plan.created_at_utc}`); // Plan start time

  } else {
    // === MODE B: ARTIFACT INSPECTION MODE (No plan.json) ===
    console.log(`Run: ${runId}`);
    console.log(`Type: Flow (Artifact Inspection - No plan.json)`);
    flowMeta = "Flow: Artifact Inspection";

    // 1. Goal
    let goal = "Unknown";
    try { goal = readFirstLines(path.join(runDir, "inputs", "request.md"), 1)[0] || "Unknown"; } catch { }
    console.log(`Goal: ${goal}`);

    // 2. Agents (scan outputs)
    const outputsDir = path.join(runDir, "outputs");
    const plannerOutputsDir = path.join(outputsDir, "planner");
    const hasPlannerOutputsDir = fs.existsSync(plannerOutputsDir) && fs.statSync(plannerOutputsDir).isDirectory();

    // Legacy planner-only artifacts (only show when we do not have outputs/planner yet).
    if (!hasPlannerOutputsDir) {
      const plannerSummaryExists = fs.existsSync(path.join(runDir, "planner_summary.md"));
      const plannerFailExists = fs.existsSync(path.join(runDir, "planner_validation_error.json"));

      let plannerStatus = "pending";
      if (plannerSummaryExists) plannerStatus = "done";
      else if (plannerFailExists) plannerStatus = "failed";

      rows.push({
        id: "(planner)",
        agent: "planner",
        status: normalizeStatus(plannerStatus),
        artifacts: plannerSummaryExists ? "planner_summary.md" : (plannerFailExists ? "planner_validation_error.json" : "-"),
        created_at: undefined // Legacy planner-only mode did not write outputs/planner/result.json
      });
    }

    if (fs.existsSync(outputsDir)) {
      const agents = fs.readdirSync(outputsDir).filter(name => fs.statSync(path.join(outputsDir, name)).isDirectory());

      agents.forEach(agent => {
        const agentDir = path.join(outputsDir, agent);
        const resultPath = path.join(agentDir, "result.json");
        const statusPath = path.join(agentDir, "status.json");
        let st = "pending";
        let ts = undefined;

        if (fs.existsSync(resultPath)) {
          try {
            const res = JSON.parse(fs.readFileSync(resultPath, "utf8"));
            st = res.status || "pending";
            ts = res.created_at_utc; // Start time available!
          } catch { st = "failed"; } // Corrupt json -> failed
        } else if (fs.existsSync(statusPath)) {
          try {
            const res = JSON.parse(fs.readFileSync(statusPath, "utf8"));
            st = res.status || "pending";
            ts = res.started_at || res.finished_at;
          } catch { st = "failed"; }
        } else {
          // Directory exists but no result -> "pending" (per user request)
          st = "pending";
        }

        const normalizedStatus = normalizeStatus(st);
        const artifactName = selectArtifactPath(agentDir, normalizedStatus);
        rows.push({
          id: "(flow)",
          agent: agent,
          status: normalizedStatus,
          artifacts: artifactName ? `outputs/${agent}/${artifactName}` : "-",
          created_at: ts
        });
      });
    }

    // Overall
    const allDone = rows.every(r => r.status === "done" || r.status === "skipped");
    const anyFailed = rows.some(r => r.status === "failed");
    overallStatus = anyFailed ? "FAILED: flow error" : (allDone ? "DONE: flow complete" : "IN PROGRESS / PENDING");
  }

  // === RENDER ===
  console.log(flowMeta);
  console.log(lockStatus);

  // Determine columns
  const hasTiming = rows.some(r => !!r.created_at);
  const showDeps = rows.some(r => r.depends_on !== undefined && r.depends_on !== "-"); // Only show depends if meaningful

  // Header construction
  let fmt = (id, ag, st, start, art, dep) => {
    let parts = [
      id.padEnd(14),
      ag.padEnd(18),
      st.padEnd(12)
    ];
    if (hasTiming) parts.push((start || "-").padEnd(25));
    // Artifacts vs DependsOn: Plan mode uses deps, Artifact uses artifacts. Mix logic?
    // Let's print Artifacts col for everyone, or Depends col if existing.
    // To simplify: if dependencies exist (Plan Mode), show them. Else show artifacts.
    if (showDeps) parts.push((dep || "-").padEnd(25));
    else parts.push((art || "-"));

    return parts.join(" ");
  };

  let headerParts = ["id".padEnd(14), "agent".padEnd(18), "status".padEnd(12)];
  if (hasTiming) headerParts.push("Start (UTC)".padEnd(25));
  if (showDeps) headerParts.push("depends_on");
  else headerParts.push("artifacts");

  console.log("Steps:");
  console.log(headerParts.join(" "));

  rows.forEach(r => {
    // TODO: Wire up duration/end-time when artifacts support it (e.g. r.duration, r.ended_at)
    console.log(fmt(r.id, r.agent, r.status, r.created_at, r.artifacts, r.depends_on));
  });

  console.log(overallStatus);
}

export function applyStatusTransitionWrapper(plan, stepId, nextStatus, planPath, mutator) {
  applyStatusTransition(plan, stepId, nextStatus, planPath, mutator);
}

/**
 * Execute the "planner" command.
 * @param {string[]} args
 */
export async function handlePlannerCommand(args) {
  let goal = "";
  let contextStr = "See inputs/context.md and repo structure.";
  let runId = new Date().toISOString().replace(/[:.]/g, "-");
  let dryRun = false;

  // Simple arg parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--goal") {
      goal = args[++i];
    } else if (arg === "--run") {
      runId = args[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--context") {
      // If context is a file, read it, else use string
      const val = args[++i];
      if (fs.existsSync(val)) {
        contextStr = fs.readFileSync(val, "utf8");
      } else {
        contextStr = val;
      }
    }
  }

  if (!goal) {
    fail("Goal is required via --goal \"...\"", { showUsage: true });
  }

  const runDir = path.join(process.cwd(), "runs", runId);
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  console.log(`Starting Planner-only run: ${runId}`);
  console.log(`Goal: ${goal}`);

  const promptPath = path.join(process.cwd(), "prompts", "canonical", "llm-coordinator-v1-planner.prompt.md");

  try {
    // 1. Generate Plan
    console.log("Connecting to LLM...");
    let rawText;
    try {
      rawText = await generatePlanFromLLM(promptPath, goal, contextStr);
    } catch (netErr) {
      console.error("Network error:", netErr);
      writeJsonFile(path.join(runDir, "planner_validation_error.json"), {
        error_type: "network_error",
        message: netErr.message,
        timestamp: new Date().toISOString()
      });
      process.exit(10);
    }

    const cleanedText = cleanJsonOutput(rawText);

    let planJson;
    try {
      planJson = JSON.parse(cleanedText);
      // Successful parse -> save structure
      writeJsonFile(path.join(runDir, "planner_raw.json"), planJson);
      console.log(`Raw plan saved to runs/${runId}/planner_raw.json`);
    } catch (parseErr) {
      console.error("JSON parse failed.");
      fs.writeFileSync(path.join(runDir, "planner_failed_raw.txt"), rawText);
      writeJsonFile(path.join(runDir, "planner_validation_error.json"), {
        error_type: "parse_error",
        message: parseErr.message,
        details: null,
        timestamp: new Date().toISOString()
      });
      process.exit(11);
    }

    // 2. Validate
    console.log("Validating plan...");
    const validation = validatePlannerOutput(planJson, CAPABILITIES);

    // Save validation report
    const report = {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      timestamp: new Date().toISOString()
    };
    writeJsonFile(path.join(runDir, "planner_validation.json"), report);

    if (!validation.valid) {
      console.error(`Plan validation FAILED (exit 12):`);
      validation.errors.forEach(e => console.error(`- ${e}`));

      writeJsonFile(path.join(runDir, "planner_validation_error.json"), {
        error_type: "gate_error",
        message: "Validation gates failed",
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
      process.exit(12);
    }

    console.log("Plan validation PASSED.");
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn("Warnings:");
      validation.warnings.forEach(w => console.warn(`- ${w}`));
    }

    // 3. Summarize
    const plan = validation.parsed;
    const summary = `
# Plan Summary
Goal: ${plan.goal}
Clarification Needed: ${plan.needs_clarification}
Steps: ${plan.plan.length}

## Warnings
${validation.warnings.length > 0 ? validation.warnings.map(w => `- ${w}`).join("\n") : "None"}

## Steps
${plan.plan.map(s => `- [${s.risk}] ${s.title} (${s.action_type})`).join("\n")}
        `;
    writeFileAtomic(path.join(runDir, "planner_summary.md"), summary.trim());
    console.log(`Summary saved to runs/${runId}/planner_summary.md`);

  } catch (error) {
    console.error("Planner execution failed:", error);
    process.exit(1);
  }
}
