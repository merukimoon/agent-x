import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as planModule from '../../plan.js';
import * as registryModule from '../../registry.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('../../registry.js');
vi.mock('../../fs.js', () => ({
    writeJsonFile: vi.fn(),
}));

describe('plan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (registryModule.loadRolesRegistry as Mock).mockReturnValue({
            byId: new Map([
                ['planner', { id: 'planner' }],
                ['coordinator', { id: 'coordinator' }]
            ])
        });
    });

    describe('gatherPlanSchemaErrors', () => {
        it('returns error if registry load fails', () => {
            (registryModule.loadRolesRegistry as Mock).mockImplementation(() => { throw new Error('RegFail'); });
            const res = planModule.gatherPlanSchemaErrors({}, 'run-1');
            expect(res.schemaErrors[0]).toContain('roles registry error: RegFail');
        });

        it('validates run_id', () => {
            const res = planModule.gatherPlanSchemaErrors({ run_id: 'bad' }, 'run-1');
            expect(res.schemaErrors.join(' ')).toContain('run_id mismatch');
        });

        it('validates fields existence', () => {
            const res = planModule.gatherPlanSchemaErrors({}, 'run-1');
            const errs = res.schemaErrors.join(' ');
            expect(errs).toContain('version missing');
            expect(errs).toContain('created_at_utc');
            expect(errs).toContain('flow_type');
            expect(errs).toContain('rationale');
            expect(errs).toContain('signals');
            expect(errs).toContain('confidence');
        });

        it('validates confidence enum', () => {
            const res = planModule.gatherPlanSchemaErrors({ confidence: 'bad' }, 'run-1');
            expect(res.schemaErrors.join(' ')).toContain('confidence missing or invalid');
        });

        it('validates signal consistency', () => {
            // signals empty but confidence high
            const res = planModule.gatherPlanSchemaErrors({ signals: [], confidence: 'high' }, 'run-1');
            expect(res.schemaErrors.join(' ')).toContain('signals empty but confidence is not low');
        });

        it('validates step fields', () => {
            const step = {
                id: 's1',
                agent: 'planner',
                depends_on: [],
                inputs: { request: 'inputs/request.md', context: 'inputs/context.md', prior_outputs: [] },
                outputs: { result: 'outputs/planner/result.json', notes: 'outputs/planner/notes.md' },
                status: 'pending',
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: true
            };
            const invalidStep = { ...step, agent: 'invalid' };
            const plan = {
                run_id: 'run-1',
                version: 'plan.v1',
                created_at_utc: 'now',
                flow_type: 'ft',
                rationale: 'r',
                signals: ['s'],
                confidence: 'high',
                steps: [invalidStep]
            };

            const res = planModule.gatherPlanSchemaErrors(plan, 'run-1');
            expect(res.schemaErrors.join(' ')).toContain('invalid agent'); // isAgentName check
        });

        it('validates step duplicate id', () => {
            const step = {
                id: 's1',
                agent: 'planner',
                depends_on: [],
                inputs: { request: 'inputs/request.md', context: 'inputs/context.md', prior_outputs: [] },
                outputs: { result: 'outputs/planner/result.json', notes: 'outputs/planner/notes.md' },
                status: 'pending',
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: true
            };
            const plan = {
                run_id: 'run-1',
                version: 'plan.v1',
                created_at_utc: 'now',
                flow_type: 'ft',
                rationale: 'r',
                signals: ['s'],
                confidence: 'high',
                steps: [step, step]
            };
            const res = planModule.gatherPlanSchemaErrors(plan, 'run-1');
            expect(res.schemaErrors.join(' ')).toContain('step id is duplicated');
        });
    });

    describe('validatePlanFiles', () => {
        const mockPlan: any = {
            steps: [
                { id: 's1', agent: 'planner', status: 'done', inputs: { prior_outputs: [] }, depends_on: [] },
                { id: 's2', agent: 'coordinator', status: 'pending', inputs: { prior_outputs: ['outputs/planner/result.json'] }, depends_on: ['planner'] }
            ]
        };

        it('reports missing inputs', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            const errs = planModule.validatePlanFiles(mockPlan, '/run');
            expect(errs.join(' ')).toContain('Missing input');
        });

        it('reports missing dependency outputs when required', () => {
            // inputs exist
            (fs.existsSync as Mock).mockImplementation((p: string) => {
                if (p.includes('inputs')) return true;
                return false;
            });
            const errs = planModule.validatePlanFiles(mockPlan, '/run');
            // planner done -> coordinator requires planner result.
            // coordinator always requires deps.
            expect(errs.join(' ')).toContain('prior output missing');
            expect(errs.join(' ')).toContain('dependency missing result');
        });
    });

    describe('runValidationChecks', () => {
        it('returns error if plan missing', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            const res = planModule.runValidationChecks('run-1', '/run', 'plan.json');
            expect(res.planLoadError).toContain('not found');
        });
    });
});
