import path from "path";
import process from "process";

export type AgentName = "coordinator" | "decision-maker" | "pr-reviewer" | "ciso" | "planner" | "architect";
export type AgentStatus = "blocked" | "in_progress" | "done" | "failed";
export type ExecutionMode = "dry-run" | "live";
export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type ConfidenceLevel = "high" | "medium" | "low";
export type RunId = string;

export interface AgentResult {
  agent: AgentName;
  run_id: RunId;
  status: AgentStatus;
  created_at_utc: string;
  summary: string;
  mode: ExecutionMode;
}

export interface BuildNotesParams {
  agentName: AgentName;
  runId: RunId;
  createdAtUtc: string;
  mode: ExecutionMode;
  requestPath: string;
  contextPath: string;
  requestExcerpt: string[];
  contextExcerpt: string[];
}

export interface PlanStep {
  id: string;
  agent: AgentName;
  depends_on: AgentName[];
  inputs: {
    request: string;
    context: string;
    prior_outputs: string[];
  };
  outputs: {
    result: string;
    notes: string;
  };
  status: StepStatus;
  attempt: number;
  max_attempts: number;
  last_error: string | null;
  allow_skip: boolean;
}

export interface RuleStep {
  id: string;
  agent: AgentName;
  depends_on: AgentName[];
  enabled_if_keywords?: string[];
}

export interface RulePack {
  flow_type: string;
  keywords: string[];
  steps: RuleStep[];
}

export interface Plan {
  run_id: RunId;
  created_at_utc: string;
  version: string;
  flow_type: string;
  rationale: string;
  signals: string[];
  confidence: ConfidenceLevel;
  steps: PlanStep[];
}

export interface ValidationResult {
  missingPaths: string[];
  schemaErrors: string[];
}

export const PLAN_VERSION = "0.1";
export const FLOW_PR_COMPLETION = "pr-completion";
export const FLOW_ARCH_CHANGE = "architecture-change";
export const RULES_DIR = path.join(process.cwd(), "rules", "flows");

export const VALID_AGENTS = new Set([
  "coordinator",
  "decision-maker",
  "pr-reviewer",
  "ciso",
  "planner",
  "architect",
]) as Set<AgentName>;

export const USAGE = [
  "Usage:",
  "  node scripts/agentic.js agent <agentName> --run <RUN_ID> [--dry-run]",
  "  node scripts/agentic.js flow --run <RUN_ID> [--dry-run]",
  "  node scripts/agentic.js validate --run <RUN_ID>",
  "  node scripts/agentic.js retry --run <RUN_ID> --step <STEP_ID>",
  "  node scripts/agentic.js skip --run <RUN_ID> --step <STEP_ID>",
  "  node scripts/agentic.js status --run <RUN_ID>",
].join("\n");

export function isAgentName(value: string): value is AgentName {
  return VALID_AGENTS.has(value as AgentName);
}

export function isStepStatus(value: string): value is StepStatus {
  return (
    value === "pending" ||
    value === "running" ||
    value === "done" ||
    value === "failed" ||
    value === "skipped"
  );
}
