import { claimNextReviewJob } from "@/db/repositories/jobs";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const secret = process.env.JOB_WORKER_SECRET;
    if (!secret && process.env.LOCAL_MODE === "false") return fail("未配置 JOB_WORKER_SECRET", 503);
    if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) return fail("未授权", 401);
    const sessionId = await claimNextReviewJob();
    if (!sessionId) return ok({ claimed: false });
    const response = await fetch(new URL(`/api/internal/review-jobs/${sessionId}/run`, request.url), {
      method: "POST",
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    });
    if (!response.ok) throw new Error(`任务 ${sessionId} 执行失败：HTTP ${response.status}`);
    return ok({ claimed: true, sessionId });
  } catch (error) {
    return handleRouteError(error, "POST /api/internal/review-jobs/run-next");
  }
}
