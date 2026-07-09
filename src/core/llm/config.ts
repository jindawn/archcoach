import { z } from "zod";
import { resolveModel } from "./providers";
import type { GatewayConfig } from "./types";

const envSchema = z.object({
  LLM_PROVIDER: z.enum(["openai", "anthropic", "deepseek", "openrouter", "ollama"]),
  LLM_API_KEY: z.string().optional().default(""),
  LLM_MODEL: z.string().min(1),
  LLM_STRONG_MODEL: z.string().optional(),
  LLM_FALLBACK_MODEL: z.string().optional(),
  LLM_FALLBACK_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  OLLAMA_BASE_URL: z.string().optional(),
  LLM_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
});

/**
 * Builds the gateway configuration from environment variables.
 * Fails fast with a readable message when required settings are missing.
 */
export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid LLM configuration: ${issues}. Check your .env file.`);
  }
  const cfg = parsed.data;

  if (cfg.LLM_PROVIDER !== "ollama" && !cfg.LLM_API_KEY) {
    throw new Error(`LLM_API_KEY is required for provider "${cfg.LLM_PROVIDER}".`);
  }

  const providerOptions = {
    apiKey: cfg.LLM_API_KEY || undefined,
    baseUrl: cfg.LLM_BASE_URL || undefined,
    ollamaBaseUrl: cfg.OLLAMA_BASE_URL || undefined,
  };

  const standard = resolveModel(cfg.LLM_PROVIDER, cfg.LLM_MODEL, providerOptions);
  const strong = cfg.LLM_STRONG_MODEL
    ? resolveModel(cfg.LLM_PROVIDER, cfg.LLM_STRONG_MODEL, providerOptions)
    : standard;

  let fallback: GatewayConfig["fallback"];
  if (cfg.LLM_FALLBACK_MODEL) {
    const [fallbackProvider, ...rest] = cfg.LLM_FALLBACK_MODEL.split(":");
    const fallbackModelId = rest.join(":");
    if (!fallbackModelId) {
      throw new Error(
        `LLM_FALLBACK_MODEL must use the "provider:model" format, got "${cfg.LLM_FALLBACK_MODEL}".`,
      );
    }
    fallback = resolveModel(fallbackProvider, fallbackModelId, {
      apiKey: cfg.LLM_FALLBACK_API_KEY || undefined,
      ollamaBaseUrl: cfg.OLLAMA_BASE_URL || undefined,
    });
  }

  return {
    standard,
    strong,
    fallback,
    maxConcurrency: cfg.LLM_MAX_CONCURRENCY,
    timeoutMs: 120_000,
    backoffMs: 500,
  };
}
