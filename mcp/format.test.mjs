import { describe, expect, test } from "vitest";
import { formatProgress, formatQuestions, formatReport } from "./format.mjs";

const payload = {
  session: {
    status: "completed",
    grade: "C",
    overallScore: 65,
    summary: {
      overallAssessment: "方案骨架成立，核心风险在对账缺失。",
      blocked: true,
      capApplied: "blocking",
      prioritizedActions: [
        { priority: "P0", action: "增加对账任务", rationale: "防资损", sourceRoles: ["database"] },
      ],
      topRisks: [{ severity: "critical", risk: "库存悬挂", mitigation: "对账", sourceRole: "database" }],
      conflicts: [
        {
          topic: "是否引入 Kafka",
          positionA: { roleKey: "tech_architect", position: "必要的削峰手段" },
          positionB: { roleKey: "chief_architect", position: "5 人团队运维成本过高" },
          guidance: "取决于团队既有运维能力",
        },
      ],
    },
  },
  submission: { title: "秒杀系统" },
  roleReviews: [
    {
      roleKey: "database",
      status: "completed",
      score: 4,
      isBlocking: true,
      result: { score: 4, isBlocking: true, scoreRationale: "缺对账", blockingReason: "库存悬挂造成资损" },
    },
    { roleKey: "sre", status: "failed", result: null },
  ],
  artifacts: [{ type: "adr", title: "架构决策记录" }],
  usage: { calls: 10, promptTokens: 30000, completionTokens: 8000, costUsd: 0 },
};

describe("formatReport", () => {
  test("renders grade, blockers, actions, conflicts, artifacts", () => {
    const report = formatReport(payload);
    expect(report).toContain("综合评级：C（65 分）");
    expect(report).toContain("存在上线阻塞项");
    expect(report).toContain("库存悬挂造成资损");
    expect(report).toContain("**P0** 增加对账任务");
    expect(report).toContain("是否引入 Kafka");
    expect(report).toContain("`adr`");
    expect(report).toContain("数据库专家");
    expect(report).toContain("SRE：未完成");
  });
});

describe("formatProgress", () => {
  test("shows completed roles and polling hint", () => {
    const progress = formatProgress({
      session: { status: "reviewing" },
      roleReviews: [
        { roleKey: "sre", status: "completed", score: 5.0, isBlocking: true },
        { roleKey: "database", status: "running" },
      ],
    });
    expect(progress).toContain("1/2 位评委完成");
    expect(progress).toContain("SRE：5.0 分（判定阻塞上线）");
    expect(progress).toContain("get_review_report");
  });
});

describe("formatQuestions", () => {
  test("lists question ids and nudges the agent to answer from context", () => {
    const output = formatQuestions("sub-1", [
      { id: "q1", roleKey: "sre", question: "容量如何推算？" },
    ]);
    expect(output).toContain("`sub-1`");
    expect(output).toContain("`q1`");
    expect(output).toContain("[SRE] 容量如何推算？");
    expect(output).toContain("start_review");
  });
});
