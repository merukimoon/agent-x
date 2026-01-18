#!/usr/bin/env node
// @ts-check

import fs from "fs";
import path from "path";
import process from "process";

/**
 * @typedef {"coordinator" | "decision-maker" | "pr-reviewer" | "ciso"} AgentName
 */
/**
 * @typedef {"blocked" | "in_progress" | "done" | "failed"} AgentStatus
 */
/**
 * @typedef {"dry-run" | "live"} ExecutionMode
 */
/**
 * @typedef {"pending" | "running" | "done" | "failed" | "skipped"} StepStatus
 */
/**
 * @typedef {string} RunId
 */
/**
 * @typedef {{
 *   agent: AgentName;
 *   run_id: RunId;
 *   status: AgentStatus;
 *   created_at_utc: string;
 *   summary: string;
 *   mode: ExecutionMode;
 * }} AgentResult
 */
/**
 * @typedef {{
 *   agentName: AgentName;
 *   runId: RunId;
 *   createdAtUtc: string;
 *   mode: ExecutionMode;
 *   requestPath: string;
 *   contextPath: string;
 *   requestExcerpt: string[];
 *   contextExcerpt: string[];
 * }} BuildNotesParams
 */
/**
 * @typedef {{
 *   id: string;
 *   agent: AgentName;
 *   depends_on: AgentName[];
 *   inputs: {
 *     request: string;
 *     context: string;
 *     prior_outputs: string[];
 *   };
 *   outputs: {
 *     result: string;
 *     notes: string;
 *   };
 *   status: StepStatus;
 *   attempt: number;
 *   max_attempts: number;
 *   last_error: string | null;
 *   allow_skip: boolean;
 * }} PlanStep
 */
/**
 * @typedef {{
 *   run_id: RunId;
 *   created_at_utc: string;
 *   version: string;
 *   steps: PlanStep[];
 * }} Plan
 */

const PLAN_VERSION = "0.1";

/** @type {Set<AgentName>} */
const VALID_AGENTS = new Set([
  "coordinator",
  "decision-maker",
  "pr-reviewer",
  "ciso",
]);

const USAGE = [
  "Usage:",
  "  node scripts/agentic.mjs agent <agentName> --run <RUN_ID> [--dry-run]",
  "  node scripts/agentic.mjs flow --run <RUN_ID> [--dry-run]",
  "  node scripts/agentic.mjs validate --run <RUN_ID>",
  "  node scripts/agentic.mjs retry --run <RUN_ID> --step <STEP_ID>",
  "  node scripts/agentic.mjs skip --run <RUN_ID> --step <STEP_ID>",
  "  node scripts/agentic.mjs status --run <RUN_ID>",
].join("\n");

class CLIError extends Error {
  /**
   * @param {string} message
   * @param {{ exitCode?: number; showUsage?: boolean }} [options]
   */
  constructor(message, options) {
    super(message);
    this.name = "CLIError";
    this.exitCode = options?.exitCode ?? 2;
    this.showUsage = options?.showUsage ?? false;
  }
}

/**
 * Raise a CLI error.
 * @param {string} message
 * @param {{ showUsage?: boolean; exitCode?: number }} [options]
 * @returns {never}
 */
function fail(message, options) {
  throw new CLIError(message, options);
}

/**
 * Determine whether a value is a supported agent name.
 * @param {string} value
 * @returns {value is AgentName}
 */
function isAgentName(value) {
  return VALID_AGENTS.has(/** @type {AgentName} */ (value));
}

/**
 * Determine whether a value is a valid step status.
 * @param {string} value
 * @returns {value is StepStatus}
 */
function isStepStatus(value) {
  return (
    value === "pending" ||
    value === "running" ||
    value === "done" ||
    value === "failed" ||
    value === "skipped"
  );
}

/**
 * Read the first N lines from a file.
 * @param {string} filePath
 * @param {number} lineCount
 * @returns {string[]}
 */
