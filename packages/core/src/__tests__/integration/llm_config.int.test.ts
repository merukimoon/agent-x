import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveLlmTarget,
  resetLlmConfigCacheForTests,
} from "../../../../../scripts/agentic/llm_config";

const ORIGINAL_ENV = { ...process.env };

function writeConfig(root: string, config: unknown) {
  const cfgDir = path.join(root, "config");
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(
    path.join(cfgDir, "llm_models.json"),
    JSON.stringify(config, null, 2),
    "utf8"
  );
}

describe("llm_config", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-config-"));
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    resetLlmConfigCacheForTests();
    ["LLM_API_KEY", "LLM_ENDPOINT", "LLM_MODEL", "OPENAI_API_KEY"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(ORIGINAL_ENV, key)) {
        process.env[key] = ORIGINAL_ENV[key] as string;
      } else {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.entries(ORIGINAL_ENV).forEach(([key, value]) => {
      process.env[key] = value as string;
    });
    ["LLM_API_KEY", "LLM_ENDPOINT", "LLM_MODEL", "OPENAI_API_KEY"].forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(ORIGINAL_ENV, key)) {
        delete process.env[key];
      }
    });
    resetLlmConfigCacheForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects unknown agent entries", () => {
    writeConfig(tempDir, {
      defaults: { provider: "openai", model: "gpt-4o" },
      agents: { unknown: { provider: "openai", model: "gpt-4o" } },
      providers: {
        openai: {
          endpoint: "https://api.openai.com/v1/chat/completions",
          auth_env: "OPENAI_API_KEY",
          auth_header: "Authorization",
          auth_prefix: "Bearer ",
        },
      },
    });
    process.env.OPENAI_API_KEY = "key";
    expect(() => resolveLlmTarget("planner")).toThrow(/Unknown agent/);
  });

  it("rejects unknown providers", () => {
    writeConfig(tempDir, {
      defaults: { provider: "openai", model: "gpt-4o" },
      agents: { planner: { provider: "missing", model: "gpt-4o" } },
      providers: {
        openai: {
          endpoint: "https://api.openai.com/v1/chat/completions",
          auth_env: "OPENAI_API_KEY",
          auth_header: "Authorization",
          auth_prefix: "Bearer ",
        },
      },
    });
    process.env.OPENAI_API_KEY = "key";
    expect(() => resolveLlmTarget("planner")).toThrow(/unknown provider/i);
  });

  it("applies defaults when no agent override exists", () => {
    writeConfig(tempDir, {
      defaults: { provider: "openai", model: "gpt-4o" },
      agents: {},
      providers: {
        openai: {
          endpoint: "https://api.openai.com/v1/chat/completions",
          auth_env: "OPENAI_API_KEY",
          auth_header: "Authorization",
          auth_prefix: "Bearer ",
        },
      },
    });
    process.env.OPENAI_API_KEY = "key";
    const target = resolveLlmTarget("architect");
    expect(target.provider).toBe("openai");
    expect(target.model).toBe("gpt-4o");
    expect(target.endpoint).toMatch(/openai/);
  });

  it("uses env overrides for api key, endpoint, and model", () => {
    writeConfig(tempDir, {
      defaults: { provider: "openai", model: "base-model" },
      agents: { planner: { provider: "openai", model: "config-model" } },
      providers: {
        openai: {
          endpoint: "https://api.openai.com/v1/chat/completions",
          auth_env: "OPENAI_API_KEY",
          auth_header: "Authorization",
          auth_prefix: "Bearer ",
        },
      },
    });
    process.env.LLM_API_KEY = "override-key";
    process.env.LLM_ENDPOINT = "https://override.example.com";
    process.env.LLM_MODEL = "override-model";
    const target = resolveLlmTarget("planner");
    expect(target.apiKey).toBe("override-key");
    expect(target.endpoint).toBe("https://override.example.com");
    expect(target.model).toBe("override-model");
  });

  it("fails fast when api key is missing", () => {
    writeConfig(tempDir, {
      defaults: { provider: "openai", model: "gpt-4o" },
      agents: { planner: { provider: "openai", model: "gpt-4o" } },
      providers: {
        openai: {
          endpoint: "https://api.openai.com/v1/chat/completions",
          auth_env: "OPENAI_API_KEY",
          auth_header: "Authorization",
          auth_prefix: "Bearer ",
        },
      },
    });
    delete process.env.OPENAI_API_KEY;
    expect(() => resolveLlmTarget("planner")).toThrow(/OPENAI_API_KEY/);
  });
});
