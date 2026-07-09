import { describe, expect, test } from "vitest";
import { compileDossier, type DossierInput } from "./dossier";

const base: DossierInput = {
  title: "秒杀系统",
  kind: "real",
  businessContext: "电商大促秒杀，峰值 QPS 5 万。",
  solutionMd: "## 方案\n\n网关限流 + Redis 预扣库存 + MQ 异步落单。",
  techStack: "Go + Redis + Kafka + MySQL",
  constraints: { qps: 50000, sla: "99.95%", teamSize: 5 },
  diagramSource: "flowchart LR\n A-->B",
  diagramType: "mermaid",
  qa: [
    { question: "库存扣减如何防止超卖？", answer: "Redis lua 原子扣减。" },
    { question: "MQ 挂了怎么办？", answer: null },
  ],
};

describe("compileDossier", () => {
  test("produces a stable document structure", () => {
    const dossier = compileDossier(base);
    expect(dossier).toMatchSnapshot();
  });

  test("includes answered and skipped questions distinctly", () => {
    const dossier = compileDossier(base);
    expect(dossier).toContain("Redis lua 原子扣减");
    expect(dossier).toContain("（提交者未回答）");
  });

  test("omits optional sections when absent", () => {
    const dossier = compileDossier({
      ...base,
      techStack: null,
      diagramSource: null,
      qa: [],
    });
    expect(dossier).not.toContain("## 技术栈");
    expect(dossier).not.toContain("## 架构图");
    expect(dossier).not.toContain("## 追问与回答");
  });

  test("renders empty constraints as placeholder", () => {
    const dossier = compileDossier({ ...base, constraints: {} });
    expect(dossier).toContain("（未提供）");
  });

  test("truncates oversized solutions with a marker", () => {
    const dossier = compileDossier({ ...base, solutionMd: "长".repeat(70_000) });
    expect(dossier.length).toBeLessThan(61_000);
    expect(dossier).toContain("已截断");
  });

  test("training submissions include scenario background", () => {
    const dossier = compileDossier({
      ...base,
      kind: "training",
      scenario: {
        title: "秒杀系统设计",
        backgroundMd: "某电商平台需要支撑双十一秒杀。",
        constraints: { qps: 100000 },
      },
    });
    expect(dossier).toContain("训练题背景");
    expect(dossier).toContain("双十一秒杀");
  });
});
