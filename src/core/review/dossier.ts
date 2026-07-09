/**
 * Compiles everything reviewers need to know about a submission into one
 * stable markdown document (the "dossier"). Every role review receives the
 * exact same dossier text so provider-side prompt caching can kick in.
 */

export interface DossierQa {
  question: string;
  answer: string | null;
}

export interface DossierInput {
  title: string;
  kind: string; // real | training
  scenario?: {
    title: string;
    backgroundMd: string;
    constraints: Record<string, unknown>;
  };
  businessContext: string;
  solutionMd: string;
  techStack?: string | null;
  constraints: Record<string, unknown>;
  diagramSource?: string | null;
  diagramType?: string | null;
  qa?: DossierQa[];
}

/**
 * Rough budget: ~60k chars ≈ 20-30k tokens for mixed Chinese/English text.
 * The solution body is the largest section, so it absorbs the truncation.
 */
const MAX_DOSSIER_CHARS = 60_000;
const TRUNCATION_MARKER = "\n\n> [注意] 方案内容超出长度限制，以下部分已截断。评审时请说明信息不完整。";

function renderConstraints(constraints: Record<string, unknown>): string {
  const entries = Object.entries(constraints).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (entries.length === 0) return "（未提供）";
  return entries.map(([key, value]) => `- ${key}: ${String(value)}`).join("\n");
}

export function compileDossier(input: DossierInput): string {
  const sections: string[] = [];

  sections.push(`# 架构方案卷宗：${input.title}`);
  sections.push(`类型：${input.kind === "training" ? "训练题作答" : "真实方案评审"}`);

  if (input.scenario) {
    sections.push(
      `## 训练题背景：${input.scenario.title}\n\n${input.scenario.backgroundMd}\n\n### 题目约束\n\n${renderConstraints(input.scenario.constraints)}`,
    );
  }

  sections.push(`## 业务背景\n\n${input.businessContext}`);
  sections.push(`## 架构方案\n\n${input.solutionMd}`);

  if (input.techStack) {
    sections.push(`## 技术栈\n\n${input.techStack}`);
  }

  sections.push(`## 约束条件\n\n${renderConstraints(input.constraints)}`);

  if (input.diagramSource) {
    sections.push(
      `## 架构图（${input.diagramType ?? "unknown"} 源码）\n\n\`\`\`\n${input.diagramSource}\n\`\`\``,
    );
  }

  const answered = (input.qa ?? []).filter((item) => item.answer?.trim());
  const skipped = (input.qa ?? []).filter((item) => !item.answer?.trim());
  if (input.qa && input.qa.length > 0) {
    const qaLines = [
      ...answered.map((item) => `**问：${item.question}**\n答：${item.answer}`),
      ...skipped.map((item) => `**问：${item.question}**\n答：（提交者未回答）`),
    ];
    sections.push(`## 追问与回答\n\n${qaLines.join("\n\n")}`);
  }

  const full = sections.join("\n\n");
  if (full.length <= MAX_DOSSIER_CHARS) return full;
  return full.slice(0, MAX_DOSSIER_CHARS) + TRUNCATION_MARKER;
}
