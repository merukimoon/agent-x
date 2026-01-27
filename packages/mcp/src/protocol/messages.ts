export const PROTOCOL_VERSION = "mcp.v1" as const;

export interface MCPRequest {
  protocol_version: typeof PROTOCOL_VERSION;
  id: string | number;
  run_id?: string;
  from?: string;
  to?: string;
  method: string;
  payload?: unknown;
}

export interface MCPError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface MCPResponse {
  protocol_version: typeof PROTOCOL_VERSION;
  id: string | number;
  ok: boolean;
  result?: unknown;
  error?: MCPError;
}
