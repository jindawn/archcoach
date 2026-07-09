import { compileDossier, type DossierInput } from "@/core/review/dossier";
import type { ClarifyingQuestion, Submission } from "@/db/schema";
import { getScenarioBySlug } from "@/db/repositories/scenarios";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Maps DB rows to the core dossier input and compiles the shared review context. */
export async function buildDossier(
  submission: Submission,
  questions: ClarifyingQuestion[] = [],
): Promise<string> {
  let scenario: DossierInput["scenario"];
  if (submission.kind === "training" && submission.scenarioSlug) {
    const row = await getScenarioBySlug(submission.scenarioSlug);
    if (row) {
      scenario = {
        title: row.title,
        backgroundMd: row.backgroundMd,
        constraints: asRecord(row.constraints),
      };
    }
  }

  return compileDossier({
    title: submission.title,
    kind: submission.kind,
    scenario,
    businessContext: submission.businessContext,
    solutionMd: submission.solutionMd,
    techStack: submission.techStack,
    constraints: asRecord(submission.constraints),
    diagramSource: submission.diagramSource,
    diagramType: submission.diagramType,
    qa: questions.map((q) => ({ question: q.question, answer: q.answer })),
  });
}
