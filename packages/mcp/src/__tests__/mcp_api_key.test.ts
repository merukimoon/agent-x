import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getConfiguredApiKey, isApiKeyAllowed } from "../auth/api_key";

describe("MCP API Key", () => {
    let originalKey: string | undefined;

    beforeEach(() => {
        originalKey = process.env.AGENTX_MCP_API_KEY;
    });

    afterEach(() => {
        if (originalKey !== undefined) {
            process.env.AGENTX_MCP_API_KEY = originalKey;
        } else {
            delete process.env.AGENTX_MCP_API_KEY;
        }
    });

    describe("getConfiguredApiKey", () => {
        it("returns null when env var is not set", () => {
            delete process.env.AGENTX_MCP_API_KEY;
            expect(getConfiguredApiKey()).toBeNull();
        });

        it("returns null when env var is empty string", () => {
            process.env.AGENTX_MCP_API_KEY = "";
            expect(getConfiguredApiKey()).toBeNull();
        });

        it("returns the key when env var is set with valid value", () => {
            process.env.AGENTX_MCP_API_KEY = "valid-key-123";
            expect(getConfiguredApiKey()).toBe("valid-key-123");
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
