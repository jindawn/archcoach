import pLimit from "p-limit";
import type { Gateway } from "../llm/gateway";
import type { Severity } from "../schemas/review";
import type { SummaryOutput } from "../schemas/summary";
import { computeOverallScore } from "../scoring";
import { reviewWithRole, type RoleReviewRunResult } from "./role-reviewer";
import type { RoleKey } from "./roles";
import { summarizeReviews } from "./summarizer";

/**
 * Persistence boundary. The web layer implements this on top of drizzle;
 * tests use an in-memory version. Core never touches the database directly.
 */
export interface StoredRoleReview {
  roleKey: string;
  status: string; // pending | running | completed | failed
  score: number | null;
  riskLevel: string | null;
  isBlocking: boolean | null;
  result: unknown;
}

export interface SessionPatch {
  status?: string;
  overallScore?: number;
  grade?: string;
  summary?: unknown;
  error?: string | null;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RoleReviewPatch {
  status?: string;
  score?: number;
  riskLevel?: string;
  isBlocking?: boolean;
  result?: unknown;
  promptVersion?: string;
  model?: string;
}

export interface ReviewStore {
  updateSession(sessionId: string, patch: SessionPatch): Promise<void>;
  initRoleReviews(sessionId: string, roleKeys: string[]): Promise<void>;
  listRoleReviews(sessionId: string): Promise<StoredRoleReview[]>;
  updateRoleReview(sessionId: string, roleKey: string, patch: RoleReviewPatch): Promise<void>;
}

export interface ArtifactsGenerator {
  (context: {
    sessionId: string;
    dossier: string;
    summary: SummaryOutput;
    roleResults: RoleReviewRunResult[];
  }): Promise<void>;
}

export interface RunReviewOptions {
  sessionId: string;
  dossier: string;
  enabledRoles: RoleKey[];
  gateway: Gateway;
  store: ReviewStore;
  /** plugged in by the artifact generators (#9); optional so the engine ships first */
  generateArtifacts?: ArtifactsGenerator;
  /** role review parallelism; provider-level limiting also applies in the gateway */
  concurrency?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Rebuilds an in-memory run result from a role review row persisted by an earlier run. */
function fromStored(row: StoredRoleReview): RoleReviewRunResult {
  const result = row.result as RoleReviewRunResult["review"];
  return {
    roleKey: row.roleKey as RoleKey,
    review: result,
    riskLevel: (row.riskLevel ?? "low") as Severity,
    promptVersion: "",
    model: "",
    degraded: false,
  };
}

/**
 * The deterministic review state machine:
 *   reviewing (roles in parallel, each checkpointed) → summarizing →
 *   generating_artifacts → completed.
 *
 * Idempotent by design: rerunning skips role reviews already completed, so a
 * crashed or partially failed session resumes instead of re-billing.
 */
export async function runReviewSession(options: RunReviewOptions): Promise<void> {
  const { sessionId, dossier, enabledRoles, gateway, store } = options;

  try {
    await store.updateSession(sessionId, { status: "reviewing", startedAt: new Date() });
    await store.initRoleReviews(sessionId, enabledRoles);

    const rows = await store.listRoleReviews(sessionId);
    const done = rows.filter((row) => row.status === "completed");
    const todo = rows.filter((row) => row.status !== "completed");

    const limit = pLimit(options.concurrency ?? 4);
    const settled = await Promise.all(
      todo.map((row) =>
        limit(async (): Promise<RoleReviewRunResult | null> => {
          const roleKey = row.roleKey as RoleKey;
          await store.updateRoleReview(sessionId, roleKey, { status: "running" });
          try {
            const result = await reviewWithRole(gateway, roleKey, dossier, { sessionId });
            await store.updateRoleReview(sessionId, roleKey, {
              status: "completed",
              score: result.review.score,
              riskLevel: result.riskLevel,
              isBlocking: result.review.isBlocking,
              result: result.review,
              promptVersion: result.promptVersion,
              model: result.model,
            });
            return result;
          } catch (error) {
            await store.updateRoleReview(sessionId, roleKey, {
              status: "failed",
              result: { error: errorMessage(error) },
            });
            return null;
          }
        }),
      ),
    );

    const roleResults: RoleReviewRunResult[] = [
      ...done.map(fromStored),
      ...settled.filter((result): result is RoleReviewRunResult => result !== null),
    ];

    if (roleResults.length === 0) {
      await store.updateSession(sessionId, {
        status: "failed",
        error: "所有评审角色都失败了，请检查模型配置后重试。",
      });
      return;
    }

    await store.updateSession(sessionId, { status: "summarizing" });
    const { summary } = await summarizeReviews(gateway, dossier, roleResults, { sessionId });

    const overall = computeOverallScore(
      roleResults.map((result) => ({
        roleKey: result.roleKey,
        score: result.review.score,
        isBlocking: result.review.isBlocking,
        riskLevel: result.riskLevel,
      })),
    );

    await store.updateSession(sessionId, {
      status: "generating_artifacts",
      overallScore: overall.score,
      grade: overall.grade,
      summary: { ...summary, blocked: overall.blocked, capApplied: overall.capApplied },
    });

    if (options.generateArtifacts) {
      await options.generateArtifacts({ sessionId, dossier, summary, roleResults });
    }

    await store.updateSession(sessionId, {
      status: "completed",
      completedAt: new Date(),
      error: null,
    });
  } catch (error) {
    await store.updateSession(sessionId, { status: "failed", error: errorMessage(error) });
    throw error;
  }
}
