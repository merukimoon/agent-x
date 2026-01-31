export function getConfiguredApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.AGENTX_MCP_API_KEY;
  return key && key.length > 0 ? key : null;
}

export function isApiKeyAllowed(provided: string | undefined, expected: string): boolean {
  if (!expected) return false;
  return (provided ?? "") === expected;
}
