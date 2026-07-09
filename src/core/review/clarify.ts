import { loadPromptTemplate } from "../prompts/loader";
import { clarifyOutputSchema, type ClarifyOutput } from "../schemas/clarify";
import type { Gateway } from "../llm/gateway";

export interface ClarifyResult {
  questions: ClarifyOutput["questions"];
  promptVersion: string;
  sanitizeHits: string[];
}

export async function generateClarifyingQuestions(
  gateway: Gateway,
  dossier: string,
  options: { sessionId?: string } = {},
): Promise<ClarifyResult> {
  const template = loadPromptTemplate("clarify");
  const result = await gateway.call({
    task: "clarify",
    schema: clarifyOutputSchema,
    system: template.content,
    prompt: dossier,
    tier: "standard",
    promptVersion: template.version,
    sessionId: options.sessionId,
  });
  return {
    questions: result.object.questions,
    promptVersion: template.version,
    sanitizeHits: result.sanitizeHits,
  };
}
