// @ts-check

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
 * @typedef {"high" | "medium" | "low"} ConfidenceLevel
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
 *   id: string;
 *   agent: AgentName;
 *   depends_on: AgentName[];
 *   enabled_if_keywords?: string[];
 * }} RuleStep
 */
/**
 * @typedef {{
 *   flow_type: string;
 *   keywords: string[];
 *   steps: RuleStep[];
 * }} RulePack
 */
/**
 * @typedef {{
 *   run_id: RunId;
 *   created_at_utc: string;
 *   version: string;
 *   flow_type: string;
 *   rationale: string;
 *   signals: string[];
 *   confidence: ConfidenceLevel;
 *   steps: PlanStep[];
 * }} Plan
 */
/**
 * @typedef {{
 *   missingPaths: string[];
 *   schemaErrors: string[];
 * }} ValidationResult
 */

export const PLAN_VERSION = "0.1";
export const FLOW_PR_COMPLETION = "pr-completion";
export const FLOW_ARCH_CHANGE = "architecture-change";
export const RULES_DIR = path.join(process.cwd(), "rules", "flows");

/** @type {Set<AgentName>} */
export const VALID_AGENTS = new Set([
  "coordinator",
  "decision-maker",
  "pr-reviewer",
  "ciso",
]);

export const USAGE = [
  "Usage:",
  "  node scripts/agentic.mjs agent <agentName> --run <RUN_ID> [--dry-run]",
  "  node scripts/agentic.mjs flow --run <RUN_ID> [--dry-run]",
  "  node scripts/agentic.mjs validate --run <RUN_ID>",
  "  node scripts/agentic.mjs retry --run <RUN_ID> --step <STEP_ID>",
  "  node scripts/agentic.mjs skip --run <RUN_ID> --step <STEP_ID>",
  "  node scripts/agentic.mjs status --run <RUN_ID>",
].join("\n");

/** @type {Record<StepStatus, Set<StepStatus>>} */
export const ALLOWED_TRANSITIONS = {
  pending: new Set(["running", "skipped"]),
  running: new Set(["done", "failed"]),
  done: new Set(),
  failed: new Set(["pending", "skipped"]),
  skipped: new Set(),
};

/**
 * Determine whether a value is a supported agent name.
 * @param {string} value
 * @returns {value is AgentName}
 */
export function isAgentName(value) {
  return VALID_AGENTS.has(/** @type {AgentName} */ (value));
}

/**
 * Determine whether a value is a valid step status.
 * @param {string} value
 * @returns {value is StepStatus}
 */
export function isStepStatus(value) {
  return (
    value === "pending" ||
    value === "running" ||
    value === "done" ||
    value === "failed" ||
    value === "skipped"
  );
}

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
