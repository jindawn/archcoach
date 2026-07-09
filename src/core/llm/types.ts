import type { LanguageModel } from "ai";
import type { z } from "zod";

/** standard = parallel role reviews; strong = summarize + artifacts. */
export type ModelTier = "standard" | "strong";

export interface ResolvedModel {
  provider: string;
  modelId: string;
  model: LanguageModel;
}

export interface GatewayConfig {
  standard: ResolvedModel;
  strong: ResolvedModel;
  fallback?: ResolvedModel;
  maxConcurrency: number;
  timeoutMs: number;
  /** base backoff between provider retries; tests set this to ~1ms */
  backoffMs: number;
}

export interface LlmCallRequest<T> {
  /** e.g. clarify | role_review:sre | summarize | artifact:adr */
  task: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  tier?: ModelTier;
  sessionId?: string;
  promptVersion?: string;
}

export interface LlmUsage {
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface LlmCallResult<T> {
  object: T;
  provider: string;
  model: string;
  usage: LlmUsage;
  costUsd: number | null;
  latencyMs: number;
  /** true when the fallback model produced the result */
  degraded: boolean;
  /** sanitizer hit types, e.g. ["api_key", "email"] */
  sanitizeHits: string[];
}

export interface CallLogEntry {
  sessionId: string | null;
  task: string;
  provider: string;
  model: string;
  promptVersion: string | null;
  inputHash: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
  status: "ok" | "degraded" | "failed";
  error: string | null;
}

/** Persistence is injected so core stays free of database imports. */
export type CallLogSink = (entry: CallLogEntry) => Promise<void>;

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly task: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}
