/**
 * Internal Imports Bridge
 * Maps local concepts to the correct upstream location (Core or Legacy).
 */

// Re-export EVERYTHING from Core/Legacy as namespaces for values
import * as _CoreValues from "../../core/src/index.ts";
import * as _LegacyValues from "../../../scripts/agentic/legacy/index.ts";

export const Core = _CoreValues;
export const Legacy = _LegacyValues;

// Also re-export types directly so "import type { Plan } from './imports.ts'" works?
// No, that would require `export type { Plan } from ...`
// Since we want strict boundaries, let's just use `Core.Plan` in JSDoc 
// and `import type { Plan } from "../../core/src/index.ts"` for direct type imports if needed.
// actually, let's just make `packages/cli/src/imports.ts` fully transparent for types.

export * from "../../core/src/index.ts";
// ^ likely collision if Core exports same names as Legacy? 
// Legacy exports errors, lock, plan... Core exports core types. They should be distinct.

// But wait, if I export * from core, I might pollute the namespace.
// Let's stick to: Values via `Core.*` / `Legacy.*`
// Types: Import them directly from `imports.ts` by re-exporting them manually or trusting the user to import from `imports.ts`.
// To support `import type { Plan } from './imports.ts'`, we need to export it.

export type {
    Plan,
    PlanStep,
    AgentName,
    AgentStatus,
    StepStatus,
    ExecutionMode,
    RunId,
    AgentResult
} from "../../core/src/index.ts";
