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
    userId: string | null;
    title: string;
    kind: string;
    scenarioSlug?: string | null;
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
  trainingAttempt?: {
    id: string;
    independenceScore: number | null;
    capabilityScores: { scores: Array<{ capability: string; score: number; evidence: string; advice: string }> } | null;
    recommendedStepId: string | null;
    currentVersion: TrainingVersion | null;
    versions: TrainingVersion[];
  } | null;
}

export interface TrainingVersion {
  id: string; version: number; independenceScore: number; assessmentStatus: string; solutionMd: string;
  capabilityScores: { scores: Array<{ capability: string; score: number; evidence: string; advice: string }> } | null;
  recommendedStepId: string | null; submissionId: string | null; createdAt: string;
  answerSnapshot: Array<{stepId:string;answer:string;followUpAnswer:string|null;hintLevel:number;firstFeedback:unknown;finalFeedback:{takeaway?:string}|null}>;
  session: { id:string; status:string; overallScore:number|null; grade:string|null } | null;
}
