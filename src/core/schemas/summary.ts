import { z } from "zod";
import { ROLE_KEYS } from "../review/roles";
import { severityEnum } from "./review";

export const summaryOutputSchema = z.object({
  overallAssessment: z.string().min(30).describe("总评，3-5 句：方案定位、最大亮点、最大隐患"),
  topRisks: z
    .array(
      z.object({
        risk: z.string().describe("风险描述"),
        sourceRole: z.enum(ROLE_KEYS).describe("提出该风险的评委"),
        severity: severityEnum,
        mitigation: z.string().describe("缓解方向"),
      }),
    )
    .max(8)
    .describe("跨角色汇总后最值得关注的风险，按严重度排序"),
  conflicts: z
    .array(
      z.object({
        topic: z.string().describe("争议点"),
        positionA: z.object({ roleKey: z.enum(ROLE_KEYS), position: z.string() }),
        positionB: z.object({ roleKey: z.enum(ROLE_KEYS), position: z.string() }),
        guidance: z.string().describe("两种立场各自的适用条件，不强行裁决"),
      }),
    )
    .max(5)
    .describe("评委之间意见相左之处。没有冲突时返回空数组，不要编造"),
  prioritizedActions: z
    .array(
      z.object({
        action: z.string().describe("要做的具体改进"),
        priority: z.enum(["P0", "P1", "P2"]),
        rationale: z.string().describe("为什么是这个优先级"),
        sourceRoles: z.array(z.enum(ROLE_KEYS)).min(1),
      }),
    )
    .min(3)
    .max(10)
    .describe("合并去重后的改进行动清单，P0 在前"),
  missingInfo: z.array(z.string()).max(8).describe("评审中反复被指出的信息缺口"),
  keyDecisions: z
    .array(
      z.object({
        decision: z.string().describe("方案中的一个关键架构决策"),
        context: z.string().describe("该决策面对的问题与约束"),
        options: z.array(z.string()).min(2).describe("评审中真实出现过的备选项，含当前选择"),
        rationale: z.string().describe("选择当前方案的理由与代价"),
      }),
    )
    .min(2)
    .max(6)
    .describe("值得沉淀为 ADR 的关键决策，选项必须来自方案或评委意见，不得编造"),
});

export type SummaryOutput = z.infer<typeof summaryOutputSchema>;
