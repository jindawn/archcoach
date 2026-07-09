import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ResolvedModel } from "./types";

export type ProviderName = "openai" | "anthropic" | "deepseek" | "openrouter" | "ollama";

const OPENAI_COMPATIBLE_BASE_URLS: Record<string, string> = {
  deepseek: "https://api.deepseek.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

export interface ProviderOptions {
  apiKey?: string;
  /** custom base url (openai-compatible endpoints, self-hosted gateways) */
  baseUrl?: string;
  /** ollama server url, e.g. http://localhost:11434 */
  ollamaBaseUrl?: string;
}

export function resolveModel(
  provider: string,
  modelId: string,
  options: ProviderOptions = {},
): ResolvedModel {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey: options.apiKey, baseURL: options.baseUrl });
      return { provider, modelId, model: openai(modelId) };
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: options.apiKey, baseURL: options.baseUrl });
      return { provider, modelId, model: anthropic(modelId) };
    }
    case "deepseek":
    case "openrouter": {
      const compatible = createOpenAICompatible({
        name: provider,
        apiKey: options.apiKey,
        baseURL: options.baseUrl ?? OPENAI_COMPATIBLE_BASE_URLS[provider],
      });
      return { provider, modelId, model: compatible(modelId) };
    }
    case "ollama": {
      const base = options.ollamaBaseUrl ?? "http://localhost:11434";
      const compatible = createOpenAICompatible({
        name: "ollama",
        apiKey: options.apiKey ?? "ollama",
        baseURL: `${base.replace(/\/$/, "")}/v1`,
        // Ollama >= 0.5 honors response_format json_schema (constrained
        // decoding), which makes even small local models emit valid JSON.
        supportsStructuredOutputs: true,
      });
      return { provider, modelId, model: compatible(modelId) };
    }
    default:
      throw new Error(
        `Unknown LLM provider "${provider}". Supported: openai, anthropic, deepseek, openrouter, ollama`,
      );
  }
}
