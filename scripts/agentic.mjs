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
 *   flow_type: string;
 *   rationale: string;
 *   steps: PlanStep[];
 * }} Plan
 */
/**
 * @typedef {{
 *   missingPaths: string[];
 *   schemaErrors: string[];
 * }} ValidationResult
 */

const PLAN_VERSION = "0.1";
const FLOW_PR_COMPLETION = "pr-completion";
const FLOW_ARCH_CHANGE = "architecture-change";
const PR_KEYWORDS = [
  "pull request",
  "pr",
  "review",
  "merge",
  "docs update",
  "documentation",
  "configuration change",
  "config change",
  "config",
  "change request",
];
const ARCH_KEYWORDS = [
  "architecture",
  "architectural",
  "design",
  "system change",
  "refactor",
  "scalability",
  "performance",
  "rearchitecture",
];
const SECURITY_KEYWORDS = [
  "security",
  "vulnerability",
  "secret",
  "token",
  "credential",
  "compliance",
  "ciso",
  "penetration",
  "data leak",
];

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

/** @type {Record<StepStatus, Set<StepStatus>>} */
const ALLOWED_TRANSITIONS = {
  pending: new Set(["running", "skipped"]),
  running: new Set(["done", "failed"]),
  done: new Set(),
  failed: new Set(["pending", "skipped"]),
  skipped: new Set(),
};

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
 * Read full file contents as UTF-8.
 * @param {string} filePath
 * @returns {string}
 */
function readFileText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
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
 * Uses atomic write (temp file + rename) to reduce partial writes.
 * @param {string} filePath
 * @param {string | Buffer} data
 */
function writeFileAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempName = `${path.basename(filePath)}.tmp.${process.pid}.${Date.now()}`;
  const tempPath = path.join(dir, tempName);
  fs.writeFileSync(tempPath, data, { encoding: typeof data === "string" ? "utf8" : undefined });
  let fd = -1;
  try {
    fd = fs.openSync(tempPath, "r");
    try {
      fs.fsyncSync(fd);
    } catch (error) {
      const code = /** @type {{ code?: string }} */ (error)?.code;
      if (code !== "EPERM" && code !== "EINVAL" && code !== "EACCES") {
        throw error;
      }
      // Best effort: ignore fsync portability errors on some platforms.
    }
  } finally {
    if (fd !== -1) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore close errors
      }
    }
  }
  fs.renameSync(tempPath, filePath);
}

/**
 * Write JSON with trailing newline via atomic write.
 * @param {string} filePath
 * @param {unknown} data
 */
function writeJsonFile(filePath, data) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  writeFileAtomic(filePath, serialized);
}

/**
 * Create a lock file for flow execution.
 * @param {string} runDir
 * @param {RunId} runId
 * @param {ExecutionMode} mode
 * @returns {string} lockPath
 */
