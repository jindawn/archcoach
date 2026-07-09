import { describe, expect, test } from "vitest";
import type { Gateway, LlmCallRequest, LlmCallResult } from "../llm";
import type { RoleReviewOutput } from "../schemas/review";
import type { SummaryOutput } from "../schemas/summary";
import {
  runReviewSession,
  type ReviewStore,
  type SessionPatch,
  type StoredRoleReview,
} from "./orchestrator";
import { ROLE_KEYS } from "./roles";

const dossier = "## 架构方案\n\nRedis lua 原子预扣库存，扣减成功写 Kafka 异步落库 MySQL。";

function makeReviewOutput(score: number, isBlocking = false): RoleReviewOutput {
  return {
    concerns: ["一致性", "容量"],
    score,
    scoreRationale: "骨架成立但缺少对账机制",
    issues: [
      {
        title: "缺少对账",
        detail: "消息丢失后库存悬挂无法回收",
        evidence: "扣减成功写 Kafka 异步落库 MySQL",
        severity: isBlocking ? "critical" : "medium",
        category: "consistency",
      },
    ],
    risks: [],
    suggestions: [],
    followUpQuestions: [],
    isBlocking,
    blockingReason: isBlocking ? "库存悬挂造成资损" : undefined,
  };
}

const summaryOutput: SummaryOutput = {
  overallAssessment: "方案骨架成立，核心风险集中在缓存与数据库之间缺少对账与回补机制，需要修复后上线。",
  topRisks: [
    { risk: "库存悬挂", sourceRole: "database", severity: "critical", mitigation: "对账任务" },
  ],
  conflicts: [],
  prioritizedActions: [
    { action: "增加对账任务", priority: "P0", rationale: "防资损", sourceRoles: ["database"] },
    { action: "补充压测计划", priority: "P1", rationale: "容量未验证", sourceRoles: ["sre"] },
    { action: "补充防刷手段", priority: "P1", rationale: "公平性", sourceRoles: ["security"] },
  ],
  missingInfo: [],
  keyDecisions: [
    {
      decision: "Redis 预扣库存",
      context: "5 万 QPS 下 MySQL 无法承接直接扣减",
      options: ["Redis 预扣", "MySQL 行锁扣减"],
      rationale: "以最终一致换吞吐",
    },
    {
      decision: "Kafka 异步落库",
      context: "削峰",
      options: ["同步写库", "Kafka 异步"],
      rationale: "峰值写入解耦",
    },
  ],
};

/** in-memory ReviewStore capturing every state transition */
function makeStore(initialRoles: StoredRoleReview[] = []) {
  const roleRows = new Map<string, StoredRoleReview>(
    initialRoles.map((row) => [row.roleKey, row]),
  );
  const sessionPatches: SessionPatch[] = [];
  const store: ReviewStore = {
    async updateSession(_id, patch) {
      sessionPatches.push(patch);
    },
    async initRoleReviews(_id, roleKeys) {
      for (const key of roleKeys) {
        if (!roleRows.has(key)) {
          roleRows.set(key, {
            roleKey: key,
            status: "pending",
            score: null,
            riskLevel: null,
            isBlocking: null,
            result: null,
          });
        }
      }
    },
    async listRoleReviews() {
      return [...roleRows.values()];
    },
    async updateRoleReview(_id, roleKey, patch) {
      const row = roleRows.get(roleKey);
      if (row) Object.assign(row, patch);
    },
  };
  return { store, roleRows, sessionPatches };
}

function makeGateway(behavior: {
  roleOutput?: (task: string) => RoleReviewOutput | Error;
  callCounter?: { roleCalls: number; summarizeCalls: number };
}): Gateway {
  return {
    async call<T>(request: LlmCallRequest<T>): Promise<LlmCallResult<T>> {
      const base = {
        provider: "test",
        model: "mock",
        usage: { promptTokens: 10, completionTokens: 10 },
        costUsd: 0,
        latencyMs: 1,
        degraded: false,
        sanitizeHits: [] as string[],
      };
      if (request.task.startsWith("role_review:")) {
        if (behavior.callCounter) behavior.callCounter.roleCalls += 1;
        const output = behavior.roleOutput?.(request.task) ?? makeReviewOutput(7);
        if (output instanceof Error) throw output;
        return { ...base, object: output as unknown as T };
      }
      if (request.task === "summarize") {
        if (behavior.callCounter) behavior.callCounter.summarizeCalls += 1;
        return { ...base, object: summaryOutput as unknown as T };
      }
      throw new Error(`unexpected task ${request.task}`);
    },
  };
}

