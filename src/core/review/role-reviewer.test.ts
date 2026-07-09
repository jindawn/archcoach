import { describe, expect, test } from "vitest";
import type { Gateway, LlmCallRequest, LlmCallResult } from "../llm";
import type { RoleReviewOutput, VerifiedRoleReview } from "../schemas/review";
import { deriveRiskLevel, reviewWithRole } from "./role-reviewer";

const dossier = "## 架构方案\n\nRedis lua 原子预扣库存，扣减成功写 Kafka 异步落库 MySQL。";

const sampleOutput: RoleReviewOutput = {
  concerns: ["一致性", "容量"],
  score: 5,
  scoreRationale: "骨架成立但缺对账",
  issues: [
    {
      title: "缺少对账",
      detail: "消息丢失后库存悬挂",
      evidence: "扣减成功写 Kafka 异步落库 MySQL",
      severity: "high",
      category: "consistency",
    },
    {
      title: "编造问题",
      detail: "引用不存在",
      evidence: "方案使用了 etcd 分布式锁",
      severity: "critical",
      category: "other",
    },
  ],
  risks: [],
  suggestions: [],
  followUpQuestions: [],
  isBlocking: false,
};

function mockGateway(output: RoleReviewOutput): { gateway: Gateway; seen: LlmCallRequest<unknown>[] } {
  const seen: LlmCallRequest<unknown>[] = [];
  const gateway: Gateway = {
    async call<T>(request: LlmCallRequest<T>): Promise<LlmCallResult<T>> {
      seen.push(request as LlmCallRequest<unknown>);
      return {
        object: output as unknown as T,
        provider: "test",
        model: "mock-model",
        usage: { promptTokens: 10, completionTokens: 10 },
        costUsd: 0,
        latencyMs: 1,
        degraded: false,
        sanitizeHits: [],
      };
    },
  };
  return { gateway, seen };
}

describe("reviewWithRole", () => {
  test("composes base + role prompt and verifies evidence", async () => {
    const { gateway, seen } = mockGateway(sampleOutput);
    const result = await reviewWithRole(gateway, "database", dossier);

    expect(seen[0].task).toBe("role_review:database");
    expect(seen[0].system).toContain("评分锚点");
    expect(seen[0].system).toContain("数据库专家");
    expect(seen[0].prompt).toBe(dossier);
    expect(seen[0].promptVersion).toMatch(/^v1\+database@v1$/);

    expect(result.review.issues[0].verified).toBe(true);
    expect(result.review.issues[1].verified).toBe(false);
  });

  test("derives risk level from the most severe issue", async () => {
    const { gateway } = mockGateway(sampleOutput);
    const result = await reviewWithRole(gateway, "sre", dossier);
    expect(result.riskLevel).toBe("critical");
  });
});

describe("deriveRiskLevel", () => {
  test("returns low for a review with no issues", () => {
    const review: VerifiedRoleReview = { ...sampleOutput, issues: [] };
    expect(deriveRiskLevel(review)).toBe("low");
  });
});
