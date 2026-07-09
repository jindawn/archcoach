import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roleReviews, type RoleReview } from "@/db/schema";

/** Creates one pending row per enabled role; already-existing rows are kept (resume). */
export async function initRoleReviews(sessionId: string, roleKeys: string[]): Promise<void> {
  if (roleKeys.length === 0) return;
  await db
    .insert(roleReviews)
    .values(roleKeys.map((roleKey) => ({ sessionId, roleKey })))
    .onConflictDoNothing();
}

export async function listRoleReviews(sessionId: string): Promise<RoleReview[]> {
  return db.select().from(roleReviews).where(eq(roleReviews.sessionId, sessionId));
}

export async function updateRoleReview(
  sessionId: string,
  roleKey: string,
  patch: Partial<
    Pick<
      RoleReview,
      "status" | "score" | "riskLevel" | "isBlocking" | "result" | "promptVersion" | "model"
    >
  >,
): Promise<void> {
  await db
    .update(roleReviews)
    .set(patch)
    .where(and(eq(roleReviews.sessionId, sessionId), eq(roleReviews.roleKey, roleKey)));
}
