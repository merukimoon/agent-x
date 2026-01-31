import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as lock from '../../lock.js';
import fs from 'fs';
import { fail } from '../../errors.js';
import path from 'path';

vi.mock('fs');
vi.mock('../../errors.js');

describe('lock', () => {
    const mockRunDir = '/run/dir';
    const mockRunId = 'test-run';
    const mockMode = 'live';

    beforeEach(() => {
        vi.clearAllMocks();
        (fs.existsSync as Mock).mockReturnValue(false);
        (fail as unknown as Mock).mockImplementation((msg) => { throw new Error(msg); });
    });

    describe('createFlowLock', () => {
        it('creates lock file successfully', () => {
            const lockPath = lock.createFlowLock(mockRunDir, mockRunId, mockMode);

            expect(lockPath).toContain('.lock');
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                lockPath,
                expect.stringContaining('pid='),
                { encoding: 'utf8', flag: 'wx' }
            );
        });

        it('fails if lock exists', () => {
            (fs.existsSync as Mock).mockReturnValue(true);
            (fs.readFileSync as Mock).mockReturnValue('pid=123');

            expect(() => lock.createFlowLock(mockRunDir, mockRunId, mockMode)).toThrow(/Lock exists/);
        });

        it('fails on write error', () => {
            (fs.writeFileSync as Mock).mockImplementation(() => { throw new Error('Write failed'); });

            expect(() => lock.createFlowLock(mockRunDir, mockRunId, mockMode)).toThrow(/Unable to create lock/);
        });
    });

    describe('removeLock', () => {
        it('removes existing lock', () => {
            (fs.existsSync as Mock).mockReturnValue(true);
            lock.removeLock('/path/to/.lock');
            expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/.lock');
        });

        it('does nothing if lock missing', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            lock.removeLock('/path/to/.lock');
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        it('suppresses errors but warns', () => {
            (fs.existsSync as Mock).mockReturnValue(true);
            (fs.unlinkSync as Mock).mockImplementation(() => { throw new Error('Delete failed'); });

            const spy = vi.spyOn(console, 'error').mockImplementation(() => { });

            lock.removeLock('/path/to/.lock');

            expect(spy).toHaveBeenCalledWith(expect.stringMatching(/Unable to remove lock/));

            spy.mockRestore();
        });
    });
});
