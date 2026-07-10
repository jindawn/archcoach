import { createArtifactsGenerator } from "@/core/artifacts/generators";
import { runReviewSession } from "@/core/review/orchestrator";
import { insertArtifact, listArtifacts } from "@/db/repositories/artifacts";
import { updateReviewJob } from "@/db/repositories/jobs";
import { listQuestions } from "@/db/repositories/questions";
import { getSession } from "@/db/repositories/sessions";
import { getSubmission } from "@/db/repositories/submissions";
import { ROLE_KEYS, type RoleKey } from "@/core/review/roles";
import { loadGatewayConfig } from "@/core/llm";
import { getGateway } from "@/lib/ai";
import { fail, handleRouteError, ok } from "@/lib/api";
import { buildDossier } from "@/lib/build-dossier";
import { reviewStore } from "@/lib/review-store";
import { searchKnowledge } from "@/db/repositories/knowledge";
import { embedTexts } from "@/lib/embeddings";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const secret = process.env.JOB_WORKER_SECRET;
    if (!secret && process.env.LOCAL_MODE === "false") return fail("未配置 JOB_WORKER_SECRET", 503);
    if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) return fail("未授权", 401);
    const { sessionId } = await params;
    const session = await getSession(sessionId);
    if (!session) return fail("评审会话不存在", 404);
    const submission = await getSubmission(session.submissionId);
    if (!submission) return fail("提交不存在", 404);
    await updateReviewJob(sessionId, { status: "running", startedAt: new Date(), error: null });
    const questions = await listQuestions(submission.id);
    await runReviewSession({
      sessionId, dossier: (await buildDossier(submission, questions)) + (submission.teamId ? `\n\n## 团队知识库（仅作参考）\n${(await searchKnowledge(submission.teamId, submission.solutionMd, (await embedTexts([submission.solutionMd.slice(0, 8_000)]))?.[0])).map((item) => `### ${item.title}\n${item.content}`).join("\n\n")}` : ""), enabledRoles: [...ROLE_KEYS] as RoleKey[],
      gateway: getGateway(), store: reviewStore, concurrency: loadGatewayConfig().maxConcurrency,
      generateArtifacts: createArtifactsGenerator(getGateway(), {
        async insert(artifact) { await insertArtifact(artifact); },
        async existingTypes(id) { return (await listArtifacts(id)).map((artifact) => artifact.type); },
      }),
    });
    await updateReviewJob(sessionId, { status: "completed", completedAt: new Date(), error: null });
    return ok({ sessionId, status: "completed" });
  } catch (error) {
    const { sessionId } = await params;
    await updateReviewJob(sessionId, { status: "failed", completedAt: new Date(), error: error instanceof Error ? error.message : String(error) });
    return handleRouteError(error, "POST /api/internal/review-jobs/[sessionId]/run");
  }
}
