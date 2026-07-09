import { getSubmission } from "@/db/repositories/submissions";
import { listQuestions } from "@/db/repositories/questions";
import { getLatestSessionForSubmission } from "@/db/repositories/sessions";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const submission = await getSubmission(id);
    if (!submission) return fail("提交不存在", 404);
    const [questions, latestSession] = await Promise.all([
      listQuestions(id),
      getLatestSessionForSubmission(id),
    ]);
    return ok({ submission, questions, latestSession });
  } catch (error) {
    return handleRouteError(error, "GET /api/submissions/[id]");
  }
}
