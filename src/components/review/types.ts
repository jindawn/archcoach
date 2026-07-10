import type { VerifiedRoleReview } from "@/core/schemas/review";
import type { SummaryOutput } from "@/core/schemas/summary";

/** GET /api/reviews/:id 的载荷形状（客户端视角） */
export interface ReviewPayload {
  session: {
    id: string;
    submissionId: string;
    status: string;
    overallScore: number | null;
    grade: string | null;
    summary: (SummaryOutput & { blocked: boolean; capApplied: string | null }) | null;
    error: string | null;
    shareSlug?: string | null;
    startedAt: string | null;
    completedAt: string | null;
  };
  submission: {
    id: string;
    title: string;
    kind: string;
  } | null;
  roleReviews: Array<{
    roleKey: string;
    status: string;
    score: number | null;
    riskLevel: string | null;
    isBlocking: boolean | null;
    result: (VerifiedRoleReview & { error?: string }) | null;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    meta: { renderRisk?: boolean; parseError?: string; basedOnIssues?: number };
  }>;
  questions: Array<{
    id: string;
    roleKey: string;
    question: string;
    whyMatters: string;
    answer: string | null;
  }>;
  usage: {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
  };
}
