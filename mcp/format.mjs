/**
 * Formats ArchCoach API payloads into agent-friendly markdown.
 * Token-conscious: the report tool returns a digest; full artifacts are
 * fetched individually via get_artifact.
 */

const ROLE_NAMES = {
  chief_architect: "首席架构师",
  tech_architect: "技术架构师",
  database: "数据库专家",
  sre: "SRE",
  security: "安全专家",
  interviewer: "面试官",
};

const STATUS_LABELS = {
  pending: "等待开始",
  reviewing: "评委评审中",
  summarizing: "汇总中",
  generating_artifacts: "生成产物中",
  completed: "已完成",
  failed: "失败",
};

export function roleName(key) {
  return ROLE_NAMES[key] ?? key;
}

/** progress line while a session is still running */
export function formatProgress(payload) {
  const { session, roleReviews } = payload;
  const done = roleReviews.filter((r) => r.status === "completed");
  const lines = [
    `评审进行中：${STATUS_LABELS[session.status] ?? session.status}（${done.length}/${roleReviews.length} 位评委完成）`,
    ...done.map((r) => `- ${roleName(r.roleKey)}：${r.score?.toFixed(1)} 分${r.isBlocking ? "（判定阻塞上线）" : ""}`),
    "",
    "请稍后再次调用 get_review_report 获取进展。本地模型一次完整评审约 10-20 分钟，云端模型约 2-4 分钟。",
  ];
  return lines.join("\n");
}

/** full report digest for a completed session */
export function formatReport(payload) {
  const { session, submission, roleReviews, artifacts, usage } = payload;
  const summary = session.summary;
  const lines = [];

  lines.push(`# 评审报告：${submission?.title ?? ""}`);
  lines.push("");
  lines.push(`**综合评级：${session.grade}（${session.overallScore} 分）**`);
  if (summary?.blocked) {
    lines.push("");
    lines.push(
      `> ⛔ 存在上线阻塞项${summary.capApplied === "blocking" ? "（总分已按仲裁规则封顶，最高 C 级）" : ""}`,
    );
  }
  lines.push("");
  lines.push(`## 委员会总评`);
  lines.push(summary?.overallAssessment ?? "");

  lines.push("");
  lines.push("## 评委打分");
  for (const review of roleReviews) {
    if (review.status !== "completed" || !review.result) {
      lines.push(`- ${roleName(review.roleKey)}：未完成`);
      continue;
    }
    lines.push(
      `- ${roleName(review.roleKey)}：**${review.result.score.toFixed(1)}**${review.result.isBlocking ? " ⛔阻塞" : ""} — ${review.result.scoreRationale}`,
    );
  }

  const blockers = roleReviews
    .filter((r) => r.result?.isBlocking && r.result?.blockingReason)
    .map((r) => `- [${roleName(r.roleKey)}] ${r.result.blockingReason}`);
  if (blockers.length > 0) {
    lines.push("");
    lines.push("## 阻塞项");
    lines.push(...blockers);
  }

  if (summary?.prioritizedActions?.length) {
    lines.push("");
    lines.push("## 改进行动清单");
    for (const action of summary.prioritizedActions) {
      lines.push(`- **${action.priority}** ${action.action}（${action.rationale}）`);
    }
  }

  if (summary?.topRisks?.length) {
    lines.push("");
    lines.push("## Top 风险");
    for (const risk of summary.topRisks) {
      lines.push(`- [${risk.severity}] ${risk.risk} — 缓解：${risk.mitigation}`);
    }
  }

  if (summary?.conflicts?.length) {
    lines.push("");
    lines.push("## 评委分歧（保留双方立场）");
    for (const conflict of summary.conflicts) {
      lines.push(
        `- ${conflict.topic}：${roleName(conflict.positionA.roleKey)}认为「${conflict.positionA.position}」；${roleName(conflict.positionB.roleKey)}认为「${conflict.positionB.position}」。${conflict.guidance}`,
      );
    }
  }

  if (artifacts?.length) {
    lines.push("");
    lines.push("## 已生成产物（用 get_artifact 获取全文）");
    for (const artifact of artifacts) {
      lines.push(`- \`${artifact.type}\`：${artifact.title}`);
    }
  }

  if (usage) {
    lines.push("");
    lines.push(
      `_本次评审：${usage.calls} 次模型调用，输入 ${usage.promptTokens} / 输出 ${usage.completionTokens} tokens${usage.costUsd > 0 ? `，估算成本 $${usage.costUsd.toFixed(4)}` : ""}_`,
    );
  }

  return lines.join("\n");
}

/** clarifying questions, formatted so an agent can answer them from repo context */
export function formatQuestions(submissionId, questions) {
  const lines = [
    `已创建评审提交（submissionId: \`${submissionId}\`）。`,
    "",
    "评审委员会在正式评审前想确认以下问题。**建议你根据代码库/上下文尽量回答**（回答越具体评审越准），",
    "然后调用 start_review 提交回答；无法回答的问题可以跳过。",
    "",
  ];
  for (const question of questions) {
    lines.push(`- questionId: \`${question.id}\``);
    lines.push(`  [${roleName(question.roleKey)}] ${question.question}`);
  }
  return lines.join("\n");
}
