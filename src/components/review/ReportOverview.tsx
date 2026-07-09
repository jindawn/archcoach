import { REVIEW_ROLES } from "@/core/review/roles";
import { cn } from "@/lib/utils";
import { GradeStamp } from "./GradeStamp";
import { SEVERITY_CLASS, SEVERITY_LABEL } from "./status";
import type { ReviewPayload } from "./types";

const ROLE_NAME = Object.fromEntries(REVIEW_ROLES.map((role) => [role.key, role.name]));

export function ReportOverview({ data }: { data: ReviewPayload }) {
  const { session, roleReviews } = data;
  const summary = session.summary;
  if (!summary) return null;

  return (
    <div className="space-y-8">
      {summary.blocked && (
        <p
          role="alert"
          className="rounded-lg border border-severity-critical/50 bg-severity-critical/10 px-5 py-4 text-sm leading-relaxed"
        >
          <span className="font-display font-bold text-severity-critical">存在上线阻塞项。</span>{" "}
          评委认为方案在当前状态下上线会造成资损、数据错误或严重不可用
          {summary.capApplied === "blocking" && "，总分已按仲裁规则封顶（最高 C 级）"}。
        </p>
      )}

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
          <GradeStamp grade={session.grade ?? "D"} score={session.overallScore} size="lg" animate />
          <span className="font-mono text-[11px] text-muted-foreground">综合评级</span>
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold">委员会总评</h2>
          <p className="mt-2 leading-relaxed text-foreground/90">{summary.overallAssessment}</p>
        </div>
      </div>

      <div>
        <h3 className="font-display text-base font-bold">评委打分</h3>
        <ul className="mt-3 space-y-2.5">
          {roleReviews.map((review) => (
            <li key={review.roleKey} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">
                {ROLE_NAME[review.roleKey] ?? review.roleKey}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    "block h-full rounded-full transition-all",
                    (review.score ?? 0) >= 7
                      ? "bg-grade-a"
                      : (review.score ?? 0) >= 5
                        ? "bg-grade-c"
                        : "bg-grade-d",
                  )}
                  style={{ width: `${((review.score ?? 0) / 10) * 100}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right font-mono">
                {review.score != null ? review.score.toFixed(1) : "—"}
              </span>
              {review.isBlocking && (
                <span className="shrink-0 text-[11px] text-severity-critical">阻塞</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {summary.conflicts.length > 0 && (
        <div>
          <h3 className="font-display text-base font-bold">评委分歧（保留双方立场）</h3>
          <ul className="mt-3 space-y-3">
            {summary.conflicts.map((conflict, index) => (
              <li key={index} className="rounded-lg border border-border/70 bg-card p-4 text-sm">
                <p className="font-medium">{conflict.topic}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="rounded bg-muted/60 p-2.5 leading-relaxed">
                    <span className="text-primary">{ROLE_NAME[conflict.positionA.roleKey]}：</span>
                    {conflict.positionA.position}
                  </p>
                  <p className="rounded bg-muted/60 p-2.5 leading-relaxed">
                    <span className="text-primary">{ROLE_NAME[conflict.positionB.roleKey]}：</span>
                    {conflict.positionB.position}
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{conflict.guidance}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="font-display text-base font-bold">改进行动清单</h3>
        <ul className="mt-3 space-y-2">
          {summary.prioritizedActions.map((action, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px]",
                  action.priority === "P0"
                    ? SEVERITY_CLASS.critical
                    : action.priority === "P1"
                      ? SEVERITY_CLASS.high
                      : SEVERITY_CLASS.low,
                )}
              >
                {action.priority}
              </span>
              <div>
                <p className="leading-relaxed">{action.action}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {action.rationale} ·{" "}
                  {action.sourceRoles.map((role) => ROLE_NAME[role] ?? role).join("、")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {summary.topRisks.length > 0 && (
        <div>
          <h3 className="font-display text-base font-bold">Top 风险</h3>
          <ul className="mt-3 space-y-2">
            {summary.topRisks.map((risk, index) => (
              <li key={index} className="flex items-start gap-3 text-sm">
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[11px]",
                    SEVERITY_CLASS[risk.severity],
                  )}
                >
                  {SEVERITY_LABEL[risk.severity]}
                </span>
                <div>
                  <p className="leading-relaxed">{risk.risk}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    缓解：{risk.mitigation} · 提出人：{ROLE_NAME[risk.sourceRole]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.missingInfo.length > 0 && (
        <div className="rounded-lg border border-border/70 bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">评审中反复出现的信息缺口</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/85">
            {summary.missingInfo.map((info, index) => (
              <li key={index}>{info}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
