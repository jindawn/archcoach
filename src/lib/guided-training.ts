import type { TrainingGuide, CapabilityAssessment, CapabilityKey } from "@/core/schemas/training";
import { capabilityAssessmentSchema, computeIndependence, followUpSchema, trainingGuideSchema } from "@/core/schemas/training";
import { getGateway } from "@/lib/ai";

export function parseGuide(value: unknown): TrainingGuide { return trainingGuideSchema.parse(value); }
export function assembleSolution(guide: TrainingGuide, answers: Array<{ stepId: string; answer: string; followUpAnswer: string | null }>) {
  const byStep = new Map(answers.map((a) => [a.stepId, `${a.answer}${a.followUpAnswer ? `\n\n补充说明：${a.followUpAnswer}` : ""}`]));
  return guide.steps.reduce((text, step) => text.replaceAll(`{{${step.id}}}`, byStep.get(step.id) ?? "（未作答）"), guide.solutionTemplate);
}
export { computeIndependence };

export async function generateFollowUp(guide: TrainingGuide, stepId: string, answer: string): Promise<string | null> {
  const step = guide.steps.find((s) => s.id === stepId); if (!step) return null;
  try {
    const result = await getGateway().call({ task: "training:followup", schema: followUpSchema, tier: "standard", promptVersion: "v1",
      system: "你是耐心的架构入门教练。只在回答遗漏关键思考时提出一个短问题；不能泄露标准答案。",
      prompt: `问题：${step.question}\n评分点：${step.rubric.join("；")}\n学员回答：${answer}` });
    return result.object.needed && result.object.question.trim() ? result.object.question.trim() : null;
  } catch { return null; }
}

export async function assessAnswers(guide: TrainingGuide, answers: Array<{ stepId: string; answer: string; followUpAnswer: string | null }>): Promise<CapabilityAssessment> {
  const text = guide.steps.map((step) => { const a = answers.find((x) => x.stepId === step.id); return `[${step.capability}] ${step.title}\n回答：${a?.answer ?? ""}\n补充：${a?.followUpAnswer ?? ""}\n评分点：${step.rubric.join("；")}`; }).join("\n\n");
  try {
    const result = await getGateway().call({ task: "training:assessment", schema: capabilityAssessmentSchema, tier: "standard", promptVersion: "v1",
      system: "你是架构入门教练。按能力维度给0-100分。evidence必须逐字引用学员回答中的短句，不得引用评分点；每个出现的能力维度只输出一次。",
      prompt: text });
    const allAnswerText = answers.flatMap((a) => [a.answer, a.followUpAnswer ?? ""]).join("\n");
    const valid = result.object.scores.filter((s) => allAnswerText.includes(s.evidence));
    const expected = new Set(guide.steps.map((step) => step.capability));
    const returned = new Set(valid.map((score) => score.capability));
    if (returned.size === expected.size && [...expected].every((key) => returned.has(key))) return { scores: valid };
  } catch { /* deterministic fallback below */ }
  const grouped = new Map<CapabilityKey, number[]>();
  for (const step of guide.steps) { const answer = answers.find((a) => a.stepId === step.id); const score = Math.min(80, 30 + Math.floor(((answer?.answer.length ?? 0) + (answer?.followUpAnswer?.length ?? 0)) / 8)); grouped.set(step.capability, [...(grouped.get(step.capability) ?? []), score]); }
  return { scores: [...grouped].map(([capability, values]) => ({ capability, score: Math.round(values.reduce((a,b)=>a+b,0)/values.length), evidence: answers.find((a) => guide.steps.find((s) => s.id === a.stepId)?.capability === capability)?.answer.slice(0, 80) || "未提供有效说明", advice: "补充选择依据、数据流和失败处理。" })) };
}

export function recommendedStep(guide: TrainingGuide, assessment: CapabilityAssessment, hintLevels: Map<string, number>) {
  const score = new Map(assessment.scores.map((s) => [s.capability, s.score]));
  return [...guide.steps].sort((a, b) => (score.get(a.capability) ?? 0) - (score.get(b.capability) ?? 0) || (hintLevels.get(b.id) ?? 0) - (hintLevels.get(a.id) ?? 0))[0]?.id ?? null;
}
