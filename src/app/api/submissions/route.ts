import type { NextRequest } from "next/server";
import { createSubmissionSchema } from "@/core/schemas/api";
import { createSubmission, listSubmissions } from "@/db/repositories/submissions";
import { getScenarioBySlug } from "@/db/repositories/scenarios";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const input = createSubmissionSchema.parse(await request.json());
    if (input.kind === "training") {
      if (!input.scenarioSlug) return fail("训练题提交必须指定 scenarioSlug", 422);
      const scenario = await getScenarioBySlug(input.scenarioSlug);
      if (!scenario) return fail(`训练题不存在：${input.scenarioSlug}`, 404);
    }
    const submission = await createSubmission(input);
    return ok(submission, 201);
  } catch (error) {
    return handleRouteError(error, "POST /api/submissions");
  }
}

export async function GET() {
  try {
    const items = await listSubmissions();
    return ok(items);
  } catch (error) {
    return handleRouteError(error, "GET /api/submissions");
  }
}
