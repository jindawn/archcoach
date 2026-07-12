import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reviewSessions, roleReviews, scenarios, submissions } from "@/db/schema";

export interface TrainingProgress {
  completed: number;
  total: number;
  averageScore: number | null;
  weakestRole: string | null;
  recommendedScenario: { slug: string; title: string; difficulty: string } | null;
}

export async function getTrainingProgress(userId?: string): Promise<TrainingProgress> {
  const allScenarios = await db.select().from(scenarios);
  const completedRows = await db
    .select({ slug: submissions.scenarioSlug, score: reviewSessions.overallScore, sessionId: reviewSessions.id })
    .from(submissions)
    .innerJoin(reviewSessions, eq(reviewSessions.submissionId, submissions.id))
    .where(and(eq(submissions.kind, "training"), eq(reviewSessions.status, "completed"), userId ? eq(submissions.userId, userId) : undefined));
  const completed = new Set(completedRows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)));
  const scores = completedRows.map((row) => row.score).filter((score): score is number => score !== null);
  const sessionIds = completedRows.map((row) => row.sessionId);
  const roleRows = sessionIds.length
    ? await db.select({ roleKey: roleReviews.roleKey, score: roleReviews.score }).from(roleReviews).where(inArray(roleReviews.sessionId, sessionIds))
    : [];
  const roleScores = new Map<string, number[]>();
  for (const row of roleRows) if (row.score !== null) roleScores.set(row.roleKey, [...(roleScores.get(row.roleKey) ?? []), row.score]);
  const weakestRole = [...roleScores.entries()].sort((a, b) => (a[1].reduce((x, y) => x + y, 0) / a[1].length) - (b[1].reduce((x, y) => x + y, 0) / b[1].length))[0]?.[0] ?? null;
  const orderedScenarios = [...allScenarios].sort((a, b) => {
    const rank = (difficulty: string) => difficulty === "beginner" ? 0 : difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;
    return rank(a.difficulty) - rank(b.difficulty) || a.sortOrder - b.sortOrder;
  });
  const unfinishedBeginner = orderedScenarios.filter((scenario) => scenario.difficulty === "beginner" && !completed.has(scenario.slug));
  const recommendation = unfinishedBeginner[0] ?? orderedScenarios.find((scenario) => !completed.has(scenario.slug)) ?? orderedScenarios[0];
  return { completed: completed.size, total: allScenarios.length, averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null, weakestRole, recommendedScenario: recommendation ? { slug: recommendation.slug, title: recommendation.title, difficulty: recommendation.difficulty } : null };
}