function createFlowLock(runDir, runId, mode) {
  const lockPath = path.join(runDir, ".lock");
  if (fs.existsSync(lockPath)) {
    const existing = fs.readFileSync(lockPath, "utf8");
    fail(
      `Lock exists at ${lockPath}. Another flow may be running. If stale, remove the lock and retry. Contents:\n${existing}`
    );
  }
  const startedAt = new Date().toISOString();
  const content = [
    `pid=${process.pid}`,
    `started_at_utc=${startedAt}`,
    `command=flow run=${runId} mode=${mode}`,
    "",
  ].join("\n");
  try {
    fs.writeFileSync(lockPath, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Unable to create lock at ${lockPath}. ${reason}`);
  }
  return lockPath;
}

/**
 * Remove lock file if present.
 * @param {string} lockPath
 */
function removeLock(lockPath) {
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`WARN: Unable to remove lock ${lockPath}: ${reason}`);
  }
}

/**
 * Build a plan from a flow definition.
 * @param {RunId} runId
 * @param {string} createdAtUtc
 * @param {string} flowType
 * @param {string} rationale
 * @param {boolean} includeCiso
 * @returns {Plan}
 */
function buildPlanFromFlow(runId, createdAtUtc, flowType, rationale, includeCiso) {
  const request = "inputs/request.md";
  const context = "inputs/context.md";

  /** @type {PlanStep[]} */
  const steps = [];

  /** @type {PlanStep} */
  const decisionMakerStep = {
    id: "step-1",
    agent: /** @type {AgentName} */ ("decision-maker"),
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
  };
  steps.push(decisionMakerStep);

  /** @type {PlanStep} */
  const prReviewerStep = {
    id: "step-2",
    agent: /** @type {AgentName} */ ("pr-reviewer"),
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
  };
  steps.push(prReviewerStep);

  if (includeCiso) {
    /** @type {PlanStep} */
    const cisoStep = {
      id: "step-3",
      agent: /** @type {AgentName} */ ("ciso"),
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
    };
    steps.push(cisoStep);
  }

  return {
    run_id: runId,
    created_at_utc: createdAtUtc,
    version: PLAN_VERSION,
    flow_type: flowType,
    rationale,
    steps,
  };
}

/**
 * Find matching keywords in text.
 * @param {string} text
 * @param {string[]} keywords
 * @returns {string[]}
 */
function findKeywords(text, keywords) {
  const lower = text.toLowerCase();
  /** @type {string[]} */
  const found = [];
  const seen = new Set();
  keywords.forEach((keyword) => {
    const key = keyword.toLowerCase();
    if (!seen.has(key) && lower.includes(key)) {
      found.push(keyword);
      seen.add(key);
    }
  });
  return found;
}

/**
 * Classify flow based on request and context contents.
 * @param {string} requestText
 * @param {string} contextText
 * @returns {{ flowType: string; rationale: string; includeCiso: boolean }}
 */
function classifyFlow(requestText, contextText) {
  const combined = `${requestText}\n${contextText}`;
  const archHits = findKeywords(combined, ARCH_KEYWORDS);
  const prHits = findKeywords(combined, PR_KEYWORDS);
  const securityHits = findKeywords(combined, SECURITY_KEYWORDS);

  if (archHits.length > 0) {
    const rationale = `Detected architecture change flow via keywords: ${archHits.join(
      ", "
    )}.`;
    return {
      flowType: FLOW_ARCH_CHANGE,
      rationale,
      includeCiso: true,
    };
  }

  if (prHits.length > 0) {
    const rationale = `Detected PR completion flow via keywords: ${prHits.join(
      ", "
    )}.`;
    return {
      flowType: FLOW_PR_COMPLETION,
      rationale,
      includeCiso: securityHits.length > 0,
    };
  }

  fail("Unable to classify request into a known flow type.");
}

/**
 * Validate a parsed plan object and return it if valid.
 * @param {unknown} candidate
 * @param {RunId} expectedRunId
 * @returns {Plan}
 */
function validatePlan(candidate, expectedRunId) {
  const { plan, schemaErrors } = gatherPlanSchemaErrors(candidate, expectedRunId);
  if (schemaErrors.length > 0) {
    fail(schemaErrors[0]);
  }
  return plan;
}

/**
 * Gather schema and invariant errors without throwing.
 * @param {unknown} candidate
 * @param {RunId} expectedRunId
 * @returns {{ plan: Plan; schemaErrors: string[] }}
 */
function gatherPlanSchemaErrors(candidate, expectedRunId) {
  const plan = /** @type {Partial<Plan>} */ (candidate);
  /** @type {string[]} */
  const errors = [];

  if (!candidate || typeof candidate !== "object") {
    errors.push("plan.json is invalid: expected an object.");
    return { plan: /** @type {Plan} */ (plan), schemaErrors: errors };
  }

  if (!plan.run_id || plan.run_id !== expectedRunId) {
    errors.push(
      `plan.json run_id mismatch. Expected ${expectedRunId}, found ${String(
        plan.run_id
      )}.`
    );
  }

  if (!plan.version || typeof plan.version !== "string") {
    errors.push("plan.json version missing or not a string.");
  } else if (plan.version !== PLAN_VERSION) {
    errors.push(
      `plan.json version mismatch. Expected ${PLAN_VERSION}, found ${plan.version}.`
    );
  }

  if (!plan.created_at_utc || typeof plan.created_at_utc !== "string") {
    errors.push("plan.json missing created_at_utc.");
  }

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    errors.push("plan.json must include at least one step.");
  }

  if (!plan.flow_type || typeof plan.flow_type !== "string") {
    errors.push("plan.json flow_type missing or not a string.");
  }
  if (!plan.rationale || typeof plan.rationale !== "string") {
    errors.push("plan.json rationale missing or not a string.");
  }

  /** @type {Set<string>} */
  const stepIds = new Set();
  /** @type {Set<AgentName>} */
  const agentsInPlan = new Set();
  if (Array.isArray(plan.steps)) {
    plan.steps.forEach((step) => {
      if (step && typeof step === "object" && isAgentName(step.agent)) {
        agentsInPlan.add(step.agent);
      }
    });
  }

  plan.steps?.forEach((step, index) => {
    if (!step || typeof step !== "object") {
      errors.push(`plan.json step at index ${index} is invalid.`);
      return;
    }
    if (!step.id || typeof step.id !== "string") {
      errors.push(`plan.json step ${index} missing id.`);
    } else {
      if (stepIds.has(step.id)) {
        errors.push(`plan.json step id is duplicated: ${step.id}.`);
      }
      stepIds.add(step.id);
    }
    if (!isAgentName(step.agent)) {
      errors.push(
        `plan.json step ${step.id ?? index} has invalid agent: ${String(
          step.agent
        )}.`
      );
    }
    if (!Array.isArray(step.depends_on)) {
      errors.push(`plan.json step ${step.id ?? index} depends_on must be an array.`);
    } else {
      step.depends_on.forEach((dep) => {
        if (!isAgentName(dep)) {
          errors.push(
            `plan.json step ${step.id ?? index} has invalid dependency: ${String(
              dep
            )}.`
          );
          return;
        }
        if (dep !== "coordinator" && !agentsInPlan.has(dep)) {
          errors.push(
            `plan.json step ${step.id ?? index} depends on unknown agent: ${dep}.`
          );
        }
      });
    }
    if (!step.inputs || typeof step.inputs !== "object") {
      errors.push(`plan.json step ${step.id ?? index} missing inputs.`);
    } else {
      if (
        !step.inputs?.request ||
        typeof step.inputs.request !== "string" ||
        !step.inputs?.context ||
        typeof step.inputs.context !== "string"
      ) {
        errors.push(
          `plan.json step ${step.id ?? index} inputs.request/context must be strings.`
        );
      } else {
        if (step.inputs.request !== "inputs/request.md") {
          errors.push(
            `plan.json step ${step.id ?? index} inputs.request must be inputs/request.md.`
          );
        }
        if (step.inputs.context !== "inputs/context.md") {
          errors.push(
            `plan.json step ${step.id ?? index} inputs.context must be inputs/context.md.`
          );
        }
      }
      if (
        !Array.isArray(step.inputs.prior_outputs) ||
        step.inputs.prior_outputs.some((p) => typeof p !== "string")
      ) {
        errors.push(
          `plan.json step ${step.id ?? index} inputs.prior_outputs must be strings.`
        );
      }
    }
    if (!step.outputs || typeof step.outputs !== "object") {
      errors.push(`plan.json step ${step.id ?? index} missing outputs.`);
    } else {
      if (
        typeof step.outputs.result !== "string" ||
        typeof step.outputs.notes !== "string"
      ) {
        errors.push(
          `plan.json step ${step.id ?? index} outputs.result/notes must be strings.`
        );
      } else if (isAgentName(step.agent)) {
        const expected = getCanonicalOutputs(step.agent);
        if (
          step.outputs.result !== expected.result ||
          step.outputs.notes !== expected.notes
        ) {
          errors.push(
            `plan.json step ${step.id ?? index} outputs must match canonical layout (${expected.result}, ${expected.notes}).`
          );
        }
      }
    }
    if (!isStepStatus(step.status)) {
      errors.push(
        `plan.json step ${step.id ?? index} has invalid status: ${String(
          step.status
        )}.`
      );
    }
    if (
      typeof step.attempt !== "number" ||
      !Number.isInteger(step.attempt) ||
      step.attempt < 0
    ) {
      errors.push(
        `plan.json step ${step.id ?? index} attempt must be a non-negative integer.`
      );
    }
    if (
      typeof step.max_attempts !== "number" ||
      !Number.isInteger(step.max_attempts) ||
      step.max_attempts < 1
    ) {
      errors.push(
        `plan.json step ${step.id ?? index} max_attempts must be an integer >= 1.`
      );
    }
    if (step.last_error !== null && typeof step.last_error !== "string") {
      errors.push(
        `plan.json step ${step.id ?? index} last_error must be null or string.`
      );
    }
    if (typeof step.allow_skip !== "boolean") {
      errors.push(`plan.json step ${step.id ?? index} allow_skip must be boolean.`);
    }
  });

  return { plan: /** @type {Plan} */ (plan), schemaErrors: errors };
}

/**
 * Perform validation and classify errors.
 * @param {RunId} runId
 * @param {string} runDir
 * @param {string} planPath
 * @returns {{ plan: Plan | null; schemaErrors: string[]; missingPaths: string[]; planLoadError: string | null }}
 */
function runValidationChecks(runId, runDir, planPath) {
  if (!fs.existsSync(planPath) || !fs.statSync(planPath).isFile()) {
    return {
      plan: null,
      schemaErrors: [],
      missingPaths: [],
      planLoadError: `plan.json not found at ${planPath}`,
    };
  }

  let parsed;
  try {
    const raw = fs.readFileSync(planPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      plan: null,
      schemaErrors: [],
      missingPaths: [],
      planLoadError: `plan.json invalid JSON at ${planPath}: ${reason}`,
    };
  }

  const { plan, schemaErrors } = gatherPlanSchemaErrors(parsed, runId);
  if (schemaErrors.length > 0) {
    return { plan: null, schemaErrors, missingPaths: [], planLoadError: null };
  }

  const missingPaths = validatePlanFiles(plan, runDir);
  return { plan, schemaErrors: [], missingPaths, planLoadError: null };
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

  /** @type {Map<AgentName, StepStatus>} */
  const statusByAgent = new Map();
  plan.steps.forEach((step) => {
    statusByAgent.set(step.agent, step.status);
  });

  /**
   * Determine whether dependency outputs must exist now.
   * - Coordinator dependencies are always required.
   * - Other agents are required when their status is not pending.
   * @param {AgentName} agent
   * @returns {boolean}
   */
  const mustRequireDependency = (agent) => {
    if (agent === "coordinator") {
      return true;
    }
    const status = statusByAgent.get(agent);
    if (!status) {
      errors.push(`Dependency agent ${agent} not found in plan steps.`);
      return false;
    }
    return status !== "pending";
  };

  plan.steps.forEach((step) => {
    step.inputs.prior_outputs.forEach((relPath) => {
      const fullPath = path.join(runDir, relPath);
      const match = relPath.match(/^outputs\/([^/]+)\/(result\.json|notes\.md)$/);
      const depAgent =
        match && isAgentName(match[1]) ? /** @type {AgentName} */ (match[1]) : null;
      const requireNow = depAgent ? mustRequireDependency(depAgent) : true;
      if (requireNow) {
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
          errors.push(
            `Step ${step.id} prior output missing: ${fullPath} (from ${relPath}).`
          );
        }
      }
    });

    step.depends_on.forEach((dep) => {
      const depResult = path.join(runDir, getCanonicalOutputs(dep).result);
      const requireNow = mustRequireDependency(dep);
      if (requireNow) {
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
 * Determine if a status transition is allowed.
 * @param {StepStatus} from
 * @param {StepStatus} to
 * @returns {boolean}
 */
function isAllowedStatusTransition(from, to) {
  if (from === to) {
    return true;
  }
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.has(to) : false;
}

/**
 * Apply a status transition with optional mutation and persist atomically.
 * @param {Plan} plan
 * @param {string} stepId
 * @param {StepStatus} nextStatus
 * @param {string} planPath
 * @param {(step: PlanStep) => void} [mutator]
 */
function applyStatusTransition(plan, stepId, nextStatus, planPath, mutator) {
  const target = plan.steps.find((step) => step.id === stepId);
  if (!target) {
    fail(`Step ${stepId} not found in plan.`);
  }
  const current = target.status;
  if (!isAllowedStatusTransition(current, nextStatus)) {
    fail(
      `Invalid status transition for step ${stepId}: ${current} -> ${nextStatus}.`
    );
  }
  if (mutator) {
    mutator(target);
  }
  target.status = nextStatus;
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
  writeFileAtomic(notesPath, notes);

  if (agentName === "coordinator") {
    const planPath = path.join(runDir, "plan.json");
    const requestText = readFileText(requestPath);
    const contextText = readFileText(contextPath);
    const classification = classifyFlow(requestText, contextText);
    const plan = buildPlanFromFlow(
      runId,
      createdAtUtc,
      classification.flowType,
      classification.rationale,
      classification.includeCiso
    );
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
