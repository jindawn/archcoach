import type { TrainingGuide, CapabilityAssessment } from "@/core/schemas/training";
import { capabilityAssessmentSchema, computeIndependence, finalFeedbackSchema, firstFeedbackSchema, trainingGuideSchema, type FinalFeedback, type FirstFeedback } from "@/core/schemas/training";
import { getGateway } from "@/lib/ai";
import type { Gateway } from "@/core/llm";

export function parseGuide(value: unknown): TrainingGuide { return trainingGuideSchema.parse(value); }
export function assembleSolution(guide: TrainingGuide, answers: Array<{ stepId: string; answer: string; followUpAnswer: string | null }>) {
  const byStep = new Map(answers.map((a) => [a.stepId, `${a.answer}${a.followUpAnswer ? `\n\n补充说明：${a.followUpAnswer}` : ""}`]));
  return guide.steps.reduce((text, step) => text.replaceAll(`{{${step.id}}}`, byStep.get(step.id) ?? "（未作答）"), guide.solutionTemplate);
}
export { computeIndependence };

export async function generateFirstFeedback(guide: TrainingGuide, stepId: string, answer: string, gateway: Gateway = getGateway()): Promise<FirstFeedback | null> {
  const step = guide.steps.find((s) => s.id === stepId); if (!step) return null;
  try {
    const result = await gateway.call({ task: "training:feedback:first", schema: firstFeedbackSchema, tier: "standard", promptVersion: "v2",
      system: "你是耐心的架构入门教练。指出做对点和遗漏点，再提出一个短问题。不得直接给出标准答案，不得声称用户写过其答案中不存在的内容。",
      prompt: `问题：${step.question}\n评分点：${step.rubric.join("；")}\n学员回答：${answer}` });
    const validEvidence = result.object.strengths.every((item) => answer.includes(item.evidence));
    const validRubric = result.object.gaps.every((item) => step.rubric.includes(item.rubricItem));
    return validEvidence && validRubric ? result.object : null;
  } catch { return null; }
}

export async function generateFinalFeedback(guide: TrainingGuide, stepId: string, answer: string, followUpAnswer: string, gateway: Gateway = getGateway()): Promise<FinalFeedback | null> {
  const step = guide.steps.find((s) => s.id === stepId); if (!step) return null;
  try {
    const result = await gateway.call({ task: "training:feedback:final", schema: finalFeedbackSchema, tier: "standard", promptVersion: "v2",
      system: "你是架构入门教练。判断追问回答是否补齐关键理解，必要时简短纠偏，并给出一条可迁移到其他系统的知识总结。不要给新的追问。",
      prompt: `原问题：${step.question}\n评分点：${step.rubric.join("；")}\n原回答：${answer}\n追问回答：${followUpAnswer}` });
    return result.object;
  } catch { return null; }
}

export async function assessAnswers(guide: TrainingGuide, answers: Array<{ stepId: string; answer: string; followUpAnswer: string | null }>, gateway: Gateway = getGateway()): Promise<CapabilityAssessment | null> {
  const text = guide.steps.map((step) => { const a = answers.find((x) => x.stepId === step.id); return `[${step.capability}] ${step.title}\n回答：${a?.answer ?? ""}\n补充：${a?.followUpAnswer ?? ""}\n评分点：${step.rubric.join("；")}`; }).join("\n\n");
  try {
    const result = await gateway.call({ task: "training:assessment", schema: capabilityAssessmentSchema, tier: "standard", promptVersion: "v2",
      system: "你是架构入门教练。按能力维度给0-100分。evidence必须逐字引用学员回答中的短句，不得引用评分点；每个出现的能力维度只输出一次。",
      prompt: text });
    const allAnswerText = answers.flatMap((a) => [a.answer, a.followUpAnswer ?? ""]).join("\n");
    const valid = result.object.scores.filter((s) => allAnswerText.includes(s.evidence));
    const expected = new Set(guide.steps.map((step) => step.capability));
    const returned = new Set(valid.map((score) => score.capability));
    if (valid.length === expected.size && returned.size === expected.size && [...expected].every((key) => returned.has(key))) return { scores: valid };
  } catch { /* unavailable */ }
  return null;
}

export function recommendedStep(guide: TrainingGuide, assessment: CapabilityAssessment | null, hintLevels: Map<string, number>) {
  if (!assessment) return [...guide.steps].sort((a, b) => (hintLevels.get(b.id) ?? 0) - (hintLevels.get(a.id) ?? 0))[0]?.id ?? null;
  const score = new Map(assessment.scores.map((s) => [s.capability, s.score]));
  return [...guide.steps].sort((a, b) => (score.get(a.capability) ?? 0) - (score.get(b.capability) ?? 0) || (hintLevels.get(b.id) ?? 0) - (hintLevels.get(a.id) ?? 0))[0]?.id ?? null;
}
