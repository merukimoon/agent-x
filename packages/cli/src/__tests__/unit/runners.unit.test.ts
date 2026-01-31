import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as runners from '../../runners.js';
import * as CoreDeps from '../../core_deps.js';

vi.mock('../../core_deps.js', () => ({
    readFirstLines: vi.fn(),
    writeFileAtomic: vi.fn(),
    writeJsonFile: vi.fn(),
}));

describe('runners', () => {
    const mockParams = {
        runId: 'test-run',
        outputsDir: '/runs/test-run/outputs/technical-writer',
        requestPath: '/runs/test-run/inputs/request.md',
        contextPath: '/runs/test-run/inputs/context.md',
        mode: 'live' as const,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('runTechnicalWriter', () => {
        it('executes successfully', async () => {
            (CoreDeps.readFirstLines as Mock).mockReturnValue(['Request line 1', 'Request line 2']);

            const result = await runners.runTechnicalWriter(mockParams);

            expect(result).toEqual({
                status: 'done',
                summary: 'Documentation review guidance prepared'
            });

            expect(CoreDeps.readFirstLines).toHaveBeenCalledWith(mockParams.requestPath, 20);
            expect(CoreDeps.writeJsonFile).toHaveBeenCalledWith(
                expect.stringContaining('result.json'),
                expect.objectContaining({
                    status: 'done',
                    summary: 'Documentation review guidance prepared'
                })
            );
            expect(CoreDeps.writeFileAtomic).toHaveBeenCalledWith(
                expect.stringContaining('notes.md'),
                expect.stringContaining('# Technical Writer')
            );
        });

        it('handles file read errors', async () => {
            (CoreDeps.readFirstLines as Mock).mockImplementation(() => {
                throw new Error('Read failed');
            });

            expect(() => runners.runTechnicalWriter(mockParams)).toThrow('Read failed');
        });

        it('handles dry-run mode', async () => {
            const dryRunParams = { ...mockParams, mode: 'dry-run' as const };
            (CoreDeps.readFirstLines as Mock).mockReturnValue(['Request line 1']);

            const result = await runners.runTechnicalWriter(dryRunParams);

            expect(result.status).toBe('done');
            expect(CoreDeps.writeJsonFile).toHaveBeenCalled();
        });
    });
});
