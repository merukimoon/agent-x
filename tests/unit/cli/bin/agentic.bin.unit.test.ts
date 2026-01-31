import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as agentic from '../../../../packages/cli/src/bin/agentic.js';
import * as cliIndex from '../../../../packages/cli/src/index.js';
import process from 'process';

vi.mock('../../../../packages/cli/src/index.js');

describe('agentic binary entry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as any);
    });

    it('delegates to runCli', async () => {
        const argv = ['node', 'agentic', 'status'];
        await agentic.main(argv);
        expect(cliIndex.runCli).toHaveBeenCalledWith(argv);
    });

    it('catches error and exits', async () => {
        (cliIndex.runCli as Mock).mockRejectedValue(new Error('CLI Failed'));

        await expect(agentic.main([])).rejects.toThrow('process.exit');

        expect(console.error).toHaveBeenCalledWith('CLI Error:', expect.any(Error));
        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
