import type { NextRequest } from "next/server";
import { createAttemptVersion, getAttempt } from "@/db/repositories/guidedTraining";
import { getScenarioBySlug } from "@/db/repositories/scenarios";
import { createSubmission } from "@/db/repositories/submissions";
import { assembleSolution, assessAnswers, computeIndependence, parseGuide, recommendedStep } from "@/lib/guided-training";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const found = await getAttempt((await params).id, user?.id); if (!found) return fail("训练记录不存在", 404);
    if (found.versions.length) return ok({ attempt: found.attempt, submissionId: found.versions[0].submissionId, version: found.versions[0] });
    const scenario = await getScenarioBySlug(found.attempt.scenarioSlug); if (!scenario?.trainingGuide) return fail("训练指南不存在", 422);
    const guide = parseGuide(scenario.trainingGuide); const latest = [...new Map([...found.answers].sort((a,b)=>a.revision-b.revision).map((a) => [a.stepId, a])).values()];
    if (guide.steps.some((step) => !latest.find((a) => a.stepId === step.id)?.answer.trim())) return fail("请完成全部训练步骤", 422);
    const solutionMd = assembleSolution(guide, latest); const assessment = await assessAnswers(guide, latest);
    const hintMap = new Map(latest.map((a) => [a.stepId, a.hintLevel])); const independenceScore = computeIndependence(latest.map((a) => a.hintLevel));
    const submission = await createSubmission({ userId: user?.id, title: scenario.title, kind: "training", scenarioSlug: scenario.slug, businessContext: scenario.backgroundMd, solutionMd, constraints: scenario.constraints as Record<string, string | number> });
    const snapshot = latest.map((a) => ({ stepId: a.stepId, answer: a.answer, followUpAnswer: a.followUpAnswer, hintLevel: a.hintLevel, firstFeedback: a.firstFeedback, finalFeedback: a.finalFeedback }));
    const version = await createAttemptVersion(found.attempt.id, { answerSnapshot: snapshot, solutionMd, independenceScore, capabilityScores: assessment, recommendedStepId: recommendedStep(guide, assessment, hintMap), submissionId: submission.id });
    return ok({ version, submissionId: submission.id }, 201);
  } catch (error) { return handleRouteError(error, "POST training complete"); }
}
