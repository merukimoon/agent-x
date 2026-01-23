// @ts-check

import fs from "fs";
import path from "path";
import {
  PLAN_VERSION,
  isAgentName,
  isStepStatus,
  getCanonicalOutputs,
} from "./core.ts";
import { fail } from "./errors.ts";
import { writeJsonFile } from "./fs.ts";
// import { getCanonicalOutputs } from "./agents.ts"; // Moved to core

/**
 * Validate a parsed plan object and return it if valid.
 * @param {unknown} candidate
 * @param {import("./core.ts").RunId} expectedRunId
 * @returns {import("./core.ts").Plan}
 */
export function validatePlan(candidate, expectedRunId) {
  const { plan, schemaErrors } = gatherPlanSchemaErrors(candidate, expectedRunId);
  if (schemaErrors.length > 0) {
    fail(schemaErrors[0]);
  }
  return plan;
}

/**
 * Gather schema and invariant errors without throwing.
 * @param {unknown} candidate
 * @param {import("./core.ts").RunId} expectedRunId
 * @returns {{ plan: import("./core.ts").Plan; schemaErrors: string[] }}
 */
export function gatherPlanSchemaErrors(candidate, expectedRunId) {
  const plan = /** @type {Partial<import("./core.ts").Plan>} */ (candidate);
  /** @type {string[]} */
  const errors = [];

  if (!candidate || typeof candidate !== "object") {
    errors.push("plan.json is invalid: expected an object.");
    return { plan: /** @type {import("./core.ts").Plan} */ (plan), schemaErrors: errors };
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
  if (!Array.isArray(plan.signals)) {
    errors.push("plan.json signals missing or not an array.");
  }
  if (
    plan.confidence !== "high" &&
    plan.confidence !== "medium" &&
    plan.confidence !== "low"
  ) {
    errors.push("plan.json confidence missing or invalid (expected high|medium|low).");
  }
  if (Array.isArray(plan.signals) && plan.signals.length === 0 && plan.confidence !== "low") {
    errors.push("plan.json signals empty but confidence is not low.");
  }

  /** @type {Set<string>} */
  const stepIds = new Set();

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
        if (typeof dep !== "string") {
          errors.push(
            `plan.json step ${step.id ?? index} has invalid dependency: ${String(
              dep
            )}.`
          );
          return;
        }
        if (!stepIds.has(dep)) {
          errors.push(
            `plan.json step ${step.id ?? index} has invalid dependency: ${dep}.`
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

  return { plan: /** @type {import("./core.ts").Plan} */ (plan), schemaErrors: errors };
}

/**
 * Perform validation and classify errors.
 * @param {import("./core.ts").RunId} runId
 * @param {string} runDir
 * @param {string} planPath
 * @returns {{ plan: import("./core.ts").Plan | null; schemaErrors: string[]; missingPaths: string[]; planLoadError: string | null }}
 */
export function runValidationChecks(runId, runDir, planPath) {
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
 * @param {import("./core.ts").Plan} plan
 * @param {string} runDir
 * @returns {string[]} List of validation errors.
 */
export function validatePlanFiles(plan, runDir) {
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

  /** @type {Map<import("./core.ts").AgentName, import("./core.ts").StepStatus>} */
  const statusByAgent = new Map();
  plan.steps.forEach((step) => {
    statusByAgent.set(step.agent, step.status);
  });

  /**
   * Determine whether dependency outputs must exist now.
   * - Coordinator dependencies are always required.
   * - Other agents are required when their status is not pending.
   * @param {import("./core.ts").AgentName} agent
   * @returns {boolean}
   */
  const mustRequireDependency = (agent) => {
    if (agent === "coordinator") {
      return true;
    }
    const status = statusByAgent.get(agent);
    if (!status) {
      return false;
    }
    return status !== "pending";
  };

  plan.steps.forEach((step) => {
    step.inputs.prior_outputs.forEach((relPath) => {
      const fullPath = path.join(runDir, relPath);
      const match = relPath.match(/^outputs\/([^/]+)\/(result\.json|notes\.md)$/);
      const depAgent =
        match && isAgentName(match[1]) ? /** @type {import("./core.ts").AgentName} */ (match[1]) : null;
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
 * @param {import("./core.ts").RunId} runId
 * @returns {import("./core.ts").Plan}
 */
export function loadPlan(planPath, runId) {
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
* @param {import("./core.ts").Plan} plan
*/
export function persistPlan(planPath, plan) {
  writeJsonFile(planPath, plan);
}
