import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import * as fsModule from '../../fs.js';
import fs from 'fs';
import { fail } from '../../errors.js';

vi.mock('fs');
vi.mock('../../errors.js');

describe('fs', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('readFirstLines', () => {
        it('reads lines successfully', () => {
            (fs.readFileSync as Mock).mockReturnValue('line1\nline2\nline3');
            const lines = fsModule.readFirstLines('file.txt', 2);
            expect(lines).toEqual(['line1', 'line2']);
        });

        it('fails on error', () => {
            (fs.readFileSync as Mock).mockImplementation(() => { throw new Error('IO Error'); });
            fsModule.readFirstLines('file.txt', 2);
            expect(fail).toHaveBeenCalledWith(expect.stringContaining('Unable to read file'));
        });
    });

    describe('readFileText', () => {
        it('reads content successfully', () => {
            (fs.readFileSync as Mock).mockReturnValue('content');
            expect(fsModule.readFileText('file.txt')).toBe('content');
        });

        it('fails on error', () => {
            (fs.readFileSync as Mock).mockImplementation(() => { throw new Error('IO Error'); });
            fsModule.readFileText('file.txt');
            expect(fail).toHaveBeenCalledWith(expect.stringContaining('Unable to read file'));
        });
    });

    describe('ensureRunAndInputs', () => {
        it('validates run dir exists', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            fsModule.ensureRunAndInputs('/run');
            expect(fail).toHaveBeenCalledWith(expect.stringContaining('Run directory not found'));
        });

        it('validates inputs exist', () => {
            (fs.existsSync as Mock).mockImplementation((p: string) => {
                if (p === '/run') return true;
                return false;
            });
            (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true });

            fsModule.ensureRunAndInputs('/run');
            expect(fail).toHaveBeenCalledWith(expect.stringContaining('Input file not found'));
        });
    });

    describe('writeFileAtomic', () => {
        it('writes successfully with fsync', () => {
            const openSync = vi.spyOn(fs, 'openSync').mockReturnValue(123);
            const fsyncSync = vi.spyOn(fs, 'fsyncSync');
            const closeSync = vi.spyOn(fs, 'closeSync');
            const renameSync = vi.spyOn(fs, 'renameSync');

            fsModule.writeFileAtomic('file.txt', 'data');

            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(openSync).toHaveBeenCalled();
            expect(fsyncSync).toHaveBeenCalledWith(123);
            expect(closeSync).toHaveBeenCalledWith(123);
            expect(renameSync).toHaveBeenCalled();
        });

        it('ignores fsync POSIX errors', () => {
            vi.spyOn(fs, 'openSync').mockReturnValue(123);
            vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
                const err: any = new Error('EPERM');
                err.code = 'EPERM';
                throw err;
            });

            expect(() => fsModule.writeFileAtomic('file.txt', 'data')).not.toThrow();
        });

        it('throws other fsync errors', () => {
            vi.spyOn(fs, 'openSync').mockReturnValue(123);
            vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
                const err: any = new Error('Fatal');
                err.code = 'EIO';
                throw err;
            });

            expect(() => fsModule.writeFileAtomic('file.txt', 'data')).toThrow('Fatal');
        });

        it('ignores close errors', () => {
            vi.spyOn(fs, 'openSync').mockReturnValue(123);
            vi.spyOn(fs, 'closeSync').mockImplementation(() => { throw new Error('Close fail'); });

            expect(() => fsModule.writeFileAtomic('file.txt', 'data')).not.toThrow();
        });
    });
});
