/**
 * Legacy Adapter
 * Re-exports internal script logic for use by packages/cli.
 * 
 * Boundaries:
 * - This file exists to prevent deep imports from CLI into scripts/.
 * - It should be the ONLY place packages/cli imports from scripts/.
 */

export * from "../errors.ts";
export * from "../lock.ts";
export * from "../plan.ts";
export * from "../fs.ts";
export * from "../rules.ts";
export * from "../llm-planner.ts";
