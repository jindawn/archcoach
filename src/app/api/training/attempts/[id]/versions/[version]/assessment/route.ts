import { getAttempt, getAttemptVersion, updateVersionAssessment } from "@/db/repositories/guidedTraining";
import { getScenarioBySlug } from "@/db/repositories/scenarios";
import { assessAnswers, parseGuide, recommendedStep } from "@/lib/guided-training";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  try {
    const { id, version } = await params; const user = await requireUser(); const found = await getAttempt(id, user?.id); if (!found) return fail("训练记录不存在", 404);
    const item = await getAttemptVersion(id, Number(version)); if (!item) return fail("训练版本不存在", 404);
    const scenario = await getScenarioBySlug(found.attempt.scenarioSlug); if (!scenario?.trainingGuide) return fail("训练指南不存在", 422);
    const guide = parseGuide(scenario.trainingGuide); const answers = item.answerSnapshot as Array<{stepId:string;answer:string;followUpAnswer:string|null;hintLevel:number}>;
    const assessment = await assessAnswers(guide, answers); const hints = new Map(answers.map((a) => [a.stepId, a.hintLevel]));
    return ok(await updateVersionAssessment(item.id, assessment, recommendedStep(guide, assessment, hints)));
  } catch (error) { return handleRouteError(error, "POST training version assessment"); }
}
