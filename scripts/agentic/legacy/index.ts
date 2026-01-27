/**
 * Legacy Adapter
 * Re-exports internal script logic for use by packages/cli.
 * 
 * Boundaries:
 * - This file exists to prevent deep imports from CLI into scripts/.
 * - It should be the ONLY place packages/cli imports from scripts/.
 */

export * from "../errors";
export * from "../lock";
export * from "../plan";
export * from "../fs";
export * from "../rules";
export * from "../llm-planner";
