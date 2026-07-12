import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { trainingAttempts, trainingStepAnswers } from "@/db/schema";

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
  const answers = await db.select().from(trainingStepAnswers).where(eq(trainingStepAnswers.attemptId, id)).orderBy(asc(trainingStepAnswers.createdAt));
  return { attempt, answers };
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

export async function setHintLevel(answerId: string, level: number) {
  const [row] = await db.update(trainingStepAnswers).set({ hintLevel: level, updatedAt: new Date() }).where(eq(trainingStepAnswers.id, answerId)).returning(); return row;
}
export async function setFollowUp(answerId: string, question: string | null) { await db.update(trainingStepAnswers).set({ followUpQuestion: question, updatedAt: new Date() }).where(eq(trainingStepAnswers.id, answerId)); }
export async function completeAttempt(id: string, patch: { submissionId: string; independenceScore: number; capabilityScores: unknown; recommendedStepId: string | null }) {
  const [row] = await db.update(trainingAttempts).set({ status: "completed", ...patch, updatedAt: new Date() }).where(eq(trainingAttempts.id, id)).returning(); return row;
}
export async function updateAssessment(id: string, patch: { capabilityScores: unknown; recommendedStepId: string | null }) {
  await db.update(trainingAttempts).set({ ...patch, updatedAt: new Date() }).where(eq(trainingAttempts.id, id));
}
export async function getAttemptBySubmission(submissionId: string) {
  const [row] = await db.select().from(trainingAttempts).where(eq(trainingAttempts.submissionId, submissionId)).limit(1); return row ?? null;
}
