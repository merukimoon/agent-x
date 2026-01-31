// @ts-check

import fs from "fs";
import path from "path";
import process from "process";
import { isAgentName } from "./types.ts";

type RunnerType = "llm" | "rule" | "human_gate";

export interface RoleEntry {
    id: string;
    runner: RunnerType;
    blocking: boolean;
    required_artifacts: string[];
}

export interface RoleRegistry {
    roles: RoleEntry[];
    byId: Map<string, RoleEntry>;
}

const REQUIRED_ARTIFACT_SUFFIXES = ["result.json", "notes.md", "status.json"];

function ensureArtifacts(entry: RoleEntry) {
    if (!Array.isArray(entry.required_artifacts) || entry.required_artifacts.length === 0) {
        throw new Error(`Role ${entry.id} must declare required_artifacts`);
    }
    const missing = REQUIRED_ARTIFACT_SUFFIXES.filter((suffix) =>
        !entry.required_artifacts.some((a) => typeof a === "string" && a.endsWith(suffix))
    );
    if (missing.length > 0) {
        throw new Error(`Role ${entry.id} required_artifacts must include ${missing.join(", ")}`);
    }
}

function assertRoleDocsExist(roleId: string) {
    const roleDir = path.join(process.cwd(), "domain", "roles", roleId);
    if (!fs.existsSync(roleDir) || !fs.statSync(roleDir).isDirectory()) {
        throw new Error(`Role ${roleId} is not defined under domain/roles/${roleId}`);
    }
    const readmePath = path.join(roleDir, "README.md");
    if (!fs.existsSync(readmePath) || !fs.statSync(readmePath).isFile()) {
        throw new Error(`Role ${roleId} is missing domain/roles/${roleId}/README.md`);
    }
}

/**
 * Load and validate the executable roles registry.
 * @param {string | null} registryPath
 * @returns {RoleRegistry}
 */
export function loadRolesRegistry(registryPath: string | null = null): RoleRegistry {
    const resolvedPath =
        registryPath ??
        path.join(process.cwd(), "domain", "roles", "registry.json");

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Roles registry not found at ${resolvedPath}`);
    }

    let parsed: any;
    try {
        parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to parse roles registry: ${reason}`);
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Roles registry must be a non-empty array");
    }

    /** @type {RoleEntry[]} */
    const roles: RoleEntry[] = [];
    const seen = new Set<string>();
    for (const entry of parsed) {
        if (!entry || typeof entry !== "object") {
            throw new Error("Invalid role entry in registry");
        }
        const id = String(entry.id || "").trim();
        if (!isAgentName(id as any)) {
            throw new Error(`Unknown or unsupported role id "${id}" in registry`);
        }
        if (seen.has(id)) {
            throw new Error(`Duplicate role id "${id}" in registry`);
        }
        seen.add(id);
        const runner = entry.runner;
        if (runner !== "llm" && runner !== "rule" && runner !== "human_gate") {
            throw new Error(`Invalid runner type for role ${id}: ${runner}`);
        }
        const blocking = Boolean(entry.blocking);
        const required_artifacts = Array.isArray(entry.required_artifacts)
            ? entry.required_artifacts.map((v: any) => String(v))
            : [];
        const roleEntry: RoleEntry = { id, runner, blocking, required_artifacts };
        ensureArtifacts(roleEntry);
        assertRoleDocsExist(id);
        roles.push(roleEntry);
    }

    return {
        roles,
        byId: new Map(roles.map((r) => [r.id, r])),
    };
}

/**
 * Get registry entry for an agent or throw.
 * @param {string} agent
 * @param {string | null} registryPath
 */
export function requireExecutableRole(agent: string, registryPath: string | null = null): RoleEntry {
    const registry = loadRolesRegistry(registryPath);
    const entry = registry.byId.get(agent);
    if (!entry) {
        throw new Error(`Agent "${agent}" is not executable per registry`);
    }
    return entry;
}
