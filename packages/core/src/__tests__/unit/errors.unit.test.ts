import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as errors from '../../errors.js';

describe('errors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as any);
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    describe('fail', () => {
        it('throws CLIError', () => {
            expect(() => errors.fail('msg', { exitCode: 2 })).toThrow(errors.CLIError);
        });
    });

    describe('handleFatalError', () => {
        it('handles CLIError with usage', () => {
            const err = new errors.CLIError('msg', { exitCode: 10, showUsage: true });
            expect(() => errors.handleFatalError(err, 'usage info')).toThrow('process.exit');
            expect(process.exit).toHaveBeenCalledWith(10);
            expect(console.error).toHaveBeenCalledWith('ERROR: msg');
            expect(console.error).toHaveBeenCalledWith('usage info');
        });

        it('handles generic Error', () => {
            const err = new Error('generic');
            expect(() => errors.handleFatalError(err)).toThrow('process.exit');
            expect(process.exit).toHaveBeenCalledWith(1);
            expect(console.error).toHaveBeenCalledWith('ERROR: Unexpected failure.');
            expect(console.error).toHaveBeenCalledWith('generic');
        });

        it('handles unknown error type', () => {
            expect(() => errors.handleFatalError('unknownString')).toThrow('process.exit');
            expect(process.exit).toHaveBeenCalledWith(1);
        });
    });
});
