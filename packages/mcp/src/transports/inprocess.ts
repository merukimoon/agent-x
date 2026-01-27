import type { MCPRequest, MCPResponse } from "../protocol/messages";
import { PROTOCOL_VERSION } from "../protocol/messages";
import type { MCPServer } from "../server/createServer";

export interface InprocessTransport {
  send: (request: Omit<MCPRequest, "protocol_version"> & Partial<Pick<MCPRequest, "protocol_version">>) => MCPResponse;
}

export function createInprocessTransport(server: MCPServer): InprocessTransport {
  return {
    send(requestInput) {
      const request: MCPRequest = {
        ...requestInput,
        protocol_version: requestInput.protocol_version ?? PROTOCOL_VERSION,
      } as MCPRequest;
      // In-process transport is always synchronous, handleRequest returns MCPResponse directly
      return server.handleRequest(request) as MCPResponse;
    },
  };
}