function readFirstLines(filePath, lineCount) {
  try {
    const contents = fs.readFileSync(filePath, "utf8");
    const lines = contents.split(/\r?\n/);
    return lines.slice(0, lineCount);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Unable to read file: ${filePath}. ${reason}`);
  }
}

/**
 * Format a labeled excerpt as Markdown.
 * @param {string} label
 * @param {string[]} lines
 * @returns {string}
 */
function formatExcerpt(label, lines) {
  const safeLines = lines.length > 0 ? lines : ["(file empty)"];
  const quoted = safeLines.map((line) => `> ${line}`);
  return [`## ${label} (first 20 lines)`, ...quoted, ""].join("\n");
}

/**
 * Get canonical outputs paths for an agent.
 * @param {AgentName} agent
 * @returns {{ result: string; notes: string }}
 */
function getCanonicalOutputs(agent) {
  return {
    result: `outputs/${agent}/result.json`,
    notes: `outputs/${agent}/notes.md`,
  };
}

/**
 * Ensure the outputs paths follow the canonical layout for an agent.
 * @param {PlanStep} step
 */
function validateCanonicalOutputs(step) {
  const expected = getCanonicalOutputs(step.agent);
  if (
    step.outputs.result !== expected.result ||
    step.outputs.notes !== expected.notes
  ) {
    fail(
      `Step ${step.id} outputs must match canonical layout. Expected result=${expected.result}, notes=${expected.notes}.`
    );
  }
}

/**
 * Build agent notes content.
 * @param {BuildNotesParams} params
 * @returns {string}
 */
function buildNotes({
  agentName,
  runId,
  createdAtUtc,
  mode,
  requestPath,
  contextPath,
  requestExcerpt,
  contextExcerpt,
}) {
  const modeDescription =
    mode === "dry-run" ? "dry-run (no external actions performed)" : mode;
  const summaryLines = [
    `- Agent: ${agentName}`,
    `- Run: ${runId}`,
    `- Mode: ${modeDescription}`,
    `- Created at (UTC): ${createdAtUtc}`,
    `- Inputs: ${requestPath}, ${contextPath}`,
  ];

  return [
    `# Agent: ${agentName}`,
    "",
    "Summary:",
    ...summaryLines,
    "",
    formatExcerpt("request.md", requestExcerpt),
    formatExcerpt("context.md", contextExcerpt),
  ].join("\n");
}

/**
 * Validate that run directory and inputs exist.
 * @param {string} runDir
 */
function ensureRunAndInputs(runDir) {
  if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
    fail(`Run directory not found: ${runDir}`);
  }

  const requestPath = path.join(runDir, "inputs", "request.md");
  const contextPath = path.join(runDir, "inputs", "context.md");

  [requestPath, contextPath].forEach((filePath) => {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      fail(`Input file not found: ${filePath}`);
    }
  });
}

/**
 * Write JSON to disk with trailing newline.
 * @param {string} filePath
 * @param {unknown} data
 */
function writeJsonFile(filePath, data) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(filePath, serialized, "utf8");
}

/**
 * Build a default plan for dry-run or live runs.
 * @param {RunId} runId
 * @param {string} createdAtUtc
 * @returns {Plan}
 */
function buildDefaultPlan(runId, createdAtUtc) {
  const request = "inputs/request.md";
  const context = "inputs/context.md";

  /** @type {PlanStep[]} */
  const steps = [
    {
      id: "step-1",
      agent: "decision-maker",
      depends_on: ["coordinator"],
      inputs: {
        request,
        context,
        prior_outputs: [
          "outputs/coordinator/result.json",
          "outputs/coordinator/notes.md",
        ],
      },
      outputs: getCanonicalOutputs("decision-maker"),
      status: "pending",
      attempt: 0,
      max_attempts: 1,
      last_error: null,
      allow_skip: true,
    },
    {
      id: "step-2",
      agent: "pr-reviewer",
      depends_on: ["decision-maker"],
      inputs: {
        request,
        context,
        prior_outputs: [
          "outputs/decision-maker/result.json",
          "outputs/decision-maker/notes.md",
        ],
      },
      outputs: getCanonicalOutputs("pr-reviewer"),
      status: "pending",
      attempt: 0,
      max_attempts: 1,
      last_error: null,
      allow_skip: true,
    },
    {
      id: "step-3",
      agent: "ciso",
      depends_on: ["pr-reviewer"],
      inputs: {
        request,
        context,
        prior_outputs: [
          "outputs/pr-reviewer/result.json",
          "outputs/pr-reviewer/notes.md",
        ],
      },
      outputs: getCanonicalOutputs("ciso"),
      status: "pending",
      attempt: 0,
      max_attempts: 1,
      last_error: null,
      allow_skip: true,
    },
  ];

  return {
    run_id: runId,
    created_at_utc: createdAtUtc,
    version: PLAN_VERSION,
    steps,
  };
}

