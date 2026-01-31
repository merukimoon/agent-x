import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as registryModule from '../../registry.js';
import fs from 'fs';
import path from 'path';
import process from 'process';

vi.mock('fs');
vi.mock('process', () => {
    return {
        default: {
            cwd: vi.fn(() => '/repo'),
        },
        cwd: vi.fn(() => '/repo')
    };
});

describe('registry', () => {
    const mockCwd = '/repo';
    beforeEach(() => {
        vi.clearAllMocks();
        (process.cwd as Mock).mockReturnValue(mockCwd);
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true, isFile: () => true });
    });

    const normalize = (p: string) => p.split(path.sep).join('/');

    describe('loadRolesRegistry', () => {
        it('throws if registry file missing', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            expect(() => registryModule.loadRolesRegistry()).toThrow('Roles registry not found');
        });

        it('throws if json parse fails', () => {
            (fs.readFileSync as Mock).mockReturnValue('{ invalid json');
            expect(() => registryModule.loadRolesRegistry()).toThrow('Failed to parse roles registry');
        });

        it('throws if not array', () => {
            (fs.readFileSync as Mock).mockReturnValue('{}');
            expect(() => registryModule.loadRolesRegistry()).toThrow('must be a non-empty array');
        });

        it('throws on invalid entry object', () => {
            (fs.readFileSync as Mock).mockReturnValue('[null]');
            expect(() => registryModule.loadRolesRegistry()).toThrow('Invalid role entry');
        });

        it('throws on unknown role id (not AgentName)', () => {
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify([{ id: 'invalid_role' }]));
            expect(() => registryModule.loadRolesRegistry()).toThrow('Unknown or unsupported role id');
        });

        it('throws on duplicate id', () => {
            const entry = { id: 'planner', runner: 'llm', required_artifacts: ['result.json'] };
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify([entry, entry]));
            expect(() => registryModule.loadRolesRegistry()).toThrow('Duplicate role id');
        });

        it('throws on invalid runner', () => {
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify([{ id: 'planner', runner: 'weird', required_artifacts: ['result.json'] }]));
            expect(() => registryModule.loadRolesRegistry()).toThrow('Invalid runner type');
        });

        it('throws on missing required artifacts for role', () => {
            // Missing 'result.json' suffix check
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify([{ id: 'planner', runner: 'llm', required_artifacts: ['other.json'] }]));
            expect(() => registryModule.loadRolesRegistry()).toThrow('must include result.json');
        });

        it('throws if role docs missing', () => {
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify([{ id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] }]));
            // Mock doc check fail
            (fs.existsSync as Mock).mockImplementation((p: string) => {
                if (normalize(p).includes('domain/roles/planner/README.md')) return false;
                // Allow registry read
                if (normalize(p).includes('registry.json')) return true;
                if (normalize(p).includes('domain/roles/planner')) return true; // dir exists
                return true;
            });
            expect(() => registryModule.loadRolesRegistry()).toThrow('missing domain/roles/planner/README.md');
        });

        it('loads valid registry', () => {
            const payload = [{ id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] }];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(payload));
            const reg = registryModule.loadRolesRegistry();
            expect(reg.roles).toHaveLength(1);
            expect(reg.byId.get('planner')).toBeDefined();
        });
    });

    describe('requireExecutableRole', () => {
        it('returns entry for known agent', () => {
            const payload = [{ id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] }];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(payload));
            const role = registryModule.requireExecutableRole('planner');
            expect(role.id).toBe('planner');
        });

        it('throws for unknown agent', () => {
            const payload = [{ id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] }];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(payload));
            expect(() => registryModule.requireExecutableRole('coordinator')).toThrow('not executable per registry');
        });
    });
});
