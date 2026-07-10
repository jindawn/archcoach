import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pool } from "@/db/client";
import { reviewJobs, type ReviewJob } from "@/db/schema";

export async function enqueueReviewJob(sessionId: string): Promise<ReviewJob> {
  const [job] = await db.insert(reviewJobs).values({ sessionId }).onConflictDoNothing().returning();
  return job ?? (await db.select().from(reviewJobs).where(eq(reviewJobs.sessionId, sessionId)))[0];
}

export async function claimNextReviewJob(maxAttempts = 3): Promise<string | null> {
  const result = await pool.query<{ session_id: string }>(
    `UPDATE review_jobs
       SET status = 'running', attempts = attempts + 1, started_at = now(), error = NULL
     WHERE id = (
       SELECT id FROM review_jobs
       WHERE status IN ('queued', 'failed') AND attempts < $1
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING session_id`,
    [maxAttempts],
  );
  return result.rows[0]?.session_id ?? null;
}

export async function updateReviewJob(
  sessionId: string,
  patch: Partial<Pick<ReviewJob, "status" | "attempts" | "error" | "startedAt" | "completedAt">>,
) {
  await db.update(reviewJobs).set(patch).where(eq(reviewJobs.sessionId, sessionId));
}
