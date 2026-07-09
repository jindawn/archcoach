import { describe, expect, test } from "vitest";
import type { Gateway, LlmCallRequest, LlmCallResult } from "../llm";
import type { ClarifyOutput } from "../schemas/clarify";
import { generateClarifyingQuestions } from "./clarify";

const output: ClarifyOutput = {
  questions: [
    { roleKey: "sre", question: "峰值容量如何推算得出？", whyMatters: "决定限流参数是否可信" },
    { roleKey: "database", question: "对账周期是多少？", whyMatters: "影响一致性窗口判断" },
    { roleKey: "security", question: "如何识别脚本流量？", whyMatters: "限流防不了作弊" },
    { roleKey: "chief_architect", question: "为什么选 Kafka？", whyMatters: "选型依据缺失" },
  ],
};

describe("generateClarifyingQuestions", () => {
  test("renders the clarify template and returns questions with version", async () => {
    let seen: LlmCallRequest<unknown> | null = null;
    const gateway: Gateway = {
      async call<T>(request: LlmCallRequest<T>): Promise<LlmCallResult<T>> {
        seen = request as LlmCallRequest<unknown>;
        return {
          object: output as unknown as T,
          provider: "test",
          model: "mock",
          usage: { promptTokens: 1, completionTokens: 1 },
          costUsd: 0,
          latencyMs: 1,
          degraded: false,
          sanitizeHits: ["email"],
        };
      },
    };

    const result = await generateClarifyingQuestions(gateway, "## 卷宗内容", {
      sessionId: "s1",
    });

    expect(seen!.task).toBe("clarify");
    expect(seen!.system).toContain("秘书长");
    expect(seen!.prompt).toBe("## 卷宗内容");
    expect(result.questions).toHaveLength(4);
    expect(result.promptVersion).toBe("v1");
    expect(result.sanitizeHits).toEqual(["email"]);
  });
});
