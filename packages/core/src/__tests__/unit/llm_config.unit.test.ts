import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import * as configModule from '../../llm/config.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('llm/config', () => {
    const mockConfig = {
        defaults: { provider: 'test-provider', model: 'test-model' },
        providers: {
            'test-provider': {
                endpoint: 'https://test.api',
                auth_env: 'TEST_API_KEY',
                auth_header: 'Authorization',
                auth_prefix: 'Bearer'
            }
        },
        agents: {
            'planner': { provider: 'test-provider', model: 'planner-model' }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        configModule.resetLlmConfigCacheForTests();
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(mockConfig));
        // Reset env
        vi.stubEnv('TEST_API_KEY', 'valid-key');
        vi.stubEnv('LLM_ENDPOINT', '');
        vi.stubEnv('LLM_MODEL', '');
        vi.stubEnv('LLM_API_KEY', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('resolveLlmTarget', () => {
        it('resolves defaults', () => {
            // using an agent not in specific list -> defaults
            const result = configModule.resolveLlmTarget('coordinator');
            expect(result).toEqual({
                provider: 'test-provider',
                model: 'test-model',
                endpoint: 'https://test.api',
                apiKey: 'valid-key',
                authHeader: 'Authorization',
                authPrefix: 'Bearer'
            });
        });

        it('resolves specific agent config', () => {
            const result = configModule.resolveLlmTarget('planner');
            expect(result.model).toBe('planner-model');
        });

        it('prefers env var overrides', () => {
            vi.stubEnv('LLM_MODEL', 'env-model');
            vi.stubEnv('LLM_API_KEY', 'env-key');
            vi.stubEnv('LLM_ENDPOINT', 'env-endpoint');

            const result = configModule.resolveLlmTarget('coordinator');
            expect(result.model).toBe('env-model');
            expect(result.apiKey).toBe('env-key');
            expect(result.endpoint).toBe('env-endpoint');
        });

        it('throws if API key missing', () => {
            vi.stubEnv('TEST_API_KEY', '');
            expect(() => configModule.resolveLlmTarget('coordinator')).toThrow(/Missing API key/);
        });
    });

    describe('loadConfig validations', () => {
        it('throws if config missing', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            expect(() => configModule.resolveLlmTarget('coordinator')).toThrow(/Missing LLM config/);
        });

        it('throws if invalid JSON', () => {
            (fs.readFileSync as Mock).mockReturnValue('{ invalid');
            expect(() => configModule.resolveLlmTarget('coordinator')).toThrow(/Failed to parse/);
        });

        it('throws if config not object', () => {
            (fs.readFileSync as Mock).mockReturnValue('true');
            expect(() => configModule.resolveLlmTarget('coordinator')).toThrow(/must be an object/);
        });

        it('throws if providers missing', () => {
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ ...mockConfig, providers: undefined }));
            expect(() => configModule.resolveLlmTarget('coordinator')).toThrow(/providers missing/);
        });

        it('throws if unknown agent', () => {
            const invalidAgents = { ...mockConfig, agents: { 'bad-agent': {} } };
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(invalidAgents));
            expect(() => configModule.resolveLlmTarget('coordinator')).toThrow(/Unknown agent/);
        });
    });
});
