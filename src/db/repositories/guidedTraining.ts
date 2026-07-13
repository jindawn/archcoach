import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { trainingAttempts, trainingAttemptVersions, trainingStepAnswers } from "@/db/schema";

const ownerFilter = (userId?: string) => userId ? eq(trainingAttempts.userId, userId) : isNull(trainingAttempts.userId);

export async function createOrResumeAttempt(scenarioSlug: string, userId?: string) {
  const [existing] = await db.select().from(trainingAttempts).where(and(eq(trainingAttempts.scenarioSlug, scenarioSlug), ownerFilter(userId), eq(trainingAttempts.status, "in_progress"))).orderBy(desc(trainingAttempts.createdAt)).limit(1);
  if (existing) return existing;
  const [row] = await db.insert(trainingAttempts).values({ scenarioSlug, userId }).returning();
  return row;
}

export async function getAttempt(id: string, userId?: string) {
  const [attempt] = await db.select().from(trainingAttempts).where(and(eq(trainingAttempts.id, id), ownerFilter(userId))).limit(1);
  if (!attempt) return null;
  const [answers, versions] = await Promise.all([
    db.select().from(trainingStepAnswers).where(eq(trainingStepAnswers.attemptId, id)).orderBy(asc(trainingStepAnswers.createdAt)),
    db.select().from(trainingAttemptVersions).where(eq(trainingAttemptVersions.attemptId, id)).orderBy(asc(trainingAttemptVersions.version)),
  ]);
  return { attempt, answers, versions };
}

export async function getLatestAnswer(attemptId: string, stepId: string) {
  const [row] = await db.select().from(trainingStepAnswers).where(and(eq(trainingStepAnswers.attemptId, attemptId), eq(trainingStepAnswers.stepId, stepId))).orderBy(desc(trainingStepAnswers.revision)).limit(1);
  return row ?? null;
}

export async function saveStepAnswer(attemptId: string, stepId: string, answer: string, followUpAnswer?: string, createRevision = false) {
  const current = await getLatestAnswer(attemptId, stepId);
  if (current && !createRevision) {
    const [row] = await db.update(trainingStepAnswers).set({ answer, followUpAnswer: followUpAnswer ?? current.followUpAnswer, updatedAt: new Date() }).where(eq(trainingStepAnswers.id, current.id)).returning();
    return row;
  }
  const [row] = await db.insert(trainingStepAnswers).values({ attemptId, stepId, revision: current ? current.revision + 1 : 1, answer, hintLevel: current?.hintLevel ?? 0, followUpAnswer }).returning();
  return row;
}

export async function saveDraft(attemptId: string, stepId: string, answer: string, followUpAnswer: string | undefined, expectedVersion: number) {
  const current = await getLatestAnswer(attemptId, stepId);
  if (!current) {
    if (expectedVersion !== 0) return null;
    const [row] = await db.insert(trainingStepAnswers).values({ attemptId, stepId, answer, followUpAnswer, contentVersion: 1 }).returning(); return row;
  }
  if (current.contentVersion !== expectedVersion) return null;
  const [row] = await db.update(trainingStepAnswers).set({ answer, followUpAnswer: followUpAnswer ?? current.followUpAnswer, contentVersion: expectedVersion + 1, updatedAt: new Date() }).where(and(eq(trainingStepAnswers.id, current.id), eq(trainingStepAnswers.contentVersion, expectedVersion))).returning();
  return row ?? null;
}

