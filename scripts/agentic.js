#!/usr/bin/env node
// @ts-check

import fs from "fs";
import path from "path";
import process from "process";
import {
  PLAN_VERSION,
  VALID_AGENTS,
  USAGE,
  isAgentName,
  isStepStatus,
} from "./agentic/core.js";
import { fail, handleFatalError } from "./agentic/errors.js";
import {
  isAllowedStatusTransition,
  applyStatusTransition as applyStatusTransitionInternal,
} from "./agentic/status.js";
import { createFlowLock, removeLock } from "./agentic/lock.js";
import {
  readFirstLines,
  readFileText,
  ensureRunAndInputs,
  formatExcerpt,
  buildNotes,
  writeJsonFile,
  writeFileAtomic,
} from "./agentic/fs.js";
import {
  classifyFlow,
  loadRulePacks,
  validateRulePack,
} from "./agentic/rules.js";
import {
  validatePlan,
  gatherPlanSchemaErrors,
  runValidationChecks,
  validatePlanFiles,
  loadPlan,
  persistPlan,
  getCanonicalOutputs,
  validateCanonicalOutputs,
} from "./agentic/plan.js";

/**
 * @typedef {import("./agentic/core.js").AgentName} AgentName
 * @typedef {import("./agentic/core.js").AgentStatus} AgentStatus
 * @typedef {import("./agentic/core.js").ExecutionMode} ExecutionMode
 * @typedef {import("./agentic/core.js").StepStatus} StepStatus
 * @typedef {import("./agentic/core.js").ConfidenceLevel} ConfidenceLevel
 * @typedef {import("./agentic/core.js").RunId} RunId
 * @typedef {import("./agentic/core.js").AgentResult} AgentResult
 * @typedef {import("./agentic/core.js").BuildNotesParams} BuildNotesParams
 * @typedef {import("./agentic/core.js").PlanStep} PlanStep
 * @typedef {import("./agentic/core.js").RuleStep} RuleStep
 * @typedef {import("./agentic/core.js").RulePack} RulePack
 * @typedef {import("./agentic/core.js").Plan} Plan
 * @typedef {import("./agentic/core.js").ValidationResult} ValidationResult
 */

/**
 * Apply a status transition with optional mutation and persist atomically.
 * @param {Plan} plan
 * @param {string} stepId
 * @param {StepStatus} nextStatus
 * @param {string} planPath
 * @param {(step: PlanStep) => void} [mutator]
 */
function applyStatusTransition(plan, stepId, nextStatus, planPath, mutator) {
  applyStatusTransitionInternal(plan, stepId, nextStatus, planPath, persistPlan, mutator);
}

/**
 * Execute an agent, producing notes and result outputs.
 * Coordinator additionally writes plan.json.
 * @param {AgentName} agentName
 * @param {RunId} runId
 * @param {ExecutionMode} mode
 * @returns {AgentResult}
 */
