/**
 * Real-model smoke test. Skipped unless RUN_LLM_TESTS=1 and an LLM provider
 * is configured via environment variables. Run:
 *
 *   RUN_LLM_TESTS=1 LLM_PROVIDER=ollama LLM_MODEL=llama3:latest pnpm vitest run role-reviewer.llm
 */
import { describe, expect, test } from "vitest";
import { createGateway, loadGatewayConfig } from "../llm";
import { reviewWithRole } from "./role-reviewer";

const enabled = process.env.RUN_LLM_TESTS === "1";

const dossier = `# 架构方案卷宗：秒杀系统

## 业务背景

电商平台双十一秒杀，峰值 QPS 5 万，SKU 200 个，要求不超卖。

## 架构方案

前端静态化加 CDN 预热；网关令牌桶限流；Redis lua 原子预扣库存；
扣减成功写 Kafka，由订单服务异步消费落库 MySQL；支付超时 10 分钟回补库存。

## 约束条件

- qps: 50000
- sla: 99.95%
- teamSize: 5`;

describe.skipIf(!enabled)("role reviewer with a real model", () => {
  test("database expert produces a structured, evidence-backed review", async () => {
    const gateway = createGateway(loadGatewayConfig());
    const result = await reviewWithRole(gateway, "database", dossier);

    expect(result.review.score).toBeGreaterThanOrEqual(0);
    expect(result.review.score).toBeLessThanOrEqual(10);
    expect(result.review.concerns.length).toBeGreaterThanOrEqual(2);
    expect(result.review.issues.length).toBeGreaterThan(0);
    // at least half of the issues must quote real dossier text
    const verified = result.review.issues.filter((issue) => issue.verified);
    expect(verified.length / result.review.issues.length).toBeGreaterThanOrEqual(0.5);
  }, 300_000);
});
