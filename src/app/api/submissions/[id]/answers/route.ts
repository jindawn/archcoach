import type { NextRequest } from "next/server";
import { saveAnswersSchema } from "@/core/schemas/api";
import { listQuestions, saveAnswer } from "@/db/repositories/questions";
import { getAccessibleSubmission } from "@/db/repositories/submissions";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const submission = await getAccessibleSubmission(id, user?.id);
    if (!submission) return fail("提交不存在", 404);

    const input = saveAnswersSchema.parse(await request.json());
    const questions = await listQuestions(id);
    const known = new Set(questions.map((q) => q.id));
    const unknown = input.answers.filter((a) => !known.has(a.questionId));
    if (unknown.length > 0) {
      return fail("包含不属于该提交的问题 ID", 422);
    }

    await Promise.all(input.answers.map((a) => saveAnswer(a.questionId, a.answer)));
    return ok({ saved: input.answers.length });
  } catch (error) {
    return handleRouteError(error, "PUT /api/submissions/[id]/answers");
  }
}
