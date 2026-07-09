import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  artifacts,
  reviewSessions,
  roleReviews,
  type Artifact,
  type ReviewSession,
  type RoleReview,
} from "@/db/schema";

export async function createSession(
  submissionId: string,
  enabledRoles: string[],
  modelProfile: Record<string, unknown>,
): Promise<ReviewSession> {
  const [session] = await db
    .insert(reviewSessions)
    .values({ submissionId, enabledRoles, modelProfile })
    .returning();
  return session;
}

export async function getSession(id: string): Promise<ReviewSession | null> {
  const [row] = await db.select().from(reviewSessions).where(eq(reviewSessions.id, id));
  return row ?? null;
}

export async function getLatestSessionForSubmission(
  submissionId: string,
): Promise<ReviewSession | null> {
  const [row] = await db
    .select()
    .from(reviewSessions)
    .where(eq(reviewSessions.submissionId, submissionId))
    .orderBy(desc(reviewSessions.createdAt))
    .limit(1);
  return row ?? null;
}

export interface SessionDetails {
  session: ReviewSession;
  roleReviews: RoleReview[];
  artifacts: Artifact[];
}

export async function getSessionDetails(id: string): Promise<SessionDetails | null> {
  const session = await getSession(id);
  if (!session) return null;
  const [reviews, sessionArtifacts] = await Promise.all([
    db.select().from(roleReviews).where(eq(roleReviews.sessionId, id)),
    db.select().from(artifacts).where(eq(artifacts.sessionId, id)),
  ]);
  return { session, roleReviews: reviews, artifacts: sessionArtifacts };
}

export async function countSessionsSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewSessions)
    .where(gte(reviewSessions.createdAt, since));
  return row.count;
}

export async function updateSession(
  id: string,
  patch: Partial<
    Pick<
      ReviewSession,
      "status" | "overallScore" | "grade" | "summary" | "error" | "startedAt" | "completedAt"
    >
  >,
): Promise<void> {
  await db.update(reviewSessions).set(patch).where(eq(reviewSessions.id, id));
}
