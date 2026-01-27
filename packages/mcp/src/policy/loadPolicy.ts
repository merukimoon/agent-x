import fs from "fs";
import type { Policy } from "./policy.ts";

/**
 * Default policy: allow only safe built-in methods over HTTP.
 */
const DEFAULT_POLICY: Policy = {
    allow: [
        { method: "mcp.list_methods" },
        { method: "runner.technical-writer", from: "*", to: "*" },
    ],
};

/**
 * Load policy from environment variable or return default.
 * 
 * @param transport - "http" for fail-hard on errors, "inprocess" for fail-soft
 */
export function loadPolicy(transport: "http" | "inprocess" = "inprocess"): Policy {
    const policyPath = process.env.AGENTX_MCP_POLICY_PATH;

    // No policy path configured, use defaults
    if (!policyPath || policyPath.trim().length === 0) {
        return DEFAULT_POLICY;
    }

    // Try to load policy from file
    try {
        const rawContent = fs.readFileSync(policyPath, "utf8");
        const parsed = JSON.parse(rawContent) as Policy;

        // Validate basic structure
        if (!parsed || typeof parsed !== "object") {
            throw new Error("Policy must be an object");
        }
        if (!Array.isArray(parsed.allow)) {
            throw new Error("Policy 'allow' field must be an array");
        }

        return parsed;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const errorMsg = `Failed to load MCP policy from ${policyPath}: ${message}`;

        // Fail hard for HTTP transport (security requirement)
        if (transport === "http") {
            throw new Error(errorMsg);
        }

        // Fail soft for in-process transport (operational continuity)
        console.warn(`${errorMsg}. Using default policy.`);
        return DEFAULT_POLICY;
    }
}
