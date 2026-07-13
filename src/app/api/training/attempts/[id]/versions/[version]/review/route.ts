import { getAttempt, getAttemptVersion, linkVersionSubmission } from "@/db/repositories/guidedTraining";
import { getScenarioBySlug } from "@/db/repositories/scenarios";
import { createSubmission } from "@/db/repositories/submissions";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  try {
    const { id, version } = await params; const user = await requireUser(); const found = await getAttempt(id, user?.id); if (!found) return fail("训练记录不存在", 404);
    const item = await getAttemptVersion(id, Number(version)); if (!item) return fail("训练版本不存在", 404);
    if (item.submissionId) return ok({ submissionId: item.submissionId, resumed: true });
    const scenario = await getScenarioBySlug(found.attempt.scenarioSlug); if (!scenario) return fail("训练题不存在", 404);
    const submission = await createSubmission({ userId: user?.id, title: `${scenario.title} · v${item.version}`, kind: "training", scenarioSlug: scenario.slug, businessContext: scenario.backgroundMd, solutionMd: item.solutionMd, constraints: scenario.constraints as Record<string,string|number> });
    await linkVersionSubmission(item.id, submission.id); return ok({ submissionId: submission.id, resumed: false }, 201);
  } catch (error) { return handleRouteError(error, "POST training version review"); }
}
