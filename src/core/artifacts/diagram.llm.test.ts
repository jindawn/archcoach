/**
 * Real-model diagram generation smoke test.
 * RUN_LLM_TESTS=1 LLM_PROVIDER=ollama LLM_MODEL=llama3:latest pnpm vitest run diagram.llm
 */
import { describe, expect, test } from "vitest";
import { createGateway, loadGatewayConfig } from "../llm";
import type { SummaryOutput } from "../schemas/summary";
import { generateDiagram, type ArtifactContext } from "./generators";

const enabled = process.env.RUN_LLM_TESTS === "1";

const summary: SummaryOutput = {
  overallAssessment: "秒杀方案骨架成立，核心问题是缓存与数据库间缺少对账，以及缺少防刷手段。",
  topRisks: [],
  conflicts: [],
  prioritizedActions: [
    { action: "增加库存对账任务", priority: "P0", rationale: "防资损", sourceRoles: ["database"] },
    { action: "增加人机识别防刷", priority: "P1", rationale: "公平性", sourceRoles: ["security"] },
    { action: "补充全链路压测", priority: "P1", rationale: "容量未验证", sourceRoles: ["sre"] },
  ],
  missingInfo: [],
  keyDecisions: [
    {
      decision: "Redis 预扣库存",
      context: "5 万 QPS 下 MySQL 无法直接承接扣减",
      options: ["Redis 预扣", "MySQL 行锁"],
      rationale: "以最终一致换吞吐",
    },
    {
      decision: "Kafka 异步落库",
      context: "削峰",
      options: ["同步写库", "Kafka 异步"],
      rationale: "解耦峰值写入",
    },
  ],
};

const context: ArtifactContext = {
  sessionId: "llm-test",
  dossier:
    "# 秒杀系统\n\n前端静态化加 CDN 预热；网关令牌桶限流；Redis lua 原子预扣库存；扣减成功写 Kafka，由订单服务异步落库 MySQL；支付超时 10 分钟回补库存。峰值 QPS 5 万。",
  summary,
  roleResults: [],
};

describe.skipIf(!enabled)("diagram generation with a real model", () => {
  test("produces parseable mermaid within the repair budget", async () => {
    const gateway = createGateway(loadGatewayConfig());
    const artifact = await generateDiagram(gateway, context);
    if (artifact.meta.renderRisk) {
      console.warn("parseError:", artifact.meta.parseError, "\nsource:\n", artifact.content);
    }
    expect(artifact.content).toContain("flowchart");
    expect(artifact.meta.renderRisk).toBe(false);
  }, 600_000);
});
