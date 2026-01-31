import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as planModule from '../../plan.js';
import fs from 'fs';
import { loadRolesRegistry } from '../../registry.js';
import { fail } from '../../errors.js';
import { writeJsonFile } from '../../fs.js';

vi.mock('fs');
vi.mock('../../registry.js');
vi.mock('../../errors.js');
vi.mock('../../fs.js');

describe('plan', () => {
    const mockRunId = 'test-run';
    const mockPlan = {
        run_id: mockRunId,
        version: '0.1',
        created_at_utc: '2023-01-01T00:00:00Z',
        flow_type: 'test-flow',
        rationale: 'test rationale',
        status: 'running',
        signals: [],
        confidence: 'low',
        steps: [
            {
                id: 'step-1',
                agent: 'planner',
                depends_on: [],
                inputs: {
                    request: 'inputs/request.md',
                    context: 'inputs/context.md',
                    prior_outputs: []
                },
                outputs: {
                    result: 'outputs/planner/result.json',
                    notes: 'outputs/planner/notes.md'
                },
                status: 'pending',
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: false
            }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (loadRolesRegistry as Mock).mockReturnValue({
            byId: new Map([
                ['planner', { runner: 'llm' }],
                ['coordinator', { runner: 'rule' }]
            ])
        });
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.statSync as Mock).mockReturnValue({ isFile: () => true });
    });

    describe('validatePlan', () => {
        it('returns plan if valid', () => {
            const result = planModule.validatePlan(mockPlan, mockRunId);
            expect(result).toEqual(mockPlan);
        });

        it('throws if invalid', () => {
            const invalid = { ...mockPlan, run_id: 'mismatch' };
            // validatePlan calls fail(), which we mocked.
            // If fail throws, we catch it. If fail is just mocked to return, validatePlan returns undefined/void?
            // validatePlan implementation checks schemaErrors.length > 0 -> fail().
            // If fail() is mocked to NOT throw, validatePlan logic continues?
            // "return plan;" at end.

            // We should mock fail to throw to simulate real behavior, or check call.
            (fail as unknown as Mock).mockImplementation((msg) => { throw new Error(msg); });

            expect(() => planModule.validatePlan(invalid, mockRunId)).toThrow(/run_id mismatch/);
        });
    });

    describe('gatherPlanSchemaErrors', () => {
        it('detects run_id mismatch', () => {
            const { schemaErrors } = planModule.gatherPlanSchemaErrors({ ...mockPlan, run_id: 'bad' }, mockRunId);
            expect(schemaErrors).toEqual(expect.arrayContaining([expect.stringMatching(/run_id mismatch/)]));
        });

        it('detects missing version', () => {
            const { schemaErrors } = planModule.gatherPlanSchemaErrors({ ...mockPlan, version: undefined }, mockRunId);
            expect(schemaErrors).toEqual(expect.arrayContaining([expect.stringMatching(/version missing/)]));
        });

        it('detects missing steps', () => {
            const { schemaErrors } = planModule.gatherPlanSchemaErrors({ ...mockPlan, steps: [] }, mockRunId);
            expect(schemaErrors).toEqual(expect.arrayContaining([expect.stringMatching(/must include at least one step/)]));
        });

        it('detects invalid step agent', () => {
            const invalidSteps = [
                { ...mockPlan.steps[0], agent: 'unknown-agent' }
            ];
            const { schemaErrors } = planModule.gatherPlanSchemaErrors({ ...mockPlan, steps: invalidSteps }, mockRunId);
            expect(schemaErrors).toEqual(expect.arrayContaining([expect.stringMatching(/invalid agent: unknown-agent/)]));
        });
    });

    describe('runValidationChecks', () => {
        it('returns load error if plan missing', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            const result = planModule.runValidationChecks(mockRunId, '/run/dir', 'plan.json');
            expect(result.planLoadError).toContain('plan.json not found');
        });

        it('returns load error if invalid json', () => {
            (fs.readFileSync as Mock).mockReturnValue('{ "bad" }');
            const result = planModule.runValidationChecks(mockRunId, '/run/dir', 'plan.json');
            expect(result.planLoadError).toContain('invalid JSON');
        });

        it('validates plan files existence', () => {
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(mockPlan));
            // Return true for everything: plan.json, inputs, and dependency outputs
            (fs.existsSync as Mock).mockReturnValue(true);

            const result = planModule.runValidationChecks(mockRunId, '/run/dir', 'plan.json');
            expect(result.schemaErrors).toHaveLength(0);
            expect(result.missingPaths).toHaveLength(0);
        });

        it('reports missing inputs', () => {
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(mockPlan));
            // Only plan.json exists. Inputs do not.
            (fs.existsSync as Mock).mockImplementation((p: string) => {
                if (p.endsWith('plan.json') || p.endsWith('registry.json')) return true;
                return false;
            });

            const result = planModule.runValidationChecks(mockRunId, '/run/dir', 'plan.json');
            expect(result.schemaErrors).toHaveLength(0);
            expect(result.missingPaths).toEqual(expect.arrayContaining([expect.stringMatching(/Missing input/)]));
        });
    });

    describe('loadPlan', () => {
        it('loads and validates successfully', () => {
            // mockPlan should now have version 0.1
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(mockPlan));
            const result = planModule.loadPlan('plan.json', mockRunId);
            expect(result).toEqual(mockPlan);
        });

        it('fails on read error', () => {
            (fs.readFileSync as Mock).mockImplementation(() => { throw new Error('IO Error'); });
            (fail as unknown as Mock).mockImplementation((msg) => { throw new Error(msg); });
            expect(() => planModule.loadPlan('plan.json', mockRunId)).toThrow(/Failed to read or parse/);
        });
    });
});
