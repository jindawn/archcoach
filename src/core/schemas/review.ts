import { z } from "zod";

export const severityEnum = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof severityEnum>;

export const roleReviewOutputSchema = z.object({
  concerns: z.array(z.string()).min(2).max(8).describe("本角色本次评审重点关注的方面"),
  score: z.number().min(0).max(10).describe("按评分锚点给出的 0-10 分"),
  scoreRationale: z.string().min(10).describe("给出该分数的理由，一两句话"),
  issues: z
    .array(
      z.object({
        title: z.string().min(4).describe("问题标题，一句话"),
        detail: z.string().min(10).describe("问题的具体展开：影响是什么、为什么是问题"),
        evidence: z.string().min(6).describe("逐字引用卷宗原文片段（10-80字），证明问题来源"),
        severity: severityEnum,
        category: z.string().describe("问题类别，如 capacity/consistency/authz/cost"),
      }),
    )
    .max(10),
  risks: z
    .array(
      z.object({
        risk: z.string().describe("上线后可能发生的具体风险"),
        likelihood: z.enum(["low", "medium", "high"]),
        impact: z.enum(["low", "medium", "high"]),
        mitigation: z.string().describe("缓解手段"),
      }),
    )
    .max(6),
  suggestions: z
    .array(
      z.object({
        suggestion: z.string().min(10).describe("落到做什么怎么做的改进建议"),
        priority: z.enum(["P0", "P1", "P2"]),
        effort: z.enum(["S", "M", "L"]).describe("预估工作量"),
      }),
    )
    .max(8),
  followUpQuestions: z.array(z.string()).max(5).describe("还想当面追问的问题"),
  isBlocking: z.boolean().describe("是否存在阻塞上线的问题"),
  blockingReason: z.string().optional().describe("isBlocking 为 true 时必填"),
});

export type RoleReviewOutput = z.infer<typeof roleReviewOutputSchema>;

/** issue annotated by the evidence verifier */
export interface VerifiedIssue {
  title: string;
  detail: string;
  evidence: string;
  severity: Severity;
  category: string;
  /** false when the quoted evidence cannot be located in the dossier */
  verified: boolean;
}

export interface VerifiedRoleReview extends Omit<RoleReviewOutput, "issues"> {
  issues: VerifiedIssue[];
}
