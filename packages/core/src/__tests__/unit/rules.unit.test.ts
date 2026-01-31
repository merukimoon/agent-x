import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as rules from '../../rules.js';
import fs from 'fs';
import { fail } from '../../errors.js';
import { RULES_DIR } from '../../types.js';
import path from 'path';

vi.mock('fs');
vi.mock('../../errors.js');

describe('rules', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateRulePack', () => {
        // We test via loadRulePacks since validation is internal/used there, 
        // or we can test loadRulePacks which calls it.
        // loadRulePacks catches errors and fails with "Failed to load rule pack X: reason".

        it('fails on invalid step structure', () => {
            (fs.existsSync as Mock).mockReturnValue(true);
            (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true });
            (fs.readdirSync as Mock).mockReturnValue(['pack.json']);

            const invalidPack = {
                flow_type: 'flow',
                keywords: [],
                steps: ['not-object'] // Invalid step
            };
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(invalidPack));

            rules.loadRulePacks();
            // Expected catch handler calling fail
            expect(fail).toHaveBeenCalledWith(expect.stringContaining('Rule pack step 0 invalid'));
        });

        it('fails on invalid step agent', () => {
            (fs.existsSync as Mock).mockReturnValue(true);
            (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true });
            (fs.readdirSync as Mock).mockReturnValue(['pack.json']);

            const invalidPack = {
                flow_type: 'flow',
                keywords: [],
                steps: [
                    { agent: 'unknown', depends_on: [] }
                ]
            };
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(invalidPack));

            rules.loadRulePacks();
            expect(fail).toHaveBeenCalledWith(expect.stringContaining('invalid agent'));
        });

        it('fails on invalid depends_on', () => {
            (fs.existsSync as Mock).mockReturnValue(true);
            (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true });
            (fs.readdirSync as Mock).mockReturnValue(['pack.json']);

            const invalidPack = {
                flow_type: 'flow',
                keywords: [],
                steps: [
                    { agent: 'planner', depends_on: 'not_array' }
                ]
            };
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(invalidPack));

            rules.loadRulePacks();
            expect(fail).toHaveBeenCalledWith(expect.stringContaining('depends_on invalid'));
        });
    });
});
