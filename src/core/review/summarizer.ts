import type { Gateway } from "../llm/gateway";
import { loadPromptTemplate } from "../prompts/loader";
import { summaryOutputSchema, type SummaryOutput } from "../schemas/summary";
import type { RoleReviewRunResult } from "./role-reviewer";

const DOSSIER_EXCERPT_CHARS = 2_000;

/** Compact, model-friendly digest of all completed role reviews. */
export function buildSummarizerInput(
  dossier: string,
  roleResults: readonly RoleReviewRunResult[],
): string {
  const reviews = roleResults.map((result) => ({
    roleKey: result.roleKey,
    score: result.review.score,
    scoreRationale: result.review.scoreRationale,
    riskLevel: result.riskLevel,
    isBlocking: result.review.isBlocking,
    blockingReason: result.review.blockingReason ?? null,
    issues: result.review.issues.map((issue) => ({
      title: issue.title,
      detail: issue.detail,
      severity: issue.severity,
      verified: issue.verified,
    })),
    risks: result.review.risks,
    suggestions: result.review.suggestions,
  }));

  return [
    `## 方案摘要（卷宗开头节选）`,
    dossier.slice(0, DOSSIER_EXCERPT_CHARS),
    `## 十位评委的评审结果（JSON）`,
    JSON.stringify(reviews, null, 1),
  ].join("\n\n");
}

export interface SummarizeResult {
  summary: SummaryOutput;
  promptVersion: string;
}

export async function summarizeReviews(
  gateway: Gateway,
  dossier: string,
  roleResults: readonly RoleReviewRunResult[],
  options: { sessionId?: string } = {},
): Promise<SummarizeResult> {
  const template = loadPromptTemplate("summarize");
  const result = await gateway.call({
    task: "summarize",
    schema: summaryOutputSchema,
    system: template.content,
    prompt: buildSummarizerInput(dossier, roleResults),
    tier: "strong",
    promptVersion: template.version,
    sessionId: options.sessionId,
  });
  return { summary: result.object, promptVersion: template.version };
}