function runAgent(agentName, runId, mode) {
  const runDir = path.join(process.cwd(), "runs", runId);
  ensureRunAndInputs(runDir);

  const requestPath = path.join(runDir, "inputs", "request.md");
  const contextPath = path.join(runDir, "inputs", "context.md");

  const requestExcerpt = readFirstLines(requestPath, 20);
  const contextExcerpt = readFirstLines(contextPath, 20);
  const createdAtUtc = new Date().toISOString();
  const summary = `${
    mode === "dry-run" ? "Dry run" : "Run"
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

  if (agentName === "coordinator") {
    const planPath = path.join(runDir, "plan.json");
    const requestText = readFileText(requestPath);
    const contextText = readFileText(contextPath);
  const classification = classifyFlow(requestText, contextText);
  /** @type {PlanStep[]} */
  const steps = [];
  const matchedSet = new Set(classification.signals.map((s) => s.replace(/^keyword:/, "")));
  classification.pack.steps.forEach((stepDef) => {
    if (
      Array.isArray(stepDef.enabled_if_keywords) &&
      stepDef.enabled_if_keywords.length > 0
    ) {
      const enabled = stepDef.enabled_if_keywords.some((k) =>
        matchedSet.has(k)
      );
      if (!enabled) {
        return;
      }
    }
    const priorOutputs = stepDef.depends_on.flatMap((dep) => {
      const outputs = getCanonicalOutputs(dep);
      return [outputs.result, outputs.notes];
    });
    steps.push({
      id: stepDef.id,
      agent: stepDef.agent,
      depends_on: stepDef.depends_on,
      inputs: {
        request: "inputs/request.md",
        context: "inputs/context.md",
        prior_outputs: priorOutputs,
      },
      outputs: getCanonicalOutputs(stepDef.agent),
      status: "pending",
      attempt: 0,
      max_attempts: 1,
      last_error: null,
      allow_skip: true,
    });
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
  persistPlan(planPath, plan);
}

  const modeLabel = mode === "dry-run" ? "Dry run" : "Run";
  console.log(
    `${modeLabel} complete for agent "${agentName}" on run "${runId}". Outputs written to ${outputsDir}`
  );

  return result;
}

/**
 * Parse run id and dry-run flag from args array.
 * @param {string[]} args
 * @returns {{ runId: RunId; dryRun: boolean; remainder: string[] }}
 */
function parseRunArgs(args) {
  /** @type {RunId | null} */
  let runId = null;
  let dryRun = false;
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
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    remainder.push(arg);
  }

  if (!runId) {
    fail("RUN_ID is required via --run <RUN_ID>.", { showUsage: true });
  }

  return { runId, dryRun, remainder };
}

/**
 * Parse run id and step id from args.
 * @param {string[]} args
 * @returns {{ runId: RunId; stepId: string; remainder: string[] }}
 */
function parseRunAndStepArgs(args) {
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
function handleAgentCommand(args) {
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

  runAgent(agentCandidate, runId, mode);
}

/**
 * Read dependency result status.
 * @param {AgentName} agent
 * @param {string} runDir
 * @returns {{ ok: boolean; message: string | null }}
 */
function readDependencyStatus(agent, runDir) {
  const depResult = path.join(runDir, "outputs", agent, "result.json");
  if (!fs.existsSync(depResult) || !fs.statSync(depResult).isFile()) {
    return {
      ok: false,
      message: `Dependency result missing for ${agent} at ${depResult}.`,
    };
  }
  try {
    const raw = fs.readFileSync(depResult, "utf8");
    const parsed = JSON.parse(raw);
    const depStatus = parsed?.status;
    if (depStatus !== "done") {
      return {
        ok: false,
        message: `Dependency not satisfied: ${agent} status is ${String(
          depStatus
        )}, expected done.`,
      };
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `Dependency result unreadable for ${agent} at ${depResult}. ${reason}`,
    };
  }
  return { ok: true, message: null };
}

/**
 * Ensure all dependency outputs exist and are satisfied before running a step.
 * @param {PlanStep} step
 * @param {string} runDir
 */
function ensureDependencies(step, runDir) {
  for (const agent of step.depends_on) {
    const status = readDependencyStatus(agent, runDir);
    if (!status.ok) {
      fail(status.message ?? `Dependency not satisfied for ${agent}.`);
    }
  }
}

/**
 * Check whether dependencies are satisfied without throwing.
 * @param {PlanStep} step
 * @param {string} runDir
 * @returns {{ ready: boolean; blocking: string | null }}
 */
function checkDependenciesSatisfied(step, runDir) {
  for (const agent of step.depends_on) {
    const status = readDependencyStatus(agent, runDir);
    if (!status.ok) {
      return { ready: false, blocking: status.message ?? `Dependency ${agent} not ready.` };
    }
  }
  return { ready: true, blocking: null };
}

/**
 * Execute steps defined in plan.json in order.
 * @param {RunId} runId
 * @param {ExecutionMode} mode
 */
function runFlow(runId, mode) {
  const runDir = path.join(process.cwd(), "runs", runId);
  if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
    fail(`Run directory not found: ${runDir}`, { exitCode: 11 });
  }

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
    let plan = planMaybe;

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

      ensureDependencies(step, runDir);

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

    const summary = plan.steps
      .map((step) => `${step.id}:${step.agent}=${step.status}`)
      .join(", ");
    console.log(`Flow complete for run ${runId}. Steps: ${summary}`);
  } finally {
    removeLock(lockPath);
  }
}

/**
 * Execute the "flow" command.
 * @param {string[]} args
 */
function handleFlowCommand(args) {
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
function handleValidateCommand(args) {
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
function handleRetryCommand(args) {
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
function handleSkipCommand(args) {
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
 * Execute the "status" command.
 * @param {string[]} args
 */
function handleStatusCommand(args) {
  const parsed = parseRunArgs(args);
  if (parsed.remainder.length > 0) {
    fail(`Unknown arguments: ${parsed.remainder.join(" ")}`, { showUsage: true });
  }
  const runDir = path.join(process.cwd(), "runs", parsed.runId);
  const planPath = path.join(runDir, "plan.json");
  const validation = runValidationChecks(parsed.runId, runDir, planPath);
  if (validation.planLoadError) {
    console.error(`ERROR: ${validation.planLoadError}`);
    process.exit(10);
  }
  if (validation.schemaErrors.length > 0) {
    validation.schemaErrors.forEach((err) => console.error(`ERROR: ${err}`));
    process.exit(12);
  }
  if (validation.missingPaths.length > 0) {
    validation.missingPaths.forEach((err) => console.error(`ERROR: ${err}`));
    process.exit(11);
  }
  if (!validation.plan) {
    console.error("ERROR: Unable to load plan.");
    process.exit(10);
  }
  const plan = validation.plan;
  const counts = {
    pending: 0,
    running: 0,
    done: 0,
    failed: 0,
    skipped: 0,
  };
  plan.steps.forEach((step) => {
    counts[step.status] += 1;
  });

  const lockPath = path.join(runDir, ".lock");
  const lockStatus = fs.existsSync(lockPath)
    ? `LOCK: present (${lockPath})`
    : "LOCK: none";

  console.log(`Run: ${parsed.runId}`);
  console.log(
    `Plan: version=${plan.version} created_at_utc=${plan.created_at_utc}`
  );
  const signalsPreview =
    plan.signals.length > 8
      ? `${plan.signals.slice(0, 8).join(",")}, ...`
      : plan.signals.join(",") || "-";
  console.log(
    `Flow: ${plan.flow_type} | confidence=${plan.confidence} | signals=${signalsPreview}`
  );
  console.log(
    `Counts: pending=${counts.pending} running=${counts.running} done=${counts.done} failed=${counts.failed} skipped=${counts.skipped}`
  );
  console.log(lockStatus);

  console.log("Steps:");
  const headers = [
    "id".padEnd(14),
    "agent".padEnd(18),
    "status".padEnd(10),
    "attempt".padEnd(12),
    "depends_on",
  ].join(" ");
  console.log(headers);
  plan.steps.forEach((step) => {
    const attemptStr = `${step.attempt}/${step.max_attempts}`;
    const deps = step.depends_on.length > 0 ? step.depends_on.join(",") : "-";
    console.log(
      [
        step.id.padEnd(14),
        step.agent.padEnd(18),
        step.status.padEnd(10),
        attemptStr.padEnd(12),
        deps,
      ].join(" ")
    );
  });

  let nextAction = "NEXT: run flow";
  const failedStep = plan.steps.find((s) => s.status === "failed");
  if (failedStep) {
    nextAction = `NEXT: retry or skip step ${failedStep.id}`;
  } else {
    const pendingSteps = plan.steps.filter((s) => s.status === "pending");
    const readyStep = pendingSteps.find((step) => {
      const depCheck = checkDependenciesSatisfied(step, runDir);
      return depCheck.ready;
    });
    if (readyStep) {
      nextAction = `NEXT: step ${readyStep.id} is ready`;
    } else if (pendingSteps.length > 0) {
      const blocking = pendingSteps[0];
      const depCheck = checkDependenciesSatisfied(blocking, runDir);
      const reason = depCheck.blocking
        ? depCheck.blocking
        : `waiting on dependencies for ${blocking.id}`;
      nextAction = `BLOCKED: step ${blocking.id} ${reason}`;
    } else if (counts.done + counts.skipped === plan.steps.length) {
      nextAction = "DONE: plan complete";
    }
  }

  console.log(nextAction);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    fail("Command is required.", { showUsage: true });
  }

  const command = args.shift();
  if (!command) {
    fail("Command parsing failed.", { showUsage: true });
  }

  if (["-h", "--help", "help"].includes(command)) {
    console.log(USAGE);
    process.exit(0);
  }

  if (command === "agent") {
    handleAgentCommand(args);
    return;
  }

  if (command === "flow") {
    handleFlowCommand(args);
    return;
  }

  if (command === "validate") {
    handleValidateCommand(args);
    return;
  }

  if (command === "retry") {
    handleRetryCommand(args);
    return;
  }

  if (command === "skip") {
    handleSkipCommand(args);
    return;
  }

  if (command === "status") {
    handleStatusCommand(args);
    return;
  }

  fail(`Unsupported command: ${command}`, { showUsage: true });
}

try {
  main();
} catch (error) {
  handleFatalError(error, USAGE);
}
