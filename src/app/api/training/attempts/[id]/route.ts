import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAttemptVersion, getAttempt, getLatestAnswer, saveDraft, saveStepAnswer, setFinalFeedback, setFirstFeedback, setHintLevel } from "@/db/repositories/guidedTraining";
import { getScenarioBySlug } from "@/db/repositories/scenarios";
import { assembleSolution, assessAnswers, computeIndependence, generateFinalFeedback, generateFirstFeedback, parseGuide, recommendedStep } from "@/lib/guided-training";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

async function context(id: string) {
  const user = await requireUser(); const found = await getAttempt(id, user?.id); if (!found) return null;
  const scenario = await getScenarioBySlug(found.attempt.scenarioSlug); if (!scenario?.trainingGuide) return null;
  return { ...found, scenario, guide: parseGuide(scenario.trainingGuide) };
}
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const found = await context((await params).id); return found ? ok(found) : fail("训练记录不存在", 404); } catch (error) { return handleRouteError(error, "GET training attempt"); }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id; const found = await context(id); if (!found) return fail("训练记录不存在", 404);
    const input = z.discriminatedUnion("action", [
      z.object({ action: z.literal("save"), stepId: z.string(), answer: z.string().min(10).max(8000), followUpAnswer: z.string().max(4000).optional() }),
      z.object({ action: z.literal("draft"), stepId: z.string(), answer: z.string().max(8000), followUpAnswer: z.string().max(4000).optional(), expectedVersion: z.number().int().min(0) }),
      z.object({ action: z.literal("hint"), stepId: z.string() }),
      z.object({ action: z.literal("finalFeedback"), stepId: z.string(), followUpAnswer: z.string().min(2).max(4000) }),
      z.object({ action: z.literal("retryFeedback"), stepId: z.string() }),
      z.object({ action: z.literal("retry"), stepId: z.string(), answer: z.string().min(10).max(8000), followUpAnswer: z.string().max(4000).optional() }),
    ]).parse(await request.json());
    if (!found.guide.steps.some((s) => s.id === input.stepId)) return fail("训练步骤不存在", 404);
    if (input.action === "hint") {
      let answer = await getLatestAnswer(id, input.stepId); if (!answer) answer = await saveStepAnswer(id, input.stepId, "");
      const level = Math.min(3, answer.hintLevel + 1); return ok(await setHintLevel(answer.id, level));
    }
    if (input.action === "draft") {
      const row = await saveDraft(id, input.stepId, input.answer, input.followUpAnswer, input.expectedVersion);
      if (!row) return Response.json({ success: false, error: "草稿已在其他位置更新", code: "VERSION_CONFLICT", data: await getLatestAnswer(id, input.stepId) }, { status: 409 });
      return ok(row);
    }
    if (input.action === "finalFeedback") {
      const current = await getLatestAnswer(id, input.stepId); if (!current?.firstFeedback) return fail("请先生成首轮反馈", 422);
      if (current.finalFeedback) return ok(current);
      const feedback = await generateFinalFeedback(found.guide, input.stepId, current.answer, input.followUpAnswer);
      return ok(await setFinalFeedback(current.id, feedback, input.followUpAnswer));
    }
    if (input.action === "retryFeedback") {
      const current = await getLatestAnswer(id, input.stepId); if (!current?.answer.trim()) return fail("请先填写答案", 422);
      const feedback = await generateFirstFeedback(found.guide, input.stepId, current.answer);
      return ok(await setFirstFeedback(current.id, feedback));
    }
    const row = await saveStepAnswer(id, input.stepId, input.answer, input.followUpAnswer, input.action === "retry");
    if (input.action === "save" && !row.firstFeedback) { const feedback = await generateFirstFeedback(found.guide, input.stepId, input.answer); return ok(await setFirstFeedback(row.id, feedback)); }
    if (input.action === "retry") {
      const refreshed = await getAttempt(id, (await requireUser())?.id); const latest = latestAnswers(refreshed?.answers ?? []);
      const assessment = await assessAnswers(found.guide, latest); const hintMap = new Map(latest.map((a) => [a.stepId, a.hintLevel]));
      const snapshot = latest.map((a) => ({ stepId: a.stepId, answer: a.answer, followUpAnswer: a.followUpAnswer, hintLevel: a.hintLevel, firstFeedback: a.firstFeedback, finalFeedback: a.finalFeedback }));
      const version = await createAttemptVersion(id, { answerSnapshot: snapshot, solutionMd: assembleSolution(found.guide, latest), independenceScore: computeIndependence(latest.map((a) => a.hintLevel)), capabilityScores: assessment, recommendedStepId: recommendedStep(found.guide, assessment, hintMap) });
      return ok({ answer: row, version });
    }
    return ok(row);
  } catch (error) { return handleRouteError(error, "PATCH training attempt"); }
}
function latestAnswers<T extends { stepId: string; revision: number }>(rows: T[]): T[] { return [...new Map([...rows].sort((a,b)=>a.revision-b.revision).map((r) => [r.stepId, r])).values()]; }
