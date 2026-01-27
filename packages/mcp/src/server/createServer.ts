import fs from "fs";
import path from "path";
import type { MCPRequest, MCPResponse, MCPError } from "../protocol/messages";
import { PROTOCOL_VERSION } from "../protocol/messages";
import type { Policy, AuthorizeFunc } from "../policy/policy";
import { buildMethodsCatalog, snapshotMethodsForRun } from "./methods_catalog";

export type MCPMethodHandler = (payload: MCPRequest["payload"], request: MCPRequest) => unknown | Promise<unknown>;
export type MCPDeterministicHandler = (payload: MCPRequest["payload"], request: MCPRequest) => unknown;
export type MCPAsyncHandler = (payload: MCPRequest["payload"], request: MCPRequest) => Promise<unknown>;

export interface MCPServer {
  registerMethod: (method: string, handler: MCPDeterministicHandler) => void;
  registerDeterministic: (method: string, handler: MCPDeterministicHandler) => void;
  registerAsync: (method: string, handler: MCPAsyncHandler) => void;
  handleRequest: (request: MCPRequest) => MCPResponse | Promise<MCPResponse>;
  getMethodsCatalog: () => any[];
}

export interface MCPServerOptions {
  policy?: Policy;
  authorize?: AuthorizeFunc;
  transport?: "http" | "inprocess";
}

