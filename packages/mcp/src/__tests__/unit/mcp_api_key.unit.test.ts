import { describe, expect, it } from "vitest";
import { getConfiguredApiKey, isApiKeyAllowed } from "../../auth/api_key";

const emptyEnv = {} as NodeJS.ProcessEnv;

describe("MCP API Key", () => {
    describe("getConfiguredApiKey", () => {
        it("returns null when env var is not set", () => {
            expect(getConfiguredApiKey(emptyEnv)).toBeNull();
        });

        it("returns null when env var is an empty string", () => {
            const env = { ...emptyEnv, AGENTX_MCP_API_KEY: "" };
            expect(getConfiguredApiKey(env)).toBeNull();
        });

        it("returns the key when env var is set", () => {
            const env = { ...emptyEnv, AGENTX_MCP_API_KEY: "valid-key-123" };
            expect(getConfiguredApiKey(env)).toBe("valid-key-123");
        });
    });

    describe("isApiKeyAllowed", () => {
        it("returns false when expected key is empty string", () => {
            expect(isApiKeyAllowed("any-key", "")).toBe(false);
        });

        it("returns false when provided key is undefined", () => {
            expect(isApiKeyAllowed(undefined, "expected-key")).toBe(false);
        });

        it("returns false when provided key does not match", () => {
            expect(isApiKeyAllowed("wrong-key", "expected-key")).toBe(false);
        });

        it("returns true when provided key matches expected", () => {
            expect(isApiKeyAllowed("secret-key", "secret-key")).toBe(true);
        });
    });
});
