import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as registry from '../../registry.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('registry', () => {
    const mockRegistryPath = 'registry.json';
    const mockRoleDir = path.join(process.cwd(), 'domain/roles/planner');
    const mockReadme = path.join(mockRoleDir, 'README.md');

    beforeEach(() => {
        vi.clearAllMocks();
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.statSync as Mock).mockReturnValue({ isDirectory: () => true, isFile: () => true });
        (fs.readFileSync as Mock).mockReturnValue('[]');
    });

    describe('loadRolesRegistry', () => {
        it('throws if registry missing', () => {
            (fs.existsSync as Mock).mockReturnValue(false);
            expect(() => registry.loadRolesRegistry(mockRegistryPath)).toThrow(/not found/);
        });

        it('throws if invalid JSON', () => {
            (fs.readFileSync as Mock).mockReturnValue('{ bad');
            expect(() => registry.loadRolesRegistry(mockRegistryPath)).toThrow(/Failed to parse/);
        });

        it('throws if empty array', () => {
            (fs.readFileSync as Mock).mockReturnValue('[]');
            expect(() => registry.loadRolesRegistry(mockRegistryPath)).toThrow(/non-empty array/);
        });

        it('throws on duplicate IDs', () => {
            const dupes = [
                { id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] },
                { id: 'planner', runner: 'llm' }
            ];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(dupes));
            expect(() => registry.loadRolesRegistry(mockRegistryPath)).toThrow(/Duplicate role id/);
        });

        it('throws on invalid runner', () => {
            const invalid = [
                { id: 'planner', runner: 'magic', required_artifacts: [] }
            ];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(invalid));
            expect(() => registry.loadRolesRegistry(mockRegistryPath)).toThrow(/Invalid runner type/);
        });

        it('validates required artifacts', () => {
            const missingArts = [
                { id: 'planner', runner: 'llm', required_artifacts: ['result.json'] }
            ];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(missingArts));
            expect(() => registry.loadRolesRegistry(mockRegistryPath)).toThrow(/must include notes.md/);
        });

        it('validates docs existence', () => {
            const valid = [
                { id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] }
            ];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(valid));

            // Mock docs missing
            (fs.existsSync as Mock).mockImplementation((p: string) => {
                if (p === mockRegistryPath) return true;
                if (p.includes('domain')) return false;
                return true;
            });

            expect(() => registry.loadRolesRegistry(mockRegistryPath)).toThrow(/Role planner is not defined/);
        });

        it('loads valid registry', () => {
            const valid = [
                { id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] }
            ];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(valid));

            const result = registry.loadRolesRegistry(mockRegistryPath);
            expect(result.roles).toHaveLength(1);
            expect(result.byId.has('planner')).toBe(true);
        });
    });

    describe('requireExecutableRole', () => {
        it('returns role if found', () => {
            const valid = [
                { id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] }
            ];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(valid));

            const role = registry.requireExecutableRole('planner', mockRegistryPath);
            expect(role.id).toBe('planner');
        });

        it('throws if not found', () => {
            const valid = [
                { id: 'planner', runner: 'llm', required_artifacts: ['result.json', 'notes.md', 'status.json'] }
            ];
            (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(valid));

            expect(() => registry.requireExecutableRole('unknown', mockRegistryPath)).toThrow(/not executable/);
        });
    });
});