export function createServer(opts?: MCPServerOptions): MCPServer {
  const deterministicRegistry = new Map<string, MCPDeterministicHandler>();
  const asyncRegistry = new Map<string, MCPAsyncHandler>();
  const snapshotted = new Set<string>();

  const policy = opts?.policy;
  const authorize = opts?.authorize;
  const transport = opts?.transport ?? "inprocess";

  function registerDeterministic(method: string, handler: MCPDeterministicHandler) {
    deterministicRegistry.set(method, handler);
  }

  function registerAsync(method: string, handler: MCPAsyncHandler) {
    asyncRegistry.set(method, handler);
  }

  function registerMethod(method: string, handler: MCPDeterministicHandler) {
    console.warn(`DEPRECATED: registerMethod() is deprecated. Use registerDeterministic() instead for method "${method}"`);
    registerDeterministic(method, handler);
  }

  function getMethodsCatalog() {
    if (!policy) {
      return [];
    }
    return buildMethodsCatalog(deterministicRegistry, asyncRegistry, policy);
  }

  // Auto-register built-in mcp.list_methods
  registerDeterministic("mcp.list_methods", () => {
    return { methods: getMethodsCatalog() };
  });

  async function handleRequestAsync(request: MCPRequest): Promise<MCPResponse> {
    const started = Date.now();
    let result: unknown = undefined;
    let error: MCPError | undefined = undefined;
    let ok = false;

    // Authorization check FIRST for HTTP (before method lookup for correct 403 vs 404)
    if (!error && authorize && policy && transport === "http") {
      const authResult = authorize({
        method: request.method,
        from: request.from,
        to: request.to,
        transport: transport,
      }, policy);

      if (!authResult.ok) {
        error = { message: authResult.reason ?? "Forbidden", code: "FORBIDDEN" };
      }
    }

    // Method validation (only if not already errored)
    const isDeterministic = deterministicRegistry.has(request.method);
    const isAsync = asyncRegistry.has(request.method);

    if (!error && !isDeterministic && !isAsync) {
      error = { message: `Unknown method: ${request.method}` };
    }

    // Execute method if authorized
    if (!error) {
      try {
        if (isDeterministic) {
          const handler = deterministicRegistry.get(request.method)!;
          result = handler(request.payload, request);
          ok = true;
        } else if (isAsync && transport === "http") {
          const handler = asyncRegistry.get(request.method)!;
          result = await handler(request.payload, request);
          ok = true;
        } else if (isAsync && transport === "inprocess") {
          error = { message: "Async MCP handlers are not supported in in-process transport" };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error = { message };
      }
    }

    const duration = Date.now() - started;

    // Build response
    const response: MCPResponse = {
      protocol_version: request.protocol_version ?? PROTOCOL_VERSION,
      id: request.id,
      ok,
      result: ok ? result : undefined,
      error: error,
      trace_id: request.trace_id,
      parent_id: request.parent_id,
    };

    // Audit logging (fail-soft)
    if (request.run_id) {
      try {
        const runDir = path.join(process.cwd(), "runs", request.run_id);
        if (fs.existsSync(runDir)) {
          const mcpDir = path.join(runDir, "mcp");
          fs.mkdirSync(mcpDir, { recursive: true });

          const auditPath = path.join(mcpDir, "audit.jsonl");
          const auditRecord = {
            ts: new Date().toISOString(),
            id: request.id,
            run_id: request.run_id,
            from: request.from,
            to: request.to,
            method: request.method,
            ok,
            duration_ms: duration,
            error: error?.message ?? null,
            trace_id: request.trace_id,
            parent_id: request.parent_id,
          };

          fs.appendFileSync(auditPath, JSON.stringify(auditRecord) + "\n", "utf8");

          // Snapshot methods catalog once per run_id
          if (!snapshotted.has(request.run_id)) {
            snapshotted.add(request.run_id);
            snapshotMethodsForRun(request.run_id, deterministicRegistry, asyncRegistry, policy);
          }
        }
      } catch (err) {
        // Fail-soft: log to console but don't throw
        console.warn(`Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return response;
  }

  function handleRequest(request: MCPRequest): MCPResponse | Promise<MCPResponse> {
    // In-process transport must be synchronous
    if (transport === "inprocess") {
      const started = Date.now();
      let result: unknown = undefined;
      let error: MCPError | undefined = undefined;
      let ok = false;

      const isDeterministic = deterministicRegistry.has(request.method);
      const isAsync = asyncRegistry.has(request.method);

      // In-process never checks policy
      if (!isDeterministic && !isAsync) {
        error = { message: `Unknown method: ${request.method}` };
      } else if (isAsync) {
        error = { message: "Async MCP handlers are not supported in in-process transport" };
      } else {
        try {
          const handler = deterministicRegistry.get(request.method)!;
          result = handler(request.payload, request);
          ok = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          error = { message };
        }
      }

      const duration = Date.now() - started;

      // Build response
      const response: MCPResponse = {
        protocol_version: request.protocol_version ?? PROTOCOL_VERSION,
        id: request.id,
        ok,
        result: ok ? result : undefined,
        error: error,
        trace_id: request.trace_id,
        parent_id: request.parent_id,
      };

      // Audit logging (fail-soft)
      if (request.run_id) {
        try {
          const runDir = path.join(process.cwd(), "runs", request.run_id);
          if (fs.existsSync(runDir)) {
            const mcpDir = path.join(runDir, "mcp");
            fs.mkdirSync(mcpDir, { recursive: true });

            const auditPath = path.join(mcpDir, "audit.jsonl");
            const auditRecord = {
              ts: new Date().toISOString(),
              id: request.id,
              run_id: request.run_id,
              from: request.from,
              to: request.to,
              method: request.method,
              ok,
              duration_ms: duration,
              error: error?.message ?? null,
              trace_id: request.trace_id,
              parent_id: request.parent_id,
            };

            fs.appendFileSync(auditPath, JSON.stringify(auditRecord) + "\n", "utf8");

            // Snapshot methods catalog once per run_id
            if (!snapshotted.has(request.run_id)) {
              snapshotted.add(request.run_id);
              snapshotMethodsForRun(request.run_id, deterministicRegistry, asyncRegistry, policy);
            }
          }
        } catch (err) {
          // Fail-soft: log to console but don't throw
          console.warn(`Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return response;
    }

    // HTTP transport can be async
    return handleRequestAsync(request);
  }

  return {
    registerMethod,
    registerDeterministic,
    registerAsync,
    handleRequest,
    getMethodsCatalog,
  };
}
