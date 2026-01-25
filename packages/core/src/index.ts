/**
 * @agentsquad/core
 * 
 * The Public API for the Agent Squad Core.
 * This package provides the fundamental types, constants, and contracts
 * shared across the framework (CLI, Agents, Tools).
 */

// Implementation is currently hosted in scripts/agentic/core.ts
// We re-export only the stable public surface.
import * as Impl from "../../../scripts/agentic/core.ts";

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
} from "../../../scripts/agentic/core.ts";

export type {
    StepResult,
    DecisionAfterStep,
    StepOverride,
    ModelRef,
    ArtifactRef,
    CheckResult,
    ExecutionStatus
} from "../../contracts/src/index.ts";

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
} from "./paths/steps.ts";

export type {
    StepsIndex,
    StepsIndexEntry,
} from "./paths/steps.ts";

export type {
    GatingPolicy,
    Strictness,
    GateOutcome,
} from "./policy/gating.ts";

export {
    resolveStrictness,
    evaluateGates,
} from "./policy/gating.ts";

// --- Internal/Legacy (Exposed but use with caution) ---
export const RULES_DIR = Impl.RULES_DIR;
export const USAGE = Impl.USAGE; // Primarily for CLI use
