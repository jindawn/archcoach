import { fail, handleRouteError, ok } from "@/lib/api";
import { buildReviewPayload } from "@/lib/review-payload";

/** Full session state for the polling UI: status, per-role progress, summary, artifacts, usage. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await buildReviewPayload(id);
    if (!payload) return fail("评审会话不存在", 404);
    return ok(payload);
  } catch (error) {
    return handleRouteError(error, "GET /api/reviews/[id]");
  }
}
