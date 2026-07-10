import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewJobs, type ReviewJob } from "@/db/schema";
export async function enqueueReviewJob(sessionId: string): Promise<ReviewJob> { const [job] = await db.insert(reviewJobs).values({ sessionId }).onConflictDoNothing().returning(); return job ?? (await db.select().from(reviewJobs).where(eq(reviewJobs.sessionId, sessionId)))[0]; }
export async function updateReviewJob(sessionId: string, patch: Partial<Pick<ReviewJob, "status" | "attempts" | "error" | "startedAt" | "completedAt">>) { await db.update(reviewJobs).set(patch).where(eq(reviewJobs.sessionId, sessionId)); }
