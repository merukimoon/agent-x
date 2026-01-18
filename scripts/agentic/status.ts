import { fail } from "./errors.ts";

/**
 * @typedef {import("./core.ts").Plan} Plan
 * @typedef {import("./core.ts").PlanStep} PlanStep
 * @typedef {import("./core.ts").StepStatus} StepStatus
 */

/** @type {Record<StepStatus, Set<StepStatus>>} */
const ALLOWED_TRANSITIONS = {
  pending: new Set(["running", "skipped"]),
  running: new Set(["done", "failed"]),
  done: new Set(),
  failed: new Set(["pending", "skipped"]),
  skipped: new Set(),
};

/**
 * Determine if a status transition is allowed.
 * @param {StepStatus} from
 * @param {StepStatus} to
 * @returns {boolean}
 */
export function isAllowedStatusTransition(from, to) {
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
 * @param {(planPath: string, plan: Plan) => void} persistPlan
 * @param {(step: PlanStep) => void} [mutator]
 */
export function applyStatusTransition(
  plan,
  stepId,
  nextStatus,
  planPath,
  persistPlan,
  mutator
) {
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
