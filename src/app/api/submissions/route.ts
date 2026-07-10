import type { NextRequest } from "next/server";
import { createSubmissionSchema } from "@/core/schemas/api";
import { createSubmission, listSubmissions } from "@/db/repositories/submissions";
import { getScenarioBySlug } from "@/db/repositories/scenarios";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { isTeamMember } from "@/db/repositories/teams";

export async function POST(request: NextRequest) {
  try {
    const input = createSubmissionSchema.parse(await request.json());
    const user = await requireUser();
    if (input.teamId && (!user || !(await isTeamMember(input.teamId, user.id)))) return fail("无团队权限", 403);
    if (input.kind === "training") {
      if (!input.scenarioSlug) return fail("训练题提交必须指定 scenarioSlug", 422);
      const scenario = await getScenarioBySlug(input.scenarioSlug);
      if (!scenario) return fail(`训练题不存在：${input.scenarioSlug}`, 404);
    }
    const submission = await createSubmission({ ...input, userId: user?.id });
    return ok(submission, 201);
  } catch (error) {
    return handleRouteError(error, "POST /api/submissions");
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const items = await listSubmissions(50, user?.id);
    return ok(items);
  } catch (error) {
    return handleRouteError(error, "GET /api/submissions");
  }
}
