import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clarifyingQuestions, type ClarifyingQuestion } from "@/db/schema";

export interface NewQuestion {
  roleKey: string;
  question: string;
  whyMatters: string;
  sortOrder: number;
}

export async function insertQuestions(
  submissionId: string,
  questions: NewQuestion[],
): Promise<ClarifyingQuestion[]> {
  if (questions.length === 0) return [];
  return db
    .insert(clarifyingQuestions)
    .values(questions.map((q) => ({ ...q, submissionId })))
    .returning();
}

export async function listQuestions(submissionId: string): Promise<ClarifyingQuestion[]> {
  return db
    .select()
    .from(clarifyingQuestions)
    .where(eq(clarifyingQuestions.submissionId, submissionId))
    .orderBy(asc(clarifyingQuestions.sortOrder));
}

export async function saveAnswer(questionId: string, answer: string): Promise<void> {
  await db
    .update(clarifyingQuestions)
    .set({ answer })
    .where(eq(clarifyingQuestions.id, questionId));
}