describe("runReviewSession", () => {
  test("runs all roles, summarizes, scores, and completes", async () => {
    const { store, roleRows, sessionPatches } = makeStore();
    await runReviewSession({
      sessionId: "s1",
      dossier,
      enabledRoles: [...ROLE_KEYS],
      gateway: makeGateway({}),
      store,
    });

    expect([...roleRows.values()].every((row) => row.status === "completed")).toBe(true);
    const statuses = sessionPatches.map((patch) => patch.status).filter(Boolean);
    expect(statuses).toEqual(["reviewing", "summarizing", "generating_artifacts", "completed"]);
    const scored = sessionPatches.find((patch) => patch.overallScore !== undefined);
    expect(scored?.overallScore).toBe(70);
    expect(scored?.grade).toBe("B");
  });

  test("a single failed role does not block the rest", async () => {
    const { store, roleRows, sessionPatches } = makeStore();
    await runReviewSession({
      sessionId: "s1",
      dossier,
      enabledRoles: [...ROLE_KEYS],
      gateway: makeGateway({
        roleOutput: (task) =>
          task === "role_review:security" ? new Error("provider down") : makeReviewOutput(7),
      }),
      store,
    });

    expect(roleRows.get("security")?.status).toBe("failed");
    expect(roleRows.get("sre")?.status).toBe("completed");
    expect(sessionPatches.at(-1)?.status).toBe("completed");
  });

  test("resume skips completed roles and does not re-bill them", async () => {
    const counter = { roleCalls: 0, summarizeCalls: 0 };
    const completedSre: StoredRoleReview = {
      roleKey: "sre",
      status: "completed",
      score: 8,
      riskLevel: "medium",
      isBlocking: false,
      result: makeReviewOutput(8),
    };
    const { store, roleRows } = makeStore([completedSre]);
    await runReviewSession({
      sessionId: "s1",
      dossier,
      enabledRoles: [...ROLE_KEYS],
      gateway: makeGateway({ callCounter: counter }),
      store,
    });

    expect(counter.roleCalls).toBe(ROLE_KEYS.length - 1);
    expect(counter.summarizeCalls).toBe(1);
    expect([...roleRows.values()].every((row) => row.status === "completed")).toBe(true);
  });

  test("blocking role caps the overall grade", async () => {
    const { store, sessionPatches } = makeStore();
    await runReviewSession({
      sessionId: "s1",
      dossier,
      enabledRoles: [...ROLE_KEYS],
      gateway: makeGateway({
        roleOutput: (task) =>
          task === "role_review:database" ? makeReviewOutput(5, true) : makeReviewOutput(9),
      }),
      store,
    });

    const scored = sessionPatches.find((patch) => patch.overallScore !== undefined);
    expect(scored?.overallScore).toBe(65);
    expect(scored?.grade).toBe("C");
    expect((scored?.summary as { blocked: boolean }).blocked).toBe(true);
  });

  test("all roles failing marks the session failed", async () => {
    const { store, sessionPatches } = makeStore();
    await runReviewSession({
      sessionId: "s1",
      dossier,
      enabledRoles: [...ROLE_KEYS],
      gateway: makeGateway({ roleOutput: () => new Error("all down") }),
      store,
    });

    expect(sessionPatches.at(-1)?.status).toBe("failed");
    expect(sessionPatches.at(-1)?.error).toContain("所有评审角色都失败");
  });

  test("artifacts generator is invoked with summary and role results", async () => {
    const { store } = makeStore();
    let received: { sessionId: string } | null = null;
    await runReviewSession({
      sessionId: "s1",
      dossier,
      enabledRoles: [...ROLE_KEYS],
      gateway: makeGateway({}),
      store,
      generateArtifacts: async (context) => {
        received = { sessionId: context.sessionId };
      },
    });
    expect(received).toEqual({ sessionId: "s1" });
  });
});
