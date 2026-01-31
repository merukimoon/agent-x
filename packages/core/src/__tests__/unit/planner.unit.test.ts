import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as planner from '../../llm/planner.js';
import * as config from '../../llm/config.js';
import fs from 'fs';

vi.mock('fs');
vi.mock('../../llm/config.js');

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('planner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockReset();
    });

    describe('validatePlannerOutput', () => {
        const validCapabilities = ['create_file'];

        it('validates valid output', () => {
            const valid = {
                goal: 'goal',
                assumptions: [],
                needs_clarification: false,
                questions: [],
                plan: [
                    {
                        id: 'step-1',
                        action_type: 'create_file',
                        verification: [{ method: 'check file', success_criteria: 'file exists' }],
                        risk: 'low'
                    }
                ]
            };
            const result = planner.validatePlannerOutput(valid, validCapabilities);
            expect(result.valid).toBe(true);
        });

        it('rejects invalid JSON structure', () => {
            const result = planner.validatePlannerOutput(null, []);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Output must be a JSON object.');
        });

        it('validates schema fields', () => {
            const invalid = { goal: 123 }; // wrong type
            const result = planner.validatePlannerOutput(invalid, []);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringMatching(/Missing or invalid/)]));
        });

        it('enforces clarification rules (needs_clarification=true)', () => {
            const invalid = {
                goal: 'g', assumptions: [], needs_clarification: true,
                questions: [], // Invalid: must be non-empty
                plan: []
            };
            const result = planner.validatePlannerOutput(invalid, []);
            expect(result.errors).toContain("If 'needs_clarification' is true, 'questions' must be non-empty.");
        });

        it('enforces clarification rules (needs_clarification=false)', () => {
            const invalid = {
                goal: 'g', assumptions: [], needs_clarification: false,
                questions: [{ id: 'q1', text: '?', why_needed: 'why' }], // Invalid: must be empty
                plan: []
            };
            const result = planner.validatePlannerOutput(invalid, []);
            expect(result.errors).toContain("If 'needs_clarification' is false, 'questions' must be empty.");
        });

        it('validates step fields', () => {
            const invalidStep = {
                goal: 'g', assumptions: [], needs_clarification: false, questions: [],
                plan: [
                    {
                        // Missing id, action_type
                        verification: [], risk: 'bad'
                    }
                ]
            };
            const result = planner.validatePlannerOutput(invalidStep, validCapabilities);
            expect(result.errors).toEqual(expect.arrayContaining([
                expect.stringMatching(/missing 'id'/),
                expect.stringMatching(/missing 'action_type'/),
                expect.stringMatching(/invalid risk/)
            ]));
        });

        it('validates capabilities', () => {
            const invalidStep = {
                goal: 'g', assumptions: [], needs_clarification: false, questions: [],
                plan: [
                    {
                        id: 's1', action_type: 'unknown_cap',
                        verification: [], risk: 'low'
                    }
                ]
            };
            const result = planner.validatePlannerOutput(invalidStep, validCapabilities);
            expect(result.errors).toEqual(expect.arrayContaining([
                expect.stringMatching(/unknown action_type/)
            ]));
        });
    });

    describe('cleanJsonOutput', () => {
        it('strips markdown fences', () => {
            const raw = "```json\n{\"foo\":\"bar\"}\n```";
            expect(planner.cleanJsonOutput(raw)).toBe("{\"foo\":\"bar\"}");
        });

        it('returns raw if no fences', () => {
            const raw = "{\"foo\":\"bar\"}";
            expect(planner.cleanJsonOutput(raw)).toBe(raw);
        });
    });

    describe('generatePlanFromLLM', () => {
        beforeEach(() => {
            (config.resolveLlmTarget as Mock).mockReturnValue({
                provider: 'openai',
                model: 'gpt-4',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                apiKey: 'test-key'
            });
            (fs.existsSync as Mock).mockReturnValue(true);
            (fs.readFileSync as Mock).mockReturnValue('Prompt Template');
        });

        it('calls LLM and returns content', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: '{"plan":[]}' } }]
                })
            });

            const result = await planner.generatePlanFromLLM('prompt.md', 'goal', 'context');
            expect(result.rawText).toBe('{"plan":[]}');
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('api.openai.com'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({ 'Authorization': 'Bearer test-key' })
                })
            );
        });

        it('throws on prompt missing', async () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            await expect(planner.generatePlanFromLLM('missing.md', 'goal', 'context'))
                .rejects.toThrow(/Prompt template not found/);
        });

        it('throws on network error', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Error Body'
            });

            await expect(planner.generatePlanFromLLM('prompt.md', 'goal', 'context'))
                .rejects.toThrow(/LLM request failed: 500/);
        });

        it('throws on fetch throw', async () => {
            fetchMock.mockRejectedValue(new Error('Network Down'));
            await expect(planner.generatePlanFromLLM('prompt.md', 'goal', 'context'))
                .rejects.toThrow(/LLM interaction failed: Network Down/);
        });
    });
});
