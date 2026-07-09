import { z } from "zod";
import { ROLE_KEYS } from "../review/roles";

export const clarifyingQuestionSchema = z.object({
  roleKey: z.enum(ROLE_KEYS).describe("提出该问题的评审角色"),
  question: z.string().min(8).describe("向方案提交者的具体追问，中文"),
  whyMatters: z.string().min(8).describe("为什么这个信息缺口会影响架构评审结论"),
});

export const clarifyOutputSchema = z.object({
  questions: z
    .array(clarifyingQuestionSchema)
    .min(4)
    .max(12)
    .describe("评审前必须澄清的关键问题，6-10 个为宜"),
});

export type ClarifyOutput = z.infer<typeof clarifyOutputSchema>;
