import {
  APICallError,
  generateText,
  JSONParseError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  TypeValidationError,
} from "ai";
import pLimit from "p-limit";
import { estimateCostUsd } from "./cost";
import { computeInputHash } from "./hash";
import { sanitizeText } from "./sanitize";
import {
  GatewayError,
  type CallLogSink,
  type GatewayConfig,
  type LlmCallRequest,
  type LlmCallResult,
  type LlmUsage,
  type ResolvedModel,
} from "./types";

const MAX_REPAIR_ATTEMPTS = 2;
const MAX_NETWORK_RETRIES = 2;

export interface Gateway {
  call<T>(request: LlmCallRequest<T>): Promise<LlmCallResult<T>>;
}

interface AttemptOutcome<T> {
  object: T;
  usage: LlmUsage;
}

function extractUsage(usage: {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}): LlmUsage {
  return {
    promptTokens: usage.inputTokens ?? null,
    completionTokens: usage.outputTokens ?? null,
  };
}

function isRetryableProviderError(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    return error.isRetryable || (error.statusCode !== undefined && error.statusCode >= 500);
  }
  // network-level failures (fetch TypeError, aborts) are worth one more try
  return error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGateway(config: GatewayConfig, logSink?: CallLogSink): Gateway {
  const limit = pLimit(config.maxConcurrency);

  async function attemptWithModel<T>(
    resolved: ResolvedModel,
    request: LlmCallRequest<T>,
    system: string,
    prompt: string,
  ): Promise<AttemptOutcome<T>> {
    let repairAttempts = 0;
    let networkRetries = 0;
    let currentPrompt = prompt;

    for (;;) {
      try {
        const result = await generateText({
          model: resolved.model,
          system,
          prompt: currentPrompt,
          output: Output.object({ schema: request.schema }),
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(config.timeoutMs),
        });
        const object = await result.output;
        if (object === undefined) {
          throw new Error("model returned no structured output");
        }
        return { object, usage: extractUsage(result.usage) };
      } catch (error) {
        if (isRetryableProviderError(error) && networkRetries < MAX_NETWORK_RETRIES) {
          networkRetries += 1;
          await sleep(config.backoffMs * 2 ** (networkRetries - 1));
          continue;
        }
        // schema/parse failures: feed the validation error back once or twice
        const message = errorMessage(error);
        const isOutputFailure =
          NoOutputGeneratedError.isInstance(error) ||
          NoObjectGeneratedError.isInstance(error) ||
          TypeValidationError.isInstance(error) ||
          JSONParseError.isInstance(error) ||
          (!APICallError.isInstance(error) &&
            /schema|json|parse|validat|structured output/i.test(message));
        if (isOutputFailure && repairAttempts < MAX_REPAIR_ATTEMPTS) {
          repairAttempts += 1;
          currentPrompt = `${prompt}\n\n---\nYour previous response failed validation with this error:\n${message}\nReturn ONLY a valid JSON object that matches the required schema. No markdown fences, no commentary.`;
          continue;
        }
        throw error;
      }
    }
  }

  async function call<T>(request: LlmCallRequest<T>): Promise<LlmCallResult<T>> {
    const primary = request.tier === "strong" ? config.strong : config.standard;

    const systemResult = sanitizeText(request.system);
    const promptResult = sanitizeText(request.prompt);
    const sanitizeHits = [...new Set([...systemResult.hits, ...promptResult.hits])];

    const inputHash = computeInputHash([
      request.promptVersion ?? "",
      primary.modelId,
      systemResult.text,
      promptResult.text,
    ]);

    const startedAt = Date.now();

    const log = async (
      resolved: ResolvedModel,
      status: "ok" | "degraded" | "failed",
      usage: LlmUsage,
      error: string | null,
    ) => {
      if (!logSink) return;
      try {
        await logSink({
          sessionId: request.sessionId ?? null,
          task: request.task,
          provider: resolved.provider,
          model: resolved.modelId,
          promptVersion: request.promptVersion ?? null,
          inputHash,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          costUsd: estimateCostUsd(resolved.modelId, usage.promptTokens, usage.completionTokens),
          latencyMs: Date.now() - startedAt,
          status,
          error,
        });
      } catch {
        // logging must never break the review flow
      }
    };

    return limit(async () => {
      try {
        const outcome = await attemptWithModel(
          primary,
          request,
          systemResult.text,
          promptResult.text,
        );
        await log(primary, "ok", outcome.usage, null);
        return {
          object: outcome.object,
          provider: primary.provider,
          model: primary.modelId,
          usage: outcome.usage,
          costUsd: estimateCostUsd(
            primary.modelId,
            outcome.usage.promptTokens,
            outcome.usage.completionTokens,
          ),
          latencyMs: Date.now() - startedAt,
          degraded: false,
          sanitizeHits,
        };
      } catch (primaryError) {
        if (!config.fallback) {
          await log(primary, "failed", { promptTokens: null, completionTokens: null }, errorMessage(primaryError));
          throw new GatewayError(
            `LLM call failed for task "${request.task}": ${errorMessage(primaryError)}`,
            request.task,
            primaryError,
          );
        }
        try {
          const outcome = await attemptWithModel(
            config.fallback,
            request,
            systemResult.text,
            promptResult.text,
          );
          await log(config.fallback, "degraded", outcome.usage, errorMessage(primaryError));
          return {
            object: outcome.object,
            provider: config.fallback.provider,
            model: config.fallback.modelId,
            usage: outcome.usage,
            costUsd: estimateCostUsd(
              config.fallback.modelId,
              outcome.usage.promptTokens,
              outcome.usage.completionTokens,
            ),
            latencyMs: Date.now() - startedAt,
            degraded: true,
            sanitizeHits,
          };
        } catch (fallbackError) {
          await log(
            config.fallback,
            "failed",
            { promptTokens: null, completionTokens: null },
            `primary: ${errorMessage(primaryError)}; fallback: ${errorMessage(fallbackError)}`,
          );
          throw new GatewayError(
            `LLM call failed for task "${request.task}" on primary and fallback: ${errorMessage(fallbackError)}`,
            request.task,
            fallbackError,
          );
        }
      }
    });
  }

  return { call };
}