export async function setHintLevel(answerId: string, level: number) {
  const [row] = await db.update(trainingStepAnswers).set({ hintLevel: level, updatedAt: new Date() }).where(eq(trainingStepAnswers.id, answerId)).returning(); return row;
}
export async function setFirstFeedback(answerId: string, feedback: unknown) { const question = feedback && typeof feedback === "object" && "followUpQuestion" in feedback ? String((feedback as {followUpQuestion: unknown}).followUpQuestion) : null; const [row] = await db.update(trainingStepAnswers).set({ firstFeedback: feedback, followUpQuestion: question, updatedAt: new Date() }).where(eq(trainingStepAnswers.id, answerId)).returning(); return row; }
export async function setFinalFeedback(answerId: string, feedback: unknown, followUpAnswer: string) { const [row] = await db.update(trainingStepAnswers).set({ finalFeedback: feedback, followUpAnswer, updatedAt: new Date() }).where(eq(trainingStepAnswers.id, answerId)).returning(); return row; }
export async function completeAttempt(id: string, patch: { submissionId: string; independenceScore: number; capabilityScores: unknown; recommendedStepId: string | null }) {
  const [row] = await db.update(trainingAttempts).set({ status: "completed", ...patch, updatedAt: new Date() }).where(eq(trainingAttempts.id, id)).returning(); return row;
}
export async function updateAssessment(id: string, patch: { capabilityScores: unknown; recommendedStepId: string | null }) {
  await db.update(trainingAttempts).set({ ...patch, updatedAt: new Date() }).where(eq(trainingAttempts.id, id));
}
export async function getAttemptBySubmission(submissionId: string) {
  const [linked] = await db.select({ attempt: trainingAttempts, version: trainingAttemptVersions }).from(trainingAttemptVersions).innerJoin(trainingAttempts, eq(trainingAttemptVersions.attemptId, trainingAttempts.id)).where(eq(trainingAttemptVersions.submissionId, submissionId)).limit(1);
  if (linked) return { ...linked.attempt, currentVersion: linked.version };
  const [row] = await db.select().from(trainingAttempts).where(eq(trainingAttempts.submissionId, submissionId)).limit(1); return row ? { ...row, currentVersion: null } : null;
}

export type AnswerSnapshot = Array<{ stepId: string; answer: string; followUpAnswer: string | null; hintLevel: number; firstFeedback: unknown; finalFeedback: unknown }>;
export async function createAttemptVersion(attemptId: string, data: { answerSnapshot: AnswerSnapshot; solutionMd: string; independenceScore: number; capabilityScores: unknown; recommendedStepId: string | null; submissionId?: string | null }) {
  const [latest] = await db.select().from(trainingAttemptVersions).where(eq(trainingAttemptVersions.attemptId, attemptId)).orderBy(desc(trainingAttemptVersions.version)).limit(1);
  const [row] = await db.insert(trainingAttemptVersions).values({ attemptId, version: (latest?.version ?? 0) + 1, answerSnapshot: data.answerSnapshot, solutionMd: data.solutionMd, independenceScore: data.independenceScore, capabilityScores: data.capabilityScores, assessmentStatus: data.capabilityScores ? "completed" : "unavailable", recommendedStepId: data.recommendedStepId, submissionId: data.submissionId }).returning();
  await db.update(trainingAttempts).set({ status: "completed", submissionId: data.submissionId ?? undefined, independenceScore: data.independenceScore, capabilityScores: data.capabilityScores, recommendedStepId: data.recommendedStepId, updatedAt: new Date() }).where(eq(trainingAttempts.id, attemptId));
  return row;
}
export async function getAttemptVersion(id: string, version: number) { const [row] = await db.select().from(trainingAttemptVersions).where(and(eq(trainingAttemptVersions.attemptId, id), eq(trainingAttemptVersions.version, version))).limit(1); return row ?? null; }
export async function listAttemptVersions(attemptId: string) { return db.select().from(trainingAttemptVersions).where(eq(trainingAttemptVersions.attemptId, attemptId)).orderBy(asc(trainingAttemptVersions.version)); }
export async function updateVersionAssessment(id: string, capabilityScores: unknown, recommendedStepId: string | null) { const [row] = await db.update(trainingAttemptVersions).set({ capabilityScores, recommendedStepId, assessmentStatus: capabilityScores ? "completed" : "unavailable" }).where(eq(trainingAttemptVersions.id, id)).returning(); return row; }
export async function linkVersionSubmission(id: string, submissionId: string) { const [row] = await db.update(trainingAttemptVersions).set({ submissionId }).where(eq(trainingAttemptVersions.id, id)).returning(); await db.update(trainingAttempts).set({ submissionId, updatedAt: new Date() }).where(eq(trainingAttempts.id, row.attemptId)); return row; }
