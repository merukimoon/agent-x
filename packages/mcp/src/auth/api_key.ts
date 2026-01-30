export function getConfiguredApiKey(): string | null {
  const key = process.env.AGENTX_MCP_API_KEY;
  return key && key.length > 0 ? key : null;
}

export function isApiKeyAllowed(provided: string | undefined, expected: string): boolean {
  if (!expected) return false;
  return (provided ?? "") === expected;
}
