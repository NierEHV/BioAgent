// ============================================================
// @bioagent/agent-core — BioAgent Configuration
// ============================================================

import type { BioAgentConfig } from "./types";

/** 默认配置 — 可由环境变量覆盖 */
export const DEFAULT_CONFIG: BioAgentConfig = {
  model: "claude-sonnet-4-6",
  maxTokens: 100_000,
  thinkingBudget: "medium",
  temperature: 0.2,
  sessionDir: "data/sessions",
  projectDir: "data/projects",
  maxSessionLength: 200,
  autoCompress: true,
  requireConfirmation: true,
  maxParallelSkills: 4,
  defaultTimeout: 600_000,
};

/** 环境变量 → 配置键映射 */
const ENV_MAP: Record<string, keyof BioAgentConfig> = {
  BIOAGENT_MODEL: "model",
  BIOAGENT_MAX_TOKENS: "maxTokens",
  BIOAGENT_THINKING_BUDGET: "thinkingBudget",
  BIOAGENT_TEMPERATURE: "temperature",
  BIOAGENT_SESSION_DIR: "sessionDir",
  BIOAGENT_PROJECT_DIR: "projectDir",
  BIOAGENT_MAX_SESSION_LENGTH: "maxSessionLength",
  BIOAGENT_AUTO_COMPRESS: "autoCompress",
  BIOAGENT_REQUIRE_CONFIRMATION: "requireConfirmation",
  BIOAGENT_MAX_PARALLEL_SKILLS: "maxParallelSkills",
  BIOAGENT_DEFAULT_TIMEOUT: "defaultTimeout",
};

/** 合并环境变量 + 用户覆盖 → 完整配置 */
export function loadConfig(overrides: Partial<BioAgentConfig> = {}): BioAgentConfig {
  const config = { ...DEFAULT_CONFIG };

  for (const [envKey, configKey] of Object.entries(ENV_MAP)) {
    const value = process.env[envKey];
    if (value !== undefined) {
      (config as Record<string, unknown>)[configKey] = parseEnvValue(
        value,
        typeof config[configKey],
      );
    }
  }

  return { ...config, ...overrides };
}

function parseEnvValue(value: string, type: string): unknown {
  switch (type) {
    case "number":
      return parseInt(value, 10);
    case "boolean":
      return value === "true" || value === "1";
    default:
      return value;
  }
}

/** 验证配置有效性，返回错误列表（空数组 = 有效） */
export function validateConfig(config: BioAgentConfig): string[] {
  const errors: string[] = [];

  if (config.maxTokens < 1000) errors.push("maxTokens must be >= 1000");
  if (config.maxTokens > 200_000) errors.push("maxTokens must be <= 200000");
  if (config.temperature < 0 || config.temperature > 1) errors.push("temperature must be 0–1");
  if (!["off", "low", "medium", "high", "xhigh"].includes(config.thinkingBudget)) {
    errors.push(`thinkingBudget must be one of: off, low, medium, high, xhigh`);
  }
  if (config.maxSessionLength < 10) errors.push("maxSessionLength must be >= 10");
  if (config.maxParallelSkills < 1) errors.push("maxParallelSkills must be >= 1");
  if (config.defaultTimeout < 5000) errors.push("defaultTimeout must be >= 5000ms");

  return errors;
}
