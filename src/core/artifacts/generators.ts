import { z } from "zod";
import type { Gateway } from "../llm/gateway";
import { loadPromptTemplate } from "../prompts/loader";
import type { RoleReviewRunResult } from "../review/role-reviewer";
import type { SummaryOutput } from "../schemas/summary";
import { extractMermaidSource, validateMermaid } from "./mermaid-validator";

export const ARTIFACT_TYPES = ["c4_diagram", "adr", "interview_script"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export interface GeneratedArtifact {
  type: ArtifactType;
  title: string;
  content: string;
  meta: Record<string, unknown>;
}

const markdownDocSchema = z.object({
  title: z.string().min(2),
  markdown: z.string().min(100),
});

const diagramSchema = z.object({
  title: z.string().min(2),
  mermaid: z.string().min(30),
});

const MAX_DIAGRAM_REPAIRS = 2;
const DOSSIER_EXCERPT_CHARS = 4_000;

export interface ArtifactContext {
  sessionId: string;
  dossier: string;
  summary: SummaryOutput;
  roleResults: RoleReviewRunResult[];
}

function summaryDigest(context: ArtifactContext): string {
  const followUps = context.roleResults.flatMap((r) =>
    r.review.followUpQuestions.map((q) => ({ roleKey: r.roleKey, question: q })),
  );
  return [
    "## 方案卷宗（节选）",
    context.dossier.slice(0, DOSSIER_EXCERPT_CHARS),
    "## 评审汇总（JSON）",
    JSON.stringify(
      {
        overallAssessment: context.summary.overallAssessment,
        topRisks: context.summary.topRisks,
        prioritizedActions: context.summary.prioritizedActions,
        keyDecisions: context.summary.keyDecisions,
        roleScores: context.roleResults.map((r) => ({
          roleKey: r.roleKey,
          score: r.review.score,
          isBlocking: r.review.isBlocking,
        })),
        followUpQuestions: followUps.slice(0, 12),
      },
      null,
      1,
    ),
  ].join("\n\n");
}

export async function generateDiagram(
  gateway: Gateway,
  context: ArtifactContext,
): Promise<GeneratedArtifact> {
  const template = loadPromptTemplate("artifacts/c4-diagram");
  let extraInstruction = "";

  for (let attempt = 0; attempt <= MAX_DIAGRAM_REPAIRS; attempt += 1) {
    const result = await gateway.call({
      task: "artifact:c4_diagram",
      schema: diagramSchema,
      system: template.content,
      prompt: summaryDigest(context) + extraInstruction,
      tier: "strong",
      promptVersion: template.version,
      sessionId: context.sessionId,
    });
    const source = extractMermaidSource(result.object.mermaid);
    const validation = await validateMermaid(source);
    if (validation.valid) {
      return {
        type: "c4_diagram",
        title: result.object.title,
        content: source,
        meta: { renderRisk: false, attempts: attempt + 1 },
      };
    }
    extraInstruction = `\n\n---\n你上一次生成的 mermaid 源码解析失败，错误信息：\n${validation.error}\n请修正语法后重新输出完整源码。`;
    if (attempt === MAX_DIAGRAM_REPAIRS) {
      // store the source anyway; the UI falls back to showing raw source
      return {
        type: "c4_diagram",
        title: result.object.title,
        content: source,
        meta: { renderRisk: true, parseError: validation.error, attempts: attempt + 1 },
      };
    }
  }
  throw new Error("unreachable");
}

export async function generateAdrDoc(
  gateway: Gateway,
  context: ArtifactContext,
): Promise<GeneratedArtifact> {
  const template = loadPromptTemplate("artifacts/adr");
  const result = await gateway.call({
    task: "artifact:adr",
    schema: markdownDocSchema,
    system: template.content,
    prompt: summaryDigest(context),
    tier: "strong",
    promptVersion: template.version,
    sessionId: context.sessionId,
  });
  return {
    type: "adr",
    title: result.object.title,
    content: result.object.markdown,
    meta: { decisions: context.summary.keyDecisions.length },
  };
}

export async function generateInterviewScript(
  gateway: Gateway,
  context: ArtifactContext,
): Promise<GeneratedArtifact> {
  const template = loadPromptTemplate("artifacts/interview-script");
  const result = await gateway.call({
    task: "artifact:interview_script",
    schema: markdownDocSchema,
    system: template.content,
    prompt: summaryDigest(context),
    tier: "strong",
    promptVersion: template.version,
    sessionId: context.sessionId,
  });
  return {
    type: "interview_script",
    title: result.object.title,
    content: result.object.markdown,
    meta: {},
  };
}

export interface ArtifactSink {
  insert(artifact: GeneratedArtifact & { sessionId: string }): Promise<void>;
  /** artifact types that already exist for the session (resume support) */
  existingTypes(sessionId: string): Promise<string[]>;
}

/**
 * Runs the three generators in parallel. Individual failures are collected —
 * a broken diagram must not sink an otherwise finished review.
 */
export function createArtifactsGenerator(gateway: Gateway, sink: ArtifactSink) {
  return async function generateArtifacts(context: ArtifactContext): Promise<void> {
    const existing = new Set(await sink.existingTypes(context.sessionId));
    const jobs: Array<() => Promise<GeneratedArtifact>> = [];
    if (!existing.has("c4_diagram")) jobs.push(() => generateDiagram(gateway, context));
    if (!existing.has("adr")) jobs.push(() => generateAdrDoc(gateway, context));
    if (!existing.has("interview_script"))
      jobs.push(() => generateInterviewScript(gateway, context));

    const results = await Promise.allSettled(jobs.map((job) => job()));
    for (const result of results) {
      if (result.status === "fulfilled") {
        await sink.insert({ ...result.value, sessionId: context.sessionId });
      }
    }
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length === results.length && results.length > 0) {
      throw new Error(`所有产物生成均失败：${(failures[0] as PromiseRejectedResult).reason}`);
    }
  };
}
