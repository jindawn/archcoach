import { createArtifactsGenerator } from "@/core/artifacts/generators";
import { runReviewSession } from "@/core/review/orchestrator";
import { insertArtifact, listArtifacts } from "@/db/repositories/artifacts";
import { ROLE_KEYS, type RoleKey } from "@/core/review/roles";
import { loadGatewayConfig } from "@/core/llm";
import { listQuestions } from "@/db/repositories/questions";
import {
  countSessionsSince,
  createSession,
  getLatestSessionForSubmission,
} from "@/db/repositories/sessions";
import { getAccessibleSubmission } from "@/db/repositories/submissions";
import { getGateway } from "@/lib/ai";
import { fail, handleRouteError, ok } from "@/lib/api";
import { buildDossier } from "@/lib/build-dossier";
import { logger } from "@/lib/logger";
import { reviewStore } from "@/lib/review-store";
import { requireUser } from "@/lib/auth";
import { enqueueReviewJob } from "@/db/repositories/jobs";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Starts (or resumes) the review for a submission. Idempotent: while a
 * session is in flight this returns it; a failed session is resumed and
 * already-completed roles are not re-billed. 202 semantics — poll
 * GET /api/reviews/:id for progress.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const submission = await getAccessibleSubmission(id, user?.id);
    if (!submission) return fail("提交不存在", 404);

    const existing = await getLatestSessionForSubmission(id);
    if (existing && existing.status !== "completed" && existing.status !== "failed") {
      return ok({ sessionId: existing.id, resumed: true, status: existing.status }, 202);
    }

    const rateLimit = Number(process.env.REVIEW_RATE_LIMIT_PER_HOUR ?? 10);
    const recent = await countSessionsSince(new Date(Date.now() - HOUR_MS));
    if (recent >= rateLimit) {
      return fail(`已达到每小时 ${rateLimit} 次评审的限制，请稍后再试。`, 429);
    }

    const resumable = existing && existing.status === "failed";
    const config = loadGatewayConfig();
    const session = resumable
      ? existing
      : await createSession(id, [...ROLE_KEYS], {
          standard: config.standard.modelId,
          strong: config.strong.modelId,
          fallback: config.fallback?.modelId ?? null,
        });

    await enqueueReviewJob(session.id);

    return ok({ sessionId: session.id, resumed: resumable ?? false, status: "reviewing" }, 202);
  } catch (error) {
    return handleRouteError(error, "POST /api/submissions/[id]/review");
  }
}