/**
 * Validate a parsed plan object and return it if valid.
 * @param {unknown} candidate
 * @param {RunId} expectedRunId
 * @returns {Plan}
 */
function validatePlan(candidate, expectedRunId) {
  if (!candidate || typeof candidate !== "object") {
    fail("plan.json is invalid: expected an object.");
  }

  const plan = /** @type {Partial<Plan>} */ (candidate);

  if (!plan.run_id || plan.run_id !== expectedRunId) {
    fail(
      `plan.json run_id mismatch. Expected ${expectedRunId}, found ${plan.run_id}.`
    );
  }

  if (!plan.version || plan.version !== PLAN_VERSION) {
    fail(
      `plan.json version mismatch. Expected ${PLAN_VERSION}, found ${plan.version}.`
    );
  }

  if (!plan.created_at_utc || typeof plan.created_at_utc !== "string") {
    fail("plan.json missing created_at_utc.");
  }

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    fail("plan.json must include at least one step.");
  }

  plan.steps.forEach((step, index) => {
    if (!step || typeof step !== "object") {
      fail(`plan.json step at index ${index} is invalid.`);
    }
    if (!step.id || typeof step.id !== "string") {
      fail(`plan.json step ${index} missing id.`);
    }
    if (!isAgentName(step.agent)) {
      fail(
        `plan.json step ${step.id} has invalid agent: ${String(step.agent)}.`
      );
    }
    if (!Array.isArray(step.depends_on)) {
      fail(`plan.json step ${step.id} depends_on must be an array.`);
    }
    step.depends_on.forEach((dep) => {
      if (!isAgentName(dep)) {
        fail(`plan.json step ${step.id} has invalid dependency: ${dep}.`);
      }
    });
    if (!step.inputs || typeof step.inputs !== "object") {
      fail(`plan.json step ${step.id} missing inputs.`);
    }
    if (
      !step.inputs?.request ||
      typeof step.inputs.request !== "string" ||
      !step.inputs?.context ||
      typeof step.inputs.context !== "string"
    ) {
      fail(`plan.json step ${step.id} inputs.request/context must be strings.`);
    }
    if (
      !Array.isArray(step.inputs.prior_outputs) ||
      step.inputs.prior_outputs.some((p) => typeof p !== "string")
    ) {
      fail(`plan.json step ${step.id} inputs.prior_outputs must be strings.`);
    }
    if (!step.outputs || typeof step.outputs !== "object") {
      fail(`plan.json step ${step.id} missing outputs.`);
    }
    if (
      typeof step.outputs.result !== "string" ||
      typeof step.outputs.notes !== "string"
    ) {
      fail(`plan.json step ${step.id} outputs.result/notes must be strings.`);
    }
    if (!isStepStatus(step.status)) {
      fail(
        `plan.json step ${step.id} has invalid status: ${String(step.status)}.`
      );
    }
    if (
      typeof step.attempt !== "number" ||
      !Number.isInteger(step.attempt) ||
      step.attempt < 0
    ) {
      fail(`plan.json step ${step.id} attempt must be a non-negative integer.`);
    }
    if (
      typeof step.max_attempts !== "number" ||
      !Number.isInteger(step.max_attempts) ||
      step.max_attempts < 1
    ) {
      fail(`plan.json step ${step.id} max_attempts must be an integer >= 1.`);
    }
    if (step.last_error !== null && typeof step.last_error !== "string") {
      fail(`plan.json step ${step.id} last_error must be null or string.`);
    }
    if (typeof step.allow_skip !== "boolean") {
      fail(`plan.json step ${step.id} allow_skip must be boolean.`);
    }
    validateCanonicalOutputs(/** @type {PlanStep} */ (step));
  });

  return /** @type {Plan} */ (plan);
}

/**
 * Validate plan references against the filesystem and layout.
 * @param {Plan} plan
 * @param {string} runDir
 * @returns {string[]} List of validation errors.
 */
