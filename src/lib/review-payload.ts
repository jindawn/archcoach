import { getSessionUsage } from "@/db/repositories/callLogs";
import { listQuestions } from "@/db/repositories/questions";
import { getSessionDetails } from "@/db/repositories/sessions";
import { getSubmission } from "@/db/repositories/submissions";
import type { ReviewSession } from "@/db/schema";
import { getAttemptBySubmission } from "@/db/repositories/guidedTraining";

/**
 * Assembles the full review payload used by GET /api/reviews/:id and the
 * public share page. One assembly path so the two views never drift.
 */
export async function buildReviewPayload(sessionOrId: string | ReviewSession) {
  const id = typeof sessionOrId === "string" ? sessionOrId : sessionOrId.id;
  const details = await getSessionDetails(id);
  if (!details) return null;

  const [submission, usage, questions] = await Promise.all([
    getSubmission(details.session.submissionId),
    getSessionUsage(id),
    listQuestions(details.session.submissionId),
  ]);
  const trainingAttempt = submission ? await getAttemptBySubmission(submission.id) : null;

  return {
    session: details.session,
    submission,
    roleReviews: details.roleReviews,
    artifacts: details.artifacts,
    questions,
    usage,
    trainingAttempt,
  };
}
