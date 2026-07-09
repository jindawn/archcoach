import { describe, expect, test } from "vitest";
import { isEvidenceVerified, verifyRoleReview } from "./evidence";
import type { RoleReviewOutput } from "../schemas/review";

const dossier = `## 架构方案

前端静态化加 CDN 预热；网关令牌桶限流；Redis lua 原子预扣库存；
扣减成功写 Kafka，由订单服务异步落库 MySQL；支付超时 10 分钟回补库存。`;

describe("isEvidenceVerified", () => {
  test("verifies verbatim quotes", () => {
    expect(isEvidenceVerified(dossier, "Redis lua 原子预扣库存")).toBe(true);
  });

  test("verifies quotes despite whitespace and punctuation drift", () => {
    expect(isEvidenceVerified(dossier, "redis lua原子预扣库存。")).toBe(true);
  });

  test("verifies stitched quotes when most segments match", () => {
    expect(
      isEvidenceVerified(dossier, "网关令牌桶限流，Redis lua 原子预扣库存，扣减成功写 Kafka"),
    ).toBe(true);
  });

  test("rejects fabricated quotes", () => {
    expect(isEvidenceVerified(dossier, "使用 ZooKeeper 做分布式锁保证一致性")).toBe(false);
  });

  test("rejects too-short quotes", () => {
    expect(isEvidenceVerified(dossier, "限流")).toBe(false);
  });
});

describe("verifyRoleReview", () => {
  test("annotates each issue with a verified flag", () => {
    const output: RoleReviewOutput = {
      concerns: ["一致性", "容灾"],
      score: 5,
      scoreRationale: "骨架成立但有重大缺口",
      issues: [
        {
          title: "真实问题",
          detail: "库存对账缺失，悬挂扣减无法回收",
          evidence: "扣减成功写 Kafka，由订单服务异步落库 MySQL",
          severity: "high",
          category: "consistency",
        },
        {
          title: "幻觉问题",
          detail: "编造的引用",
          evidence: "方案中使用了 etcd 存储库存",
          severity: "low",
          category: "other",
        },
      ],
      risks: [],
      suggestions: [],
      followUpQuestions: [],
      isBlocking: false,
    };
    const verified = verifyRoleReview(dossier, output);
    expect(verified.issues[0].verified).toBe(true);
    expect(verified.issues[1].verified).toBe(false);
  });
});