function validatePlanFiles(plan, runDir) {
  /** @type {string[]} */
  const errors = [];
  const requestPath = path.join(runDir, "inputs", "request.md");
  const contextPath = path.join(runDir, "inputs", "context.md");

  if (!fs.existsSync(requestPath)) {
    errors.push(`Missing input: ${requestPath}`);
  }
  if (!fs.existsSync(contextPath)) {
    errors.push(`Missing input: ${contextPath}`);
  }

  const stepByAgent = new Map();
  plan.steps.forEach((step) => {
    if (!stepByAgent.has(step.agent)) {
      stepByAgent.set(step.agent, step);
    }
  });

  /**
   * Determine whether a dependency output is expected to exist now.
   * @param {AgentName} agent
   * @returns {boolean}
   */
  const shouldRequireDependencyOutput = (agent) => {
    if (agent === "coordinator") {
      return true;
    }
    const depStep = stepByAgent.get(agent);
    if (!depStep) {
      errors.push(`Dependency agent ${agent} not found in plan steps.`);
      return false;
    }
    return depStep.status === "done";
  };

  plan.steps.forEach((step) => {
    const expected = getCanonicalOutputs(step.agent);
    if (
      step.outputs.result !== expected.result ||
      step.outputs.notes !== expected.notes
    ) {
      errors.push(
        `Step ${step.id} outputs must match canonical layout (expected ${expected.result} and ${expected.notes}).`
      );
    }
    if (step.inputs.request !== "inputs/request.md") {
      errors.push(`Step ${step.id} inputs.request must be inputs/request.md.`);
    }
    if (step.inputs.context !== "inputs/context.md") {
      errors.push(`Step ${step.id} inputs.context must be inputs/context.md.`);
    }

    step.inputs.prior_outputs.forEach((relPath) => {
      const fullPath = path.join(runDir, relPath);
      const match = relPath.match(/^outputs\/([^/]+)\/(result\.json|notes\.md)$/);
      const depAgent = match && isAgentName(match[1]) ? /** @type {AgentName} */ (match[1]) : null;
      const mustExist = depAgent ? shouldRequireDependencyOutput(depAgent) : true;
      if (mustExist) {
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
          errors.push(
            `Step ${step.id} prior output missing: ${fullPath} (from ${relPath}).`
          );
        }
      }
    });

    step.depends_on.forEach((dep) => {
      const depResult = path.join(runDir, getCanonicalOutputs(dep).result);
      const mustExist = shouldRequireDependencyOutput(dep);
      if (mustExist) {
        if (!fs.existsSync(depResult) || !fs.statSync(depResult).isFile()) {
          errors.push(
            `Step ${step.id} dependency missing result: ${depResult} (dependency ${dep}).`
          );
        }
      }
    });
  });

  return errors;
}

/**
 * Load plan.json from disk.
 * @param {string} planPath
 * @param {RunId} runId
 * @returns {Plan}
 */
