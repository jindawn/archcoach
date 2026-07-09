#!/usr/bin/env node
/**
 * ArchCoach MCP server — lets coding agents (Claude Code, Cursor, …) submit
 * architecture designs to a running ArchCoach instance and read the review
 * board's verdict.
 *
 * This is a thin API client, not an embedded engine: start ArchCoach first
 * (`docker compose up` or `pnpm dev`), then point ARCHCOACH_URL at it
 * (default http://localhost:3000).
 *
 * Usage (claude code):
 *   claude mcp add archcoach -- node /path/to/archcoach/mcp/archcoach-mcp.mjs
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatProgress, formatQuestions, formatReport } from "./format.mjs";

const BASE_URL = (process.env.ARCHCOACH_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function api(method, path, body) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(
      `无法连接 ArchCoach（${BASE_URL}）：${error.message}。请先启动实例（docker compose up），或通过 ARCHCOACH_URL 指定地址。`,
    );
  }
  const payload = await response.json().catch(() => null);
  if (!payload?.success) {
    throw new Error(payload?.error ?? `ArchCoach 返回 HTTP ${response.status}`);
  }
  return payload.data;
}

function text(content) {
  return { content: [{ type: "text", text: content }] };
}

const submissionInput = {
  title: z.string().min(2).max(200).describe("方案标题"),
  businessContext: z
    .string()
    .min(20)
    .describe("业务背景：业务是什么、用户是谁、核心链路，附上流量/数据量等关键数字"),
  solutionMd: z.string().min(50).describe("架构方案（Markdown）：整体设计、关键决策、异常路径"),
  techStack: z.string().optional().describe("技术栈，如 Go + Redis + Kafka + MySQL"),
  constraints: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional()
    .describe("约束条件，如 {qps: 50000, sla: '99.95%', teamSize: 5}"),
  diagramSource: z.string().optional().describe("Mermaid 架构图源码（可选）"),
};

const server = new McpServer({ name: "archcoach", version: "0.1.0" });

server.registerTool(
  "get_clarifying_questions",
  {
    title: "提交方案并获取评审前追问",
    description:
      "把架构方案提交给 ArchCoach 评审委员会，返回评委们在正式评审前的追问清单。推荐流程：先调用本工具，根据代码库上下文回答追问，再调用 start_review。信息越全评审越准。",
    inputSchema: submissionInput,
  },
  async (input) => {
    const submission = await api("POST", "/api/submissions", {
      kind: "real",
      ...input,
      diagramType: input.diagramSource ? "mermaid" : undefined,
    });
    const clarify = await api("POST", `/api/submissions/${submission.id}/clarify`);
    return text(formatQuestions(submission.id, clarify.questions));
  },
);

server.registerTool(
  "start_review",
  {
    title: "提交追问回答并启动评审",
    description:
      "为已创建的提交启动六角色评审（异步执行）。answers 可选——能回答的追问尽量回答。返回 sessionId，用 get_review_report 轮询结果。",
    inputSchema: {
      submissionId: z.string().uuid(),
      answers: z
        .array(z.object({ questionId: z.string().uuid(), answer: z.string().max(4000) }))
        .optional()
        .describe("对追问的回答，可只回答部分"),
    },
  },
  async ({ submissionId, answers }) => {
    if (answers && answers.length > 0) {
      await api("PUT", `/api/submissions/${submissionId}/answers`, { answers });
    }
    const result = await api("POST", `/api/submissions/${submissionId}/review`);
    return text(
      `评审已启动（sessionId: \`${result.sessionId}\`${result.resumed ? "，续跑之前的会话" : ""}）。\n六位评委正在并行评审，用 get_review_report 查询进展与最终报告。`,
    );
  },
);

server.registerTool(
  "review_architecture",
  {
    title: "一步式架构评审（跳过追问）",
    description:
      "提交方案并立即启动评审，跳过追问环节。适合方案信息已经很完整的情况；否则建议走 get_clarifying_questions → start_review 的两步流程。",
    inputSchema: submissionInput,
  },
  async (input) => {
    const submission = await api("POST", "/api/submissions", {
      kind: "real",
      ...input,
      diagramType: input.diagramSource ? "mermaid" : undefined,
    });
    const result = await api("POST", `/api/submissions/${submission.id}/review`);
    return text(
      `评审已启动（sessionId: \`${result.sessionId}\`）。用 get_review_report 查询进展与最终报告。`,
    );
  },
);

server.registerTool(
  "get_review_report",
  {
    title: "获取评审进展或最终报告",
    description:
      "查询评审会话。进行中返回进度；完成后返回完整报告摘要（评分、阻塞项、行动清单、分歧、产物列表）。",
    inputSchema: { sessionId: z.string().uuid() },
  },
  async ({ sessionId }) => {
    const payload = await api("GET", `/api/reviews/${sessionId}`);
    const running = ["pending", "reviewing", "summarizing", "generating_artifacts"].includes(
      payload.session.status,
    );
    if (running) return text(formatProgress(payload));
    if (payload.session.status === "failed") {
      return text(
        `评审失败：${payload.session.error ?? "未知错误"}\n可对同一 submission 再次调用 start_review 从断点续跑（已完成的评委不会重复计费）。`,
      );
    }
    return text(formatReport(payload));
  },
);

server.registerTool(
  "get_artifact",
  {
    title: "获取评审产物全文",
    description: "获取某个评审产物的完整内容：c4_diagram（Mermaid 源码）、adr（决策记录合集）、interview_script（面试讲解稿）。",
    inputSchema: {
      sessionId: z.string().uuid(),
      type: z.enum(["c4_diagram", "adr", "interview_script"]),
    },
  },
  async ({ sessionId, type }) => {
    const payload = await api("GET", `/api/reviews/${sessionId}`);
    const artifact = payload.artifacts.find((item) => item.type === type);
    if (!artifact) {
      return text(`产物 ${type} 不存在。已有产物：${payload.artifacts.map((a) => a.type).join(", ") || "无"}`);
    }
    const body =
      type === "c4_diagram" ? "```mermaid\n" + artifact.content + "\n```" : artifact.content;
    return text(`# ${artifact.title}\n\n${body}`);
  },
);

server.registerTool(
  "list_training_scenarios",
  {
    title: "列出内置训练题",
    description: "列出 ArchCoach 内置的架构训练题（秒杀、SaaS 多租户、RAG 知识库等）。",
    inputSchema: {},
  },
  async () => {
    const scenarios = await api("GET", "/api/scenarios");
    const lines = scenarios.map(
      (s) => `- **${s.title}**（${s.difficulty} / ${s.domain}，slug: \`${s.slug}\`）`,
    );
    return text(lines.join("\n") || "暂无训练题");
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
