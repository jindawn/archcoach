import { describe, expect, test } from "vitest";
import { loadGatewayConfig } from "./config";

const baseEnv = {
  LLM_PROVIDER: "deepseek",
  LLM_API_KEY: "test-key",
  LLM_MODEL: "deepseek-chat",
} as NodeJS.ProcessEnv;

describe("loadGatewayConfig", () => {
  test("builds standard and strong models from env", () => {
    const config = loadGatewayConfig({ ...baseEnv, LLM_STRONG_MODEL: "deepseek-reasoner" });
    expect(config.standard.modelId).toBe("deepseek-chat");
    expect(config.strong.modelId).toBe("deepseek-reasoner");
    expect(config.maxConcurrency).toBe(4);
  });

  test("strong falls back to the standard model when unset", () => {
    const config = loadGatewayConfig(baseEnv);
    expect(config.strong.modelId).toBe("deepseek-chat");
  });

  test("requires an api key for cloud providers", () => {
    expect(() => loadGatewayConfig({ ...baseEnv, LLM_API_KEY: "" })).toThrow(/LLM_API_KEY/);
  });

  test("ollama needs no api key", () => {
    const config = loadGatewayConfig({
      LLM_PROVIDER: "ollama",
      LLM_MODEL: "qwen3:8b",
    } as NodeJS.ProcessEnv);
    expect(config.standard.provider).toBe("ollama");
  });

  test("parses provider:model fallback format", () => {
    const config = loadGatewayConfig({
      ...baseEnv,
      LLM_FALLBACK_MODEL: "openrouter:qwen/qwen-2.5-72b-instruct",
      LLM_FALLBACK_API_KEY: "or-key",
    });
    expect(config.fallback?.provider).toBe("openrouter");
    expect(config.fallback?.modelId).toBe("qwen/qwen-2.5-72b-instruct");
  });

  test("rejects malformed fallback values", () => {
    expect(() => loadGatewayConfig({ ...baseEnv, LLM_FALLBACK_MODEL: "no-colon" })).toThrow(
      /provider:model/,
    );
  });

  test("rejects unknown providers with a readable message", () => {
    expect(() =>
      loadGatewayConfig({ ...baseEnv, LLM_PROVIDER: "aws-bedrock" } as NodeJS.ProcessEnv),
    ).toThrow(/Invalid LLM configuration/);
  });
});
