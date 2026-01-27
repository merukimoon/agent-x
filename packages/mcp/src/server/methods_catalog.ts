import fs from "fs";
import path from "path";
import type { Policy } from "../policy/policy";

export interface MethodMetadata {
    name: string;
    handler_kind: "deterministic" | "async";
    exposure: "internal" | "external" | "both";
    description: string;
    payload_schema: object | null;
}

/**
 * Build method catalog from registered methods and policy.
 */
export function buildMethodsCatalog(
    deterministicMethods: Map<string, Function>,
    asyncMethods: Map<string, Function>,
    policy: Policy
): MethodMetadata[] {
    const catalog: MethodMetadata[] = [];

    // Process deterministic methods
    for (const methodName of deterministicMethods.keys()) {
        const allowedByPolicy = policy.allow.some((rule) => rule.method === methodName);
        const exposure = allowedByPolicy ? "both" : "internal";

        catalog.push({
            name: methodName,
            handler_kind: "deterministic",
            exposure,
            description: "",
            payload_schema: null,
        });
    }

    // Process async methods (always external only)
    for (const methodName of asyncMethods.keys()) {
        catalog.push({
            name: methodName,
            handler_kind: "async",
            exposure: "external",
            description: "",
            payload_schema: null,
        });
    }

    return catalog;
}

/**
 * Write methods catalog snapshot for a run.
 * Fail-soft: warns on error, does not throw.
 */
export function snapshotMethodsForRun(runId: string, catalog: MethodMetadata[]): void {
    try {
        const runDir = path.join(process.cwd(), "runs", runId);
        if (!fs.existsSync(runDir)) {
            return; // Run directory doesn't exist, skip snapshot
        }

        const mcpDir = path.join(runDir, "mcp");
        fs.mkdirSync(mcpDir, { recursive: true });

        const snapshotPath = path.join(mcpDir, "methods.json");
        const snapshot = { methods: catalog };
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`MCP methods snapshot write failed: ${reason}`);
    }
}
