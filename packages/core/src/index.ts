/**
 * @agentsquad/core
 * 
 * The Public API for the Agent Squad Core.
 * This package provides the fundamental types, constants, and contracts
 * shared across the framework (CLI, Agents, Tools).
 */

// Implementation is now hosted locally in packages/core/src
// We re-export only the stable public surface.
import * as Impl from "./types.js";

// --- Types ---
export type {
    AgentName,
    AgentStatus,
    ExecutionMode,
    StepStatus,
    ConfidenceLevel,
    RunId,
    AgentResult,
    BuildNotesParams,
    PlanStep,
    RuleStep,
    RulePack,
    Plan,
    ValidationResult
} from "./types.js";

export type {
    StepResult,
    DecisionAfterStep,
    StepOverride,
    ModelRef,
    ArtifactRef,
    CheckResult,
    ExecutionStatus
} from "../../contracts/src/index";

// --- Constants ---
export const PLAN_VERSION = Impl.PLAN_VERSION;
export const FLOW_PR_COMPLETION = Impl.FLOW_PR_COMPLETION;
export const FLOW_ARCH_CHANGE = Impl.FLOW_ARCH_CHANGE;
export const VALID_AGENTS = Impl.VALID_AGENTS;

// --- Helper Functions (Contracts) ---
export const isAgentName = Impl.isAgentName;
export const isStepStatus = Impl.isStepStatus;
export const getCanonicalOutputs = Impl.getCanonicalOutputs;
export const validateCanonicalOutputs = Impl.validateCanonicalOutputs;

export {
    getStepDir,
    getStepResultPath,
    getDecisionPath,
    getStepsIndexPath,
} from "./paths/steps.js";

export type {
    StepsIndex,
    StepsIndexEntry,
} from "./paths/steps.js";

export type {
    GatingPolicy,
    Strictness,
    GateOutcome,
} from "./policy/gating.js";

export {
    resolveStrictness,
    evaluateGates,
} from "./policy/gating.js";

export * from "./policy/orchestrator.js";

// --- Registry ---
export {
    loadRolesRegistry,
    requireExecutableRole,
} from "./registry.js";

export type {
    RoleEntry,
    RoleRegistry,
} from "./registry.js";

// --- Utilities (Migrated from scripts/agentic) ---
export * from "./errors.js";
export * from "./fs.js";
export * from "./lock.js";
export * from "./rules.js";
export * from "./plan.js";
export * from "./llm/config.js";
export * from "./llm/planner.js";

// --- Internal/Legacy (Exposed but use with caution) ---
export const RULES_DIR = Impl.RULES_DIR;
export const USAGE = Impl.USAGE; // Primarily for CLI use
