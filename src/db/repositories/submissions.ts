import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewSessions, submissions, type NewSubmission, type Submission } from "@/db/schema";

export async function createSubmission(data: NewSubmission): Promise<Submission> {
  const [row] = await db.insert(submissions).values(data).returning();
  return row;
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const [row] = await db.select().from(submissions).where(eq(submissions.id, id));
  return row ?? null;
}

export interface SubmissionListItem extends Submission {
  latestSession: {
    id: string;
    status: string;
    overallScore: number | null;
    grade: string | null;
  } | null;
}

export async function listSubmissions(limit = 50): Promise<SubmissionListItem[]> {
  const rows = await db
    .select()
    .from(submissions)
    .orderBy(desc(submissions.createdAt))
    .limit(limit);

  const items = await Promise.all(
    rows.map(async (submission) => {
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
      return { ...submission, latestSession: session ?? null };
    }),
  );
  return items;
}
