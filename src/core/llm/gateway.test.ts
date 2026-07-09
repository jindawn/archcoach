import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { createGateway } from "./gateway";
import type { CallLogEntry, GatewayConfig, ResolvedModel } from "./types";

const schema = z.object({ answer: z.string(), score: z.number() });

function textResponse(text: string, tokens = { inputTokens: 100, outputTokens: 50 }) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: {
        total: tokens.inputTokens,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: tokens.outputTokens,
        text: undefined,
        reasoning: undefined,
      },
    },
    warnings: [],
  };
}

function makeResolved(model: MockLanguageModelV4, modelId = "deepseek-chat"): ResolvedModel {
  return { provider: "test", modelId, model };
}

function makeConfig(primary: ResolvedModel, fallback?: ResolvedModel): GatewayConfig {
  return {
    standard: primary,
    strong: primary,
    fallback,
    maxConcurrency: 4,
    timeoutMs: 5_000,
    backoffMs: 1,
  };
}

const goodJson = JSON.stringify({ answer: "ok", score: 8 });

describe("gateway", () => {
  test("returns parsed object with usage and cost on success", async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => textResponse(goodJson) });
    const logs: CallLogEntry[] = [];
    const gateway = createGateway(makeConfig(makeResolved(model)), async (e) => {
      logs.push(e);
    });

    const result = await gateway.call({
      task: "test",
      schema,
      system: "you are a test",
      prompt: "answer",
      promptVersion: "v1",
    });

    expect(result.object).toEqual({ answer: "ok", score: 8 });
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50 });
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.degraded).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("ok");
    expect(logs[0].inputHash).toHaveLength(64);
  });

  test("repairs invalid json by feeding the error back", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        calls += 1;
        if (calls === 1) return textResponse("not json at all");
        // the repair prompt must mention the failure
        const promptText = JSON.stringify(options.prompt);
        expect(promptText).toMatch(/failed validation/);
        return textResponse(goodJson);
      },
    });
    const gateway = createGateway(makeConfig(makeResolved(model)));

    const result = await gateway.call({ task: "t", schema, system: "s", prompt: "p" });
    expect(result.object.answer).toBe("ok");
    expect(calls).toBe(2);
  });

  test("retries retryable provider errors with backoff", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        if (calls === 1) {
          throw new APICallError({
            message: "rate limited",
            url: "http://test",
            requestBodyValues: {},
            statusCode: 429,
            responseHeaders: {},
            responseBody: "",
            isRetryable: true,
          });
        }
        return textResponse(goodJson);
      },
    });
    const gateway = createGateway(makeConfig(makeResolved(model)));

    const result = await gateway.call({ task: "t", schema, system: "s", prompt: "p" });
    expect(result.object.answer).toBe("ok");
    expect(calls).toBe(2);
  });

  test("degrades to fallback model when primary exhausts retries", async () => {
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: "bad request",
          url: "http://test",
          requestBodyValues: {},
          statusCode: 400,
          responseHeaders: {},
          responseBody: "",
          isRetryable: false,
        });
      },
    });
    const backup = new MockLanguageModelV4({ doGenerate: async () => textResponse(goodJson) });
    const logs: CallLogEntry[] = [];
    const gateway = createGateway(
      makeConfig(makeResolved(failing), makeResolved(backup, "backup-model")),
      async (e) => {
        logs.push(e);
      },
    );

    const result = await gateway.call({ task: "t", schema, system: "s", prompt: "p" });
    expect(result.degraded).toBe(true);
    expect(result.model).toBe("backup-model");
    expect(logs.at(-1)?.status).toBe("degraded");
  });

  test("throws GatewayError when primary fails and no fallback exists", async () => {
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: "bad request",
          url: "http://test",
          requestBodyValues: {},
          statusCode: 400,
          responseHeaders: {},
          responseBody: "",
          isRetryable: false,
        });
      },
    });
    const logs: CallLogEntry[] = [];
    const gateway = createGateway(makeConfig(makeResolved(failing)), async (e) => {
      logs.push(e);
    });

    await expect(gateway.call({ task: "t", schema, system: "s", prompt: "p" })).rejects.toThrow(
      /LLM call failed/,
    );
    expect(logs.at(-1)?.status).toBe("failed");
  });

  test("sanitizes secrets before they reach the provider", async () => {
    let seenPrompt = "";
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        seenPrompt = JSON.stringify(options.prompt);
        return textResponse(goodJson);
      },
    });
    const gateway = createGateway(makeConfig(makeResolved(model)));

    const result = await gateway.call({
      task: "t",
      schema,
      system: "s",
      prompt: "our key is sk-abc123def456ghi789jkl ok",
    });
    expect(seenPrompt).not.toContain("sk-abc123def456ghi789jkl");
    expect(result.sanitizeHits).toContain("api_key");
  });
});
