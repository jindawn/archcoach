import { describe, expect, test } from "vitest";
import type { Gateway, LlmCallRequest, LlmCallResult } from "../llm";
import type { SummaryOutput } from "../schemas/summary";
import {
  createArtifactsGenerator,
  generateDiagram,
  type ArtifactContext,
  type GeneratedArtifact,
} from "./generators";
import { extractMermaidSource, validateMermaid } from "./mermaid-validator";

const summary: SummaryOutput = {
  overallAssessment: "方案骨架成立，核心风险集中在缓存与数据库之间缺少对账机制，需修复后上线。",
  topRisks: [],
  conflicts: [],
  prioritizedActions: [
    { action: "增加对账", priority: "P0", rationale: "防资损", sourceRoles: ["database"] },
    { action: "补充压测", priority: "P1", rationale: "容量未验证", sourceRoles: ["sre"] },
    { action: "补充防刷", priority: "P1", rationale: "公平性", sourceRoles: ["security"] },
  ],
  missingInfo: [],
  keyDecisions: [
    {
      decision: "Redis 预扣库存",
      context: "高并发扣减",
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
  sessionId: "s1",
  dossier: "## 架构方案\n\nRedis 预扣库存，Kafka 异步落库。",
  summary,
  roleResults: [],
};

const goodMermaid = 'flowchart LR\n  user["用户"] --> gw["网关"]\n  gw --> redis[("Redis")]';

function scriptedGateway(responses: Record<string, unknown[]>): Gateway {
  const counters = new Map<string, number>();
  return {
    async call<T>(request: LlmCallRequest<T>): Promise<LlmCallResult<T>> {
      const queue = responses[request.task];
      if (!queue) throw new Error(`no scripted response for ${request.task}`);
      const index = counters.get(request.task) ?? 0;
      counters.set(request.task, index + 1);
      const object = queue[Math.min(index, queue.length - 1)];
      if (object instanceof Error) throw object;
      return {
        object: object as T,
        provider: "test",
        model: "mock",
        usage: { promptTokens: 10, completionTokens: 10 },
        costUsd: 0,
        latencyMs: 1,
        degraded: false,
        sanitizeHits: [],
      };
    },
  };
}

describe("mermaid validator", () => {
  test("accepts valid flowcharts", async () => {
    expect((await validateMermaid(goodMermaid)).valid).toBe(true);
  });

  test("rejects broken syntax with an error message", async () => {
    const result = await validateMermaid("flowchart LR\n a--><<bad[");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("extracts source from markdown fences", () => {
    expect(extractMermaidSource("```mermaid\nflowchart LR\n A-->B\n```")).toBe(
      "flowchart LR\n A-->B",
    );
  });
});

describe("generateDiagram", () => {
  test("feeds parse errors back and succeeds on repair", async () => {
    const gateway = scriptedGateway({
      "artifact:c4_diagram": [
        { title: "图", mermaid: "flowchart LR\n a--><<bad[" },
        { title: "图", mermaid: goodMermaid },
      ],
    });
    const artifact = await generateDiagram(gateway, context);
    expect(artifact.meta.renderRisk).toBe(false);
    expect(artifact.meta.attempts).toBe(2);
  });

  test("stores unparseable source with renderRisk flag after repairs exhaust", async () => {
    const gateway = scriptedGateway({
      "artifact:c4_diagram": [{ title: "图", mermaid: "flowchart LR\n a--><<bad[" }],
    });
    const artifact = await generateDiagram(gateway, context);
    expect(artifact.meta.renderRisk).toBe(true);
    expect(artifact.content).toContain("flowchart");
  });
});

describe("createArtifactsGenerator", () => {
  const docResponse = { title: "文档", markdown: "# 文档\n\n" + "内容 ".repeat(60) };

  test("generates all three artifacts and persists them", async () => {
    const inserted: GeneratedArtifact[] = [];
    const generator = createArtifactsGenerator(
      scriptedGateway({
        "artifact:c4_diagram": [{ title: "图", mermaid: goodMermaid }],
        "artifact:adr": [docResponse],
        "artifact:interview_script": [docResponse],
      }),
      {
        async insert(artifact) {
          inserted.push(artifact);
        },
        async existingTypes() {
          return [];
        },
      },
    );
    await generator(context);
    expect(inserted.map((a) => a.type).sort()).toEqual(["adr", "c4_diagram", "interview_script"]);
  });

  test("skips artifact types that already exist (resume)", async () => {
    const inserted: GeneratedArtifact[] = [];
    const generator = createArtifactsGenerator(
      scriptedGateway({
        "artifact:interview_script": [docResponse],
      }),
      {
        async insert(artifact) {
          inserted.push(artifact);
        },
        async existingTypes() {
          return ["c4_diagram", "adr"];
        },
      },
    );
    await generator(context);
    expect(inserted.map((a) => a.type)).toEqual(["interview_script"]);
  });

  test("one failed generator does not sink the rest", async () => {
    const inserted: GeneratedArtifact[] = [];
    const generator = createArtifactsGenerator(
      scriptedGateway({
        "artifact:c4_diagram": [new Error("boom")],
        "artifact:adr": [docResponse],
        "artifact:interview_script": [docResponse],
      }),
      {
        async insert(artifact) {
          inserted.push(artifact);
        },
        async existingTypes() {
          return [];
        },
      },
    );
    await generator(context);
    expect(inserted.map((a) => a.type).sort()).toEqual(["adr", "interview_script"]);
  });

  test("throws only when every generator fails", async () => {
    const generator = createArtifactsGenerator(
      scriptedGateway({
        "artifact:c4_diagram": [new Error("boom")],
        "artifact:adr": [new Error("boom")],
        "artifact:interview_script": [new Error("boom")],
      }),
      {
        async insert() {},
        async existingTypes() {
          return [];
        },
      },
    );
    await expect(generator(context)).rejects.toThrow(/所有产物生成均失败/);
  });
});
