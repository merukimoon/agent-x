import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { OrchestratorService } from '../../../../packages/cli/src/services/orchestrator.js';
import { runAgent } from '../../../../packages/cli/src/agents.js';
import fs from 'fs';
import path from 'path';
import { Core } from '../../../../packages/cli/src/imports.js';

const { OrchestratorExitCode } = Core;

vi.mock('../../../../packages/cli/src/agents.js');
vi.mock('fs');

describe('OrchestratorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    });

    describe('runPlannerWithPolicy', () => {
        it('handles context file read error', async () => {
            (fs.existsSync as Mock).mockReturnValue(true);
            (fs.readFileSync as Mock).mockImplementation((p: string) => {
                if (p === 'context.md') throw new Error('Read Error');
                return JSON.stringify({ goal: 'g' });
            });
            (runAgent as Mock).mockResolvedValue({ status: 'done' });

            await OrchestratorService.runPlannerWithPolicy('goal', 'context.md');

            // Should have treated context as string on error, writing it directly
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('context.md'),
                expect.any(String) // 'context.md' literal if read failed and we passed it as string
            );
        });

        it('handles validation error json parsing failure', async () => {
            (runAgent as Mock).mockResolvedValue({ status: 'failed' });
            (fs.existsSync as Mock).mockImplementation((p: string) => p.endsWith('planner_validation_error.json'));
            (fs.readFileSync as Mock).mockReturnValue('{ invalid json');

            const result = await OrchestratorService.runPlannerWithPolicy('goal', 'context');
            expect(result.exitCode).toBe(OrchestratorExitCode.UNKNOWN_ERROR);
            expect(result.success).toBe(false);
        });

        it('handles missing validation error file', async () => {
            (runAgent as Mock).mockResolvedValue({ status: 'failed' });
            (fs.existsSync as Mock).mockReturnValue(false); // No error file

            const result = await OrchestratorService.runPlannerWithPolicy('goal', 'context');
            expect(result.exitCode).toBe(OrchestratorExitCode.UNKNOWN_ERROR);
        });

        it('retries on retryable network error', async () => {
            // Attempt 1: Network error
            // Attempt 2: Success
            let attempt = 0;
            (runAgent as Mock).mockImplementation(async () => {
                attempt++;
                if (attempt === 1) return { status: 'failed' };
                return { status: 'done' };
            });

            (fs.existsSync as Mock).mockImplementation((p: string) => {
                if (attempt === 1 && p.endsWith('planner_validation_error.json')) return true;
                if (p.includes('planner') && p.includes('result.json') && attempt === 2) return true;
                return false;
            });

            (fs.readFileSync as Mock).mockImplementation((p: string) => {
                if (p.endsWith('planner_validation_error.json')) {
                    return JSON.stringify({ error_type: 'llm_error' });
                }
                return JSON.stringify({ plan: [] });
            });

            // Mock setTimeout to speed up test
            // Note: runPlannerWithPolicy waits backoffMs
            // We can rely on small backoff in policy or just verify it called loop twice

            const result = await OrchestratorService.runPlannerWithPolicy('goal', 'context');
            expect(result.success).toBe(true);
            expect(attempt).toBe(2);
        });

        it('exhausts retries', async () => {
            (runAgent as Mock).mockResolvedValue({ status: 'failed' });
            // Always return retryable error
            (fs.existsSync as Mock).mockReturnValue(true);
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ error_type: 'llm_error' }));

            // Limit retries to 1 for test speed by mocking policy constant? 
            // OrchestratorPolicy is imported. 
            // We can rely on the loop finishing eventually (default 3 retries).
            // Just ensure it returns false.

            const result = await OrchestratorService.runPlannerWithPolicy('goal', 'context');
            expect(result.success).toBe(false);
            expect(runAgent).toHaveBeenCalledTimes(3); // Initial + 2 retries (if limited by logic)
        });

        it('returns success and copies plan', async () => {
            (runAgent as Mock).mockResolvedValue({ status: 'done' });
            (fs.existsSync as Mock).mockReturnValue(true); // result.json exists
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ plan: 'test' }));

            const result = await OrchestratorService.runPlannerWithPolicy('goal', 'context');
            expect(result.success).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringMatching(/plan\.json$/),
                expect.stringContaining('"plan": "test"')
            );
        });
    });
});
