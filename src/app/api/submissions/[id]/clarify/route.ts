import { generateClarifyingQuestions } from "@/core/review/clarify";
import { getSubmission } from "@/db/repositories/submissions";
import { insertQuestions, listQuestions } from "@/db/repositories/questions";
import { getGateway } from "@/lib/ai";
import { fail, handleRouteError, ok } from "@/lib/api";
import { buildDossier } from "@/lib/build-dossier";

/** Generates clarifying questions. Idempotent: existing questions are returned as-is. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const submission = await getSubmission(id);
    if (!submission) return fail("提交不存在", 404);

    const existing = await listQuestions(id);
    if (existing.length > 0) {
      return ok({ questions: existing, reused: true });
    }

    const dossier = await buildDossier(submission);
    const result = await generateClarifyingQuestions(getGateway(), dossier);
    const saved = await insertQuestions(
      id,
      result.questions.map((q, index) => ({
        roleKey: q.roleKey,
        question: q.question,
        whyMatters: q.whyMatters,
        sortOrder: index,
      })),
    );
    return ok({ questions: saved, reused: false, sanitizeHits: result.sanitizeHits }, 201);
  } catch (error) {
    return handleRouteError(error, "POST /api/submissions/[id]/clarify");
  }
}
