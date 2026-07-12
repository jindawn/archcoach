import type { NextRequest } from "next/server";
import { z } from "zod";
import { getScenarioBySlug } from "@/db/repositories/scenarios";
import { createOrResumeAttempt } from "@/db/repositories/guidedTraining";
import { parseGuide } from "@/lib/guided-training";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const { scenarioSlug } = z.object({ scenarioSlug: z.string().max(100) }).parse(await request.json());
    const user = await requireUser(); const scenario = await getScenarioBySlug(scenarioSlug);
    if (!scenario) return fail("训练题不存在", 404);
    if (scenario.difficulty !== "beginner" || !scenario.trainingGuide) return fail("该题不支持引导训练", 422);
    parseGuide(scenario.trainingGuide);
    return ok(await createOrResumeAttempt(scenarioSlug, user?.id), 201);
  } catch (error) { return handleRouteError(error, "POST /api/training/attempts"); }
}
