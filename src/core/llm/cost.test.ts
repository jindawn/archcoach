import { describe, expect, test } from "vitest";
import { estimateCostUsd } from "./cost";

describe("estimateCostUsd", () => {
  test("computes cost for a known model", () => {
    // deepseek-chat: $0.27 in / $1.10 out per MTok
    const cost = estimateCostUsd("deepseek-chat", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(1.37, 5);
  });

  test("matches model ids with vendor prefixes", () => {
    const cost = estimateCostUsd("openai/gpt-4o-mini", 100_000, 0);
    expect(cost).toBeCloseTo(0.015, 6);
  });

  test("returns null for unknown models", () => {
    expect(estimateCostUsd("qwen2.5-72b", 1000, 1000)).toBeNull();
  });

  test("returns null when token counts are missing", () => {
    expect(estimateCostUsd("deepseek-chat", null, 1000)).toBeNull();
  });

  test("local ollama models are free", () => {
    expect(estimateCostUsd("qwen2.5:latest", 1000, 1000)).toBe(0);
  });
});
