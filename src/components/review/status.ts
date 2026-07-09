export const SESSION_STATUS_LABEL: Record<string, string> = {
  pending: "等待开始",
  reviewing: "评委评审中",
  summarizing: "主持人汇总中",
  generating_artifacts: "生成产物中",
  completed: "已完成",
  failed: "评审失败",
};

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "致命",
  high: "高",
  medium: "中",
  low: "低",
};

export const SEVERITY_CLASS: Record<string, string> = {
  critical: "text-severity-critical border-severity-critical/50 bg-severity-critical/10",
  high: "text-severity-high border-severity-high/50 bg-severity-high/10",
  medium: "text-severity-medium border-severity-medium/50 bg-severity-medium/10",
  low: "text-severity-low border-severity-low/50 bg-severity-low/10",
};

export function isSessionRunning(status: string): boolean {
  return ["pending", "reviewing", "summarizing", "generating_artifacts"].includes(status);
}
