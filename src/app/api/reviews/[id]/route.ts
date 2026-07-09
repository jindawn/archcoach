import { getSessionUsage } from "@/db/repositories/callLogs";
import { listQuestions } from "@/db/repositories/questions";
import { getSessionDetails } from "@/db/repositories/sessions";
import { getSubmission } from "@/db/repositories/submissions";
import { fail, handleRouteError, ok } from "@/lib/api";

/** Full session state for the polling UI: status, per-role progress, summary, artifacts, usage. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const details = await getSessionDetails(id);
    if (!details) return fail("评审会话不存在", 404);

    const [submission, usage, questions] = await Promise.all([
      getSubmission(details.session.submissionId),
      getSessionUsage(id),
      listQuestions(details.session.submissionId),
    ]);

    return ok({
      session: details.session,
      submission,
      roleReviews: details.roleReviews,
      artifacts: details.artifacts,
      questions,
      usage,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/reviews/[id]");
  }
}
