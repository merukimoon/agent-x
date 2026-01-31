import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as rules from '../../rules.js';
import fs from 'fs';
import { fail } from '../../errors.js';
import { RULES_DIR, FLOW_ARCH_CHANGE } from '../../types.js';
import path from 'path';

vi.mock('fs');
vi.mock('../../errors.js');

describe('rules', () => {
    const mockRulePack = {
        flow_type: 'test-flow',
        keywords: ['test', 'foo'],
        steps: [
            {
                agent: 'planner',
                depends_on: []
            }
        ]
    };

    const mockArchPack = {
        flow_type: FLOW_ARCH_CHANGE,
        keywords: ['architecture', 'design'],
        steps: []
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true });
        (fs.readdirSync as Mock).mockReturnValue(['rule1.json']);
        (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(mockRulePack));
        (fail as unknown as Mock).mockImplementation((msg) => { throw new Error(msg); });
    });

    describe('loadRulePacks', () => {
        it('loads valid packs', () => {
            const packs = rules.loadRulePacks();
            expect(packs).toHaveLength(1);
            expect(packs[0]).toEqual(mockRulePack);
        });

        it('fails if directory missing', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            expect(() => rules.loadRulePacks()).toThrow(/Rules directory not found/);
        });

        it('fails if no rule packs', () => {
            (fs.readdirSync as Mock).mockReturnValue([]);
            expect(() => rules.loadRulePacks()).toThrow(/No rule packs found/);
        });

        it('fails on invalid pack structure', () => {
            (fs.readFileSync as Mock).mockReturnValue('{ "bad": true }');
            expect(() => rules.loadRulePacks()).toThrow(/Rule pack invalid/);
        });

        it('fails on read error', () => {
            (fs.readFileSync as Mock).mockImplementation(() => { throw new Error('Read error'); });
            expect(() => rules.loadRulePacks()).toThrow(/Failed to load rule pack/);
        });
    });

    describe('classifyFlow', () => {
        it('classifies based on keywords', () => {
            const result = rules.classifyFlow('this is a test request', '');
            expect(result.pack).toEqual(mockRulePack);
            expect(result.signals).toContain('keyword:test');
            expect(result.confidence).toBe('low');
        });

        it('fails if no classification possible', () => {
            (fs.readdirSync as Mock).mockReturnValue(['rule1.json']);
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(mockRulePack));

            expect(() => rules.classifyFlow('nothing matches here', '')).toThrow(/Unable to classify/);
        });

        it('prioritizes higher match count', () => {
            const pack2 = { ...mockRulePack, flow_type: 'better-flow', keywords: ['a', 'b', 'c'] };
            (fs.readdirSync as Mock).mockReturnValue(['rule1.json', 'rule2.json']);
            (fs.readFileSync as Mock).mockImplementation((p: string) => {
                if (p.includes('rule2')) return JSON.stringify(pack2);
                return JSON.stringify(mockRulePack);
            });

            const result = rules.classifyFlow('test a b c', '');
            expect(result.pack).toEqual(expect.objectContaining({ flow_type: 'better-flow' }));
            expect(result.confidence).toBe('high');
        });

        it('breaks ties with FLOW_ARCH_CHANGE', () => {
            const pack2 = { ...mockArchPack, keywords: ['test'] }; // Same keyword 'test'
            (fs.readdirSync as Mock).mockReturnValue(['rule1.json', 'rule2.json']);
            (fs.readFileSync as Mock).mockImplementation((p: string) => {
                if (p.includes('rule2')) return JSON.stringify(pack2);
                return JSON.stringify(mockRulePack);
            });

            // Both match 'test'. Count 1. Tie. pack2 is ARCH_CHANGE.
            const result = rules.classifyFlow('test request', '');
            expect(result.pack.flow_type).toBe(FLOW_ARCH_CHANGE);
        });
    });
});
