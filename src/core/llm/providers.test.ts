import { describe, expect, test } from "vitest";
import { resolveModel } from "./providers";

describe("resolveModel", () => {
  test.each(["openai", "anthropic", "deepseek", "openrouter", "ollama"])(
    "resolves %s models",
    (provider) => {
      const resolved = resolveModel(provider, "some-model", { apiKey: "k" });
      expect(resolved.provider).toBe(provider);
      expect(resolved.modelId).toBe("some-model");
      expect(resolved.model).toBeTruthy();
    },
  );

  test("throws a readable error for unknown providers", () => {
    expect(() => resolveModel("bedrock", "m")).toThrow(/Unknown LLM provider/);
  });
});
