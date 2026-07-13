import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewSessions, submissions, teamMembers, trainingAttemptVersions, type NewSubmission, type Submission } from "@/db/schema";

export async function createSubmission(data: NewSubmission): Promise<Submission> {
  const [row] = await db.insert(submissions).values(data).returning();
  return row;
}

export async function getSubmission(id: string, userId?: string): Promise<Submission | null> {
  const [row] = await db
    .select()
    .from(submissions)
    .where(userId ? and(eq(submissions.id, id), eq(submissions.userId, userId)) : eq(submissions.id, id));
  return row ?? null;
}

export async function getAccessibleSubmission(id: string, userId?: string): Promise<Submission | null> {
  const submission = await getSubmission(id);
  if (!submission || !userId || submission.userId === userId) return submission;
  if (!submission.teamId) return null;
  const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, submission.teamId), eq(teamMembers.userId, userId))).limit(1);
  return member ? submission : null;
}

export interface SubmissionListItem extends Submission {
  latestSession: {
    id: string;
    status: string;
    overallScore: number | null;
    grade: string | null;
  } | null;
  guidedTraining: { attemptId: string; version: number; assessmentStatus: string; pendingReview: boolean } | null;
}

export async function listSubmissions(limit = 50, userId?: string): Promise<SubmissionListItem[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(userId ? eq(submissions.userId, userId) : undefined)
    .orderBy(desc(submissions.createdAt))
    .limit(limit);

  const visibleRows: Array<{ submission: Submission; guidedTraining: SubmissionListItem["guidedTraining"] }> = [];
  for (const submission of rows) {
    const [linked] = await db.select().from(trainingAttemptVersions).where(eq(trainingAttemptVersions.submissionId, submission.id)).limit(1);
    if (linked) {
      const [latestLinked] = await db.select().from(trainingAttemptVersions).where(eq(trainingAttemptVersions.attemptId, linked.attemptId)).orderBy(desc(trainingAttemptVersions.version)).limit(1);
      const latestSubmissionVersion = latestLinked?.submissionId ? latestLinked : (await db.select().from(trainingAttemptVersions).where(eq(trainingAttemptVersions.attemptId, linked.attemptId)).orderBy(desc(trainingAttemptVersions.version))).find((v)=>v.submissionId);
      if (latestSubmissionVersion?.submissionId !== submission.id) continue;
      visibleRows.push({ submission, guidedTraining: { attemptId: linked.attemptId, version: latestLinked.version, assessmentStatus: latestLinked.assessmentStatus, pendingReview: !latestLinked.submissionId } });
      continue;
    }
    visibleRows.push({ submission, guidedTraining: null });
  }
  const items = await Promise.all(
    visibleRows.map(async ({ submission, guidedTraining }) => {
      const [session] = await db
        .select({
          id: reviewSessions.id,
          status: reviewSessions.status,
          overallScore: reviewSessions.overallScore,
          grade: reviewSessions.grade,
        })
        .from(reviewSessions)
        .where(eq(reviewSessions.submissionId, submission.id))
        .orderBy(desc(reviewSessions.createdAt))
        .limit(1);
      return { ...submission, latestSession: session ?? null, guidedTraining };
    }),
  );
  return items;
}
