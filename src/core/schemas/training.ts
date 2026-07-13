import { z } from "zod";

export const CAPABILITY_KEYS = ["requirements", "data", "technology", "reliability", "capacity"] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];
export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  requirements: "需求理解", data: "数据与存储", technology: "技术选型", reliability: "可靠性", capacity: "容量与成本",
};

export const trainingStepSchema = z.object({
  id: z.string().min(1).max(60), title: z.string().min(1).max(100), capability: z.enum(CAPABILITY_KEYS),
  question: z.string().min(10), hints: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  rubric: z.array(z.string().min(1)).min(1),
});
export const trainingGuideSchema = z.object({
  version: z.literal(1), intro: z.string().min(1), solutionTemplate: z.string().min(1),
  steps: z.array(trainingStepSchema).min(3).max(10),
}).superRefine((guide, ctx) => {
  const ids = new Set<string>();
  guide.steps.forEach((step, index) => {
    if (ids.has(step.id)) ctx.addIssue({ code: "custom", path: ["steps", index, "id"], message: "step id 必须唯一" });
    ids.add(step.id);
    if (!guide.solutionTemplate.includes(`{{${step.id}}}`)) ctx.addIssue({ code: "custom", path: ["solutionTemplate"], message: `缺少 {{${step.id}}} 占位符` });
  });
});
export type TrainingGuide = z.infer<typeof trainingGuideSchema>;

export const capabilityAssessmentSchema = z.object({ scores: z.array(z.object({
  capability: z.enum(CAPABILITY_KEYS), score: z.number().min(0).max(100), evidence: z.string().min(1).max(500), advice: z.string().min(1).max(500),
})).min(1) });
export type CapabilityAssessment = z.infer<typeof capabilityAssessmentSchema>;
export const firstFeedbackSchema = z.object({
  strengths: z.array(z.object({ point: z.string().min(1).max(300), evidence: z.string().min(1).max(200) })).max(3),
  gaps: z.array(z.object({ point: z.string().min(1).max(300), rubricItem: z.string().min(1).max(300) })).max(3),
  followUpQuestion: z.string().min(1).max(500),
});
export type FirstFeedback = z.infer<typeof firstFeedbackSchema>;
export const finalFeedbackSchema = z.object({
  resolved: z.boolean(), correction: z.string().min(1).max(500), takeaway: z.string().min(1).max(500),
});
export type FinalFeedback = z.infer<typeof finalFeedbackSchema>;

export function computeIndependence(levels: number[]): number {
  if (!levels.length) return 100;
  const weights = [1, 0.8, 0.55, 0.25];
  return Math.round(levels.reduce((sum, level) => sum + weights[Math.max(0, Math.min(3, level))], 0) / levels.length * 100);
}
