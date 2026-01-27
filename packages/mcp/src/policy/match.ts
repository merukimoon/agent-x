import type { AuthContext, AuthResult, Policy, PolicyRule } from "./policy";

/**
 * Check if an auth context matches a policy rule.
 */
export function matchesRule(ctx: AuthContext, rule: PolicyRule): boolean {
    // Method must match exactly
    if (ctx.method !== rule.method) {
        return false;
    }

    // Check 'from' field: if rule has no 'from' or 'from' is "*", match any
    const ruleFrom = rule.from ?? "*";
    if (ruleFrom !== "*" && ctx.from !== ruleFrom) {
        return false;
    }

    // Check 'to' field: if rule has no 'to' or 'to' is "*", match any
    const ruleTo = rule.to ?? "*";
    if (ruleTo !== "*" && ctx.to !== ruleTo) {
        return false;
    }

    return true;
}

/**
 * Authorize an MCP request based on policy.
 * In-process transport always allowed (after method validation).
 * HTTP transport requires policy match.
 */
export function authorize(ctx: AuthContext, policy: Policy): AuthResult {
    // In-process transport is always authorized
    if (ctx.transport === "inprocess") {
        return { ok: true };
    }

    // HTTP transport requires policy match
    for (const rule of policy.allow) {
        if (matchesRule(ctx, rule)) {
            return { ok: true };
        }
    }

    return {
        ok: false,
        reason: `Forbidden: Method "${ctx.method}" not allowed by policy for HTTP transport`,
    };
}