function loadPlan(planPath, runId) {
  try {
    const raw = fs.readFileSync(planPath, "utf8");
    const parsed = JSON.parse(raw);
    return validatePlan(parsed, runId);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Failed to read or parse plan.json at ${planPath}: ${reason}`);
  }
}

/**
 * Write the plan to disk.
 * @param {string} planPath
 * @param {Plan} plan
 */
function persistPlan(planPath, plan) {
  writeJsonFile(planPath, plan);
}

/**
 * Update the status of a plan step and persist.
 * @param {Plan} plan
 * @param {string} stepId
 * @param {StepStatus} status
 * @param {string} planPath
 */
function updatePlanStepStatus(plan, stepId, status, planPath) {
  const target = plan.steps.find((step) => step.id === stepId);
  if (!target) {
    fail(`Step ${stepId} not found in plan.`);
  }
  target.status = status;
  persistPlan(planPath, plan);
}

/**
 * Update a plan step with a mutator and persist.
 * @param {Plan} plan
 * @param {string} stepId
 * @param {(step: PlanStep) => void} mutator
 * @param {string} planPath
 */
function updatePlanStep(plan, stepId, mutator, planPath) {
  const target = plan.steps.find((step) => step.id === stepId);
  if (!target) {
    fail(`Step ${stepId} not found in plan.`);
  }
  mutator(target);
  persistPlan(planPath, plan);
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
  fs.writeFileSync(notesPath, notes, "utf8");

  if (agentName === "coordinator") {
    const planPath = path.join(runDir, "plan.json");
    const plan = buildDefaultPlan(runId, createdAtUtc);
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
 * Ensure all dependency outputs exist before running a step.
 * @param {PlanStep} step
 * @param {string} runDir
 */
function ensureDependencies(step, runDir) {
  step.depends_on.forEach((agent) => {
    const depResult = path.join(runDir, "outputs", agent, "result.json");
    if (!fs.existsSync(depResult) || !fs.statSync(depResult).isFile()) {
      fail(
        `Dependency result missing for ${agent} at ${depResult}. Cannot run ${step.id}.`
      );
    }
  });
}

/**
 * Execute steps defined in plan.json in order.
 * @param {RunId} runId
 * @param {ExecutionMode} mode
 */
function runFlow(runId, mode) {
  const runDir = path.join(process.cwd(), "runs", runId);
  ensureRunAndInputs(runDir);

  const planPath = path.join(runDir, "plan.json");

  if (!fs.existsSync(planPath)) {
    console.log("plan.json not found; running coordinator to generate plan.");
    runAgent("coordinator", runId, mode);
  }

  let plan = loadPlan(planPath, runId);

  const validationErrors = validatePlanFiles(plan, runDir);
  if (validationErrors.length > 0) {
    console.error("Validation failed:");
    validationErrors.forEach((err) => console.error(`- ${err}`));
    process.exit(3);
  }

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

    if (step.attempt >= step.max_attempts) {
      fail(
        `Step ${step.id} has reached max attempts (${step.attempt}/${step.max_attempts}). Use retry or skip to continue.`
      );
    }

    ensureDependencies(step, runDir);

    updatePlanStep(plan, step.id, (s) => {
      if (s.attempt < 1) {
        s.attempt = 1;
      }
      s.status = "running";
      s.last_error = null;
    }, planPath);
    plan = loadPlan(planPath, runId);

    try {
      runAgent(step.agent, runId, mode);
      updatePlanStep(plan, step.id, (s) => {
        s.status = "done";
        s.last_error = null;
      }, planPath);
      plan = loadPlan(planPath, runId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const truncated = reason.replace(/\s+/g, " ").slice(0, 200);
      updatePlanStep(plan, step.id, (s) => {
        s.status = "failed";
        s.last_error = truncated;
      }, planPath);
      throw error;
    }
  });

  const summary = plan.steps
    .map((step) => `${step.id}:${step.agent}=${step.status}`)
    .join(", ");
  console.log(`Flow complete for run ${runId}. Steps: ${summary}`);
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
  ensureRunAndInputs(runDir);
  const planPath = path.join(runDir, "plan.json");
  if (!fs.existsSync(planPath) || !fs.statSync(planPath).isFile()) {
    fail(`plan.json not found at ${planPath}`);
  }
  const plan = loadPlan(planPath, parsed.runId);
  const errors = validatePlanFiles(plan, runDir);
  if (errors.length > 0) {
    console.error("Validation failed:");
    errors.forEach((err) => console.error(`- ${err}`));
    process.exit(3);
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
  updatePlanStep(plan, target.id, (s) => {
    s.status = "pending";
    s.attempt += 1;
    s.last_error = null;
  }, planPath);
  console.log(`Step ${target.id} marked pending for retry (attempt ${target.attempt}/${target.max_attempts}).`);
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
  updatePlanStep(plan, target.id, (s) => {
    s.status = "skipped";
    s.last_error = null;
  }, planPath);
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
  if (!fs.existsSync(planPath)) {
    fail(`plan.json not found at ${planPath}`);
  }
  const plan = loadPlan(planPath, parsed.runId);
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
  console.log(`Run: ${parsed.runId}`);
  console.log(
    `Plan: total=${plan.steps.length} pending=${counts.pending} running=${counts.running} done=${counts.done} failed=${counts.failed} skipped=${counts.skipped}`
  );
  console.log("Steps:");
  plan.steps.forEach((step) => {
    console.log(
      `- ${step.id} | ${step.agent} | ${step.status} | attempt ${step.attempt}/${step.max_attempts}`
    );
  });
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
  if (error instanceof CLIError) {
    console.error(`ERROR: ${error.message}`);
    if (error.showUsage) {
      console.error(USAGE);
    }
    process.exit(error.exitCode);
  } else {
    console.error("ERROR: Unexpected failure.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}
