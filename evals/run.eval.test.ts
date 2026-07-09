/**
 * Mini eval suite — real LLM calls against the golden cases in evals/cases.
 * Run with `pnpm eval` (requires an LLM provider configured via env).
 *
 * Quality gates:
 *   1. structured output validity: every call must parse (implicit — throws otherwise)
 *   2. evidence rate: >= 60% of issues quote locatable dossier text
 *   3. arbitration: every `bad` case gets at least one blocking verdict
 *   4. ordering: good cases outscore bad cases
 *   5. mermaid: generated diagram parses (one representative case)
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, test } from "vitest";
import { generateDiagram } from "@/core/artifacts/generators";
import { createGateway, loadGatewayConfig, type Gateway } from "@/core/llm";
import { generateClarifyingQuestions } from "@/core/review/clarify";
import { compileDossier } from "@/core/review/dossier";
import { reviewWithRole, type RoleReviewRunResult } from "@/core/review/role-reviewer";
import type { RoleKey } from "@/core/review/roles";
import { summarizeReviews } from "@/core/review/summarizer";
import { computeOverallScore } from "@/core/scoring";

const enabled = process.env.RUN_EVALS === "1";

/** subset of roles to keep local eval runtime manageable */
const EVAL_ROLES: RoleKey[] = ["chief_architect", "database", "sre"];

interface EvalCase {
  id: string;
  kind: "good" | "medium" | "bad" | "edge";
  expectBlocking: boolean | null;
  dossier: string;
}

function loadCases(): EvalCase[] {
  const dir = path.join(process.cwd(), "evals", "cases");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      return {
        id: data.id as string,
        kind: data.kind as EvalCase["kind"],
        expectBlocking: data.expectBlocking as boolean | null,
        dossier: compileDossier({
          title: data.title as string,
          kind: "real",
          businessContext: data.businessContext as string,
          solutionMd: content.trim(),
          techStack: (data.techStack as string) || null,
          constraints: (data.constraints as Record<string, unknown>) ?? {},
        }),
      };
    });
}

interface CaseResult {
  id: string;
  kind: EvalCase["kind"];
  overallScore: number;
  blocked: boolean;
  issueCount: number;
  verifiedCount: number;
}

async function runCase(gateway: Gateway, evalCase: EvalCase): Promise<CaseResult> {
  const results: RoleReviewRunResult[] = [];
  for (const roleKey of EVAL_ROLES) {
    results.push(await reviewWithRole(gateway, roleKey, evalCase.dossier));
  }
  const overall = computeOverallScore(
    results.map((result) => ({
      roleKey: result.roleKey,
      score: result.review.score,
      isBlocking: result.review.isBlocking,
      riskLevel: result.riskLevel,
    })),
  );
  const issues = results.flatMap((result) => result.review.issues);
  return {
    id: evalCase.id,
    kind: evalCase.kind,
    overallScore: overall.score,
    blocked: overall.blocked,
    issueCount: issues.length,
    verifiedCount: issues.filter((issue) => issue.verified).length,
  };
}

describe.skipIf(!enabled)("ArchCoach eval suite", () => {
  const cases = loadCases();
  const gateway = enabled ? createGateway(loadGatewayConfig()) : (null as unknown as Gateway);
  const results: CaseResult[] = [];

  test("clarify handles the minimal edge case", async () => {
    const edge = cases.find((c) => c.kind === "edge");
    expect(edge).toBeDefined();
    const clarify = await generateClarifyingQuestions(gateway, edge!.dossier);
    expect(clarify.questions.length).toBeGreaterThanOrEqual(4);
  }, 300_000);

  test.each(cases.filter((c) => c.kind !== "edge").map((c) => [c.id, c] as const))(
    "case %s completes with structured, evidence-backed reviews",
    async (_id, evalCase) => {
      const result = await runCase(gateway, evalCase);
      results.push(result);
      expect(result.issueCount).toBeGreaterThan(0);
      if (evalCase.expectBlocking === true) {
        expect(result.blocked).toBe(true);
      }
    },
    900_000,
  );

  test("aggregate quality gates", async () => {
    const totalIssues = results.reduce((sum, result) => sum + result.issueCount, 0);
    const totalVerified = results.reduce((sum, result) => sum + result.verifiedCount, 0);
    const evidenceRate = totalVerified / totalIssues;

    const goodScores = results.filter((r) => r.kind === "good").map((r) => r.overallScore);
    const badScores = results.filter((r) => r.kind === "bad").map((r) => r.overallScore);
    const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

    console.table(
      results.map((result) => ({
        case: result.id,
        kind: result.kind,
        score: result.overallScore,
        blocked: result.blocked,
        evidence: `${result.verifiedCount}/${result.issueCount}`,
      })),
    );
    console.log(`evidence rate: ${(evidenceRate * 100).toFixed(1)}%`);

    expect(evidenceRate).toBeGreaterThanOrEqual(0.6);
    expect(avg(goodScores)).toBeGreaterThan(avg(badScores));
  });

  test("generated diagram parses", async () => {
    const good = cases.find((c) => c.id === "seckill-good")!;
    const artifact = await generateDiagram(gateway, {
      sessionId: "eval",
      dossier: good.dossier,
      summary: {
        overallAssessment: "方案完善，流量分层、对账与降级链路齐备，按建议补充细节后可上线。",
        topRisks: [],
        conflicts: [],
        prioritizedActions: [
          { action: "补充压测报告", priority: "P1", rationale: "容量待验证", sourceRoles: ["sre"] },
          { action: "细化风控规则", priority: "P2", rationale: "对抗升级", sourceRoles: ["security"] },
          { action: "完善值班手册", priority: "P2", rationale: "响应保障", sourceRoles: ["sre"] },
        ],
        missingInfo: [],
        keyDecisions: [
          {
            decision: "Redis 预扣 + 对账兜底",
            context: "5 万 QPS 峰值",
            options: ["Redis 预扣", "MySQL 行锁"],
            rationale: "吞吐优先，最终一致由对账兜底",
          },
          {
            decision: "Kafka 异步落库",
            context: "削峰",
            options: ["同步写库", "Kafka 异步"],
            rationale: "峰值解耦",
          },
        ],
      },
      roleResults: [],
    });
    expect(artifact.meta.renderRisk).toBe(false);
  }, 600_000);
});
