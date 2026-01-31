import fs from "fs";
import path from "path";
import process from "process";
import { isAgentName, AgentName } from "../types.js";

type ProviderConfig = { endpoint: string; auth_env: string; auth_header: string; auth_prefix: string };
type AgentLlmConfig = { provider: string; model: string };
type LlmConfig = { defaults: AgentLlmConfig; agents: Record<string, AgentLlmConfig>; providers: Record<string, ProviderConfig> };
export type LlmTarget = { provider: string; model: string; endpoint: string; apiKey: string; authHeader: string; authPrefix: string };

let cachedConfig: LlmConfig | null = null;

function requireString(value: unknown, field: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Invalid or missing field "${field}" in llm_models.json`);
    }
    return value.trim();
}

function loadConfig(): LlmConfig {
    if (cachedConfig) return cachedConfig;
    const configPath = path.join(process.cwd(), "config", "llm_models.json");
    if (!fs.existsSync(configPath)) {
        throw new Error(`Missing LLM config at ${configPath}`);
    }
    let parsed: any;
    try {
        parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to parse ${configPath}: ${reason}`);
    }
    if (!parsed || typeof parsed !== "object") {
        throw new Error(`LLM config must be an object: ${configPath}`);
    }

    const providersRaw: any = parsed.providers;
    if (!providersRaw || typeof providersRaw !== "object") {
        throw new Error(`providers missing or invalid in ${configPath}`);
    }
    const providers: Record<string, ProviderConfig> = {};
    for (const [name, cfgRaw] of Object.entries(providersRaw as Record<string, any>)) {
        const cfg: any = cfgRaw;
        if (!cfg || typeof cfg !== "object") {
            throw new Error(`Provider "${name}" is invalid in ${configPath}`);
        }
        providers[name] = {
            endpoint: requireString(cfg.endpoint, `providers.${name}.endpoint`),
            auth_env: requireString(cfg.auth_env, `providers.${name}.auth_env`),
            auth_header: requireString(cfg.auth_header, `providers.${name}.auth_header`),
            auth_prefix: requireString(cfg.auth_prefix, `providers.${name}.auth_prefix`),
        };
    }
    if (Object.keys(providers).length === 0) {
        throw new Error(`providers must include at least one entry in ${configPath}`);
    }

    const defaultsRaw: any = parsed.defaults;
    if (!defaultsRaw || typeof defaultsRaw !== "object") {
        throw new Error(`defaults missing or invalid in ${configPath}`);
    }
    const defaults: AgentLlmConfig = {
        provider: requireString(defaultsRaw.provider, "defaults.provider"),
        model: requireString(defaultsRaw.model, "defaults.model"),
    };
    if (!providers[defaults.provider]) {
        throw new Error(`defaults.provider "${defaults.provider}" is not defined in providers`);
    }

    const agentsRaw: any = parsed.agents;
    if (!agentsRaw || typeof agentsRaw !== "object") {
        throw new Error(`agents missing or invalid in ${configPath}`);
    }
    const agents: Record<string, AgentLlmConfig> = {};
    for (const [name, cfgRaw] of Object.entries(agentsRaw as Record<string, any>)) {
        const cfg: any = cfgRaw;
        if (!isAgentName(name)) {
            throw new Error(`Unknown agent "${name}" in ${configPath}`);
        }
        if (!cfg || typeof cfg !== "object") {
            throw new Error(`Agent "${name}" entry is invalid in ${configPath}`);
        }
        const provider = requireString(cfg.provider, `agents.${name}.provider`);
        const model = requireString(cfg.model, `agents.${name}.model`);
        if (!providers[provider]) {
            throw new Error(`Agent "${name}" references unknown provider "${provider}"`);
        }
        agents[name] = { provider, model };
    }

    cachedConfig = { defaults, agents, providers };
    return cachedConfig;
}

/**
 * Resolve provider and model for an agent.
 * @param {AgentName} agent
 * @returns {LlmTarget}
 */
export function resolveLlmTarget(agent: AgentName): LlmTarget {
    const config = loadConfig();
    const agentCfg = config.agents[agent] || config.defaults;
    const providerCfg = config.providers[agentCfg.provider];
    if (!providerCfg) {
        throw new Error(`Provider "${agentCfg.provider}" is not defined in providers`);
    }

    const endpoint = process.env.LLM_ENDPOINT?.trim() || providerCfg.endpoint;
    const model = process.env.LLM_MODEL?.trim() || agentCfg.model;
    const apiKey =
        process.env.LLM_API_KEY?.trim() ||
        process.env[providerCfg.auth_env]?.trim();

    if (!apiKey) {
        throw new Error(
            `Missing API key for provider ${agentCfg.provider}. Set LLM_API_KEY or ${providerCfg.auth_env}.`
        );
    }

    return {
        provider: agentCfg.provider,
        model,
        endpoint,
        apiKey,
        authHeader: providerCfg.auth_header,
        authPrefix: providerCfg.auth_prefix,
    };
}

/**
 * Test helper to clear cached config between runs.
 */
export function resetLlmConfigCacheForTests() {
    cachedConfig = null;
}
