import { readFileSync } from "node:fs";
import { parse as parseYAML } from "yaml";
import type { StreamFormat } from "./converters/streams.js";

export interface ModelConfig {
  name: string;
  provider: StreamFormat;
  base_url: string;
  api_key: string;
  model: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface ServerConfig {
  port: number;
  models: ModelConfig[];
  fallback: Record<string, string[]>;
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? "");
}

function resolveDeep(obj: unknown): unknown {
  if (typeof obj === "string") return resolveEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(resolveDeep);
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveDeep(v);
    }
    return result;
  }
  return obj;
}

function parseJSONLikeValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeModelConfig(model: ModelConfig): ModelConfig {
  const headers =
    model.headers && typeof model.headers === "object"
      ? Object.fromEntries(Object.entries(model.headers).map(([key, value]) => [key, String(value)]))
      : undefined;
  const body =
    model.body && typeof model.body === "object"
      ? Object.fromEntries(Object.entries(model.body).map(([key, value]) => [key, parseJSONLikeValue(value)]))
      : undefined;

  return {
    ...model,
    ...(headers ? { headers } : {}),
    ...(body ? { body } : {}),
  };
}

export function loadConfig(path: string): ServerConfig {
  const raw = readFileSync(path, "utf-8");
  const parsed = resolveDeep(parseYAML(raw)) as {
    server?: { port?: number };
    models?: ModelConfig[];
    fallback?: Record<string, string[]>;
  };

  const models = (parsed.models ?? []).map(normalizeModelConfig);
  const fallback = parsed.fallback ?? {};
  for (const m of models) {
    if (!m.name) throw new Error("Model config missing 'name'");
    if (!m.provider) throw new Error(`Model '${m.name}' missing 'provider'`);
    if (!m.base_url) throw new Error(`Model '${m.name}' missing 'base_url'`);
    if (!m.model) throw new Error(`Model '${m.name}' missing 'model'`);
    if (!["openai-chat", "openai-responses", "anthropic"].includes(m.provider)) {
      throw new Error(`Model '${m.name}' has invalid provider '${m.provider}'. Must be openai-chat, openai-responses, or anthropic`);
    }
  }
  validateFallback(models, fallback);

  return {
    port: Number(process.env.PORT) || (parsed.server?.port ?? 3000),
    models,
    fallback,
  };
}

export function resolveModel(config: ServerConfig, name: string): ModelConfig | undefined {
  return config.models.find((m) => m.name === name);
}

export function resolveFallbackModels(config: ServerConfig, name: string): string[] {
  for (const members of Object.values(config.fallback)) {
    if (members.includes(name)) return members;
  }
  return [name];
}

function validateFallback(models: ModelConfig[], fallback: Record<string, string[]>) {
  const knownModels = new Set(models.map((model) => model.name));
  const assignedGroups = new Map<string, string>();

  for (const [groupName, members] of Object.entries(fallback)) {
    if (!Array.isArray(members) || members.length === 0) {
      throw new Error(`Fallback group '${groupName}' must be a non-empty model array`);
    }

    for (const member of members) {
      if (!knownModels.has(member)) {
        throw new Error(`Fallback group '${groupName}' references unknown model '${member}'`);
      }
      const existingGroup = assignedGroups.get(member);
      if (existingGroup && existingGroup !== groupName) {
        throw new Error(`Model '${member}' appears in multiple fallback groups: '${existingGroup}' and '${groupName}'`);
      }
      assignedGroups.set(member, groupName);
    }
  }
}
