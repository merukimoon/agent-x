/**
 * Policy types and authorization interfaces for MCP method access control.
 */

export interface PolicyRule {
  method: string;
  from?: string;
  to?: string;
}

export interface Policy {
  allow: PolicyRule[];
}

export interface AuthContext {
  method: string;
  from?: string;
  to?: string;
  transport: "inprocess" | "http";
}

export interface AuthResult {
  ok: boolean;
  reason?: string;
}

export type AuthorizeFunc = (ctx: AuthContext, policy: Policy) => AuthResult;
