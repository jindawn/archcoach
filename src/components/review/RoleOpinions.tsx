import { REVIEW_ROLES } from "@/core/review/roles";
import { cn } from "@/lib/utils";
import { SEVERITY_CLASS, SEVERITY_LABEL } from "./status";
import type { ReviewPayload } from "./types";

const ROLE_META = Object.fromEntries(REVIEW_ROLES.map((role) => [role.key, role]));

export function RoleOpinions({ reviews }: { reviews: ReviewPayload["roleReviews"] }) {
  return (
    <div className="space-y-6">
      {reviews.map((review) => {
        const role = ROLE_META[review.roleKey];
        const result = review.result;
        return (
          <section
            key={review.roleKey}
            className="rounded-lg border border-border/70 bg-card p-5"
            aria-label={role?.name}
          >
            <header className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <h3 className="font-display text-base font-bold">{role?.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{role?.title}</p>
              </div>
              {review.status === "completed" && result ? (
                <div className="text-right">
                  <span className="font-mono text-2xl font-bold">{result.score.toFixed(1)}</span>
                  {result.isBlocking && (
                    <p className="text-[11px] text-severity-critical">判定阻塞上线</p>
                  )}
                </div>
              ) : (
                <span className="text-xs text-destructive-foreground">
                  {result?.error ? "评审失败" : "未完成"}
                </span>
              )}
            </header>

            {review.status !== "completed" || !result ? (
              <p className="pt-3 text-sm text-muted-foreground">{result?.error ?? "无结果"}</p>
            ) : (
              <div className="space-y-4 pt-4">
                <p className="text-sm leading-relaxed text-foreground/85">
                  {result.scoreRationale}
                </p>
                {result.isBlocking && result.blockingReason && (
                  <p className="rounded-md border border-severity-critical/40 bg-severity-critical/10 px-3 py-2 text-sm">
                    {result.blockingReason}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {result.concerns.map((concern, index) => (
                    <span
                      key={index}
                      className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {concern}
                    </span>
                  ))}
                </div>

                {result.issues.length > 0 && (
                  <ul className="space-y-3">
                    {result.issues.map((issue, index) => (
                      <li
                        key={index}
                        className={cn("text-sm", !issue.verified && "opacity-60")}
                      >
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <span
                            className={cn(
                              "rounded border px-1.5 py-0.5 text-[11px] font-normal",
                              SEVERITY_CLASS[issue.severity],
                            )}
                          >
                            {SEVERITY_LABEL[issue.severity]}
                          </span>
                          {issue.title}
                          {!issue.verified && (
                            <span className="text-[11px] font-normal text-muted-foreground">
                              引用未能在原文定位，参考价值降低
                            </span>
                          )}
                        </p>
                        <p className="mt-1 leading-relaxed text-foreground/85">{issue.detail}</p>
                        <blockquote className="mt-1.5 border-l-2 border-primary/50 pl-2.5 text-xs text-muted-foreground">
                          引用原文：{issue.evidence}
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                )}

                {result.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">改进建议</p>
                    <ul className="mt-1.5 space-y-1.5 text-sm">
                      {result.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-0.5 font-mono text-[11px] text-primary">
                            {suggestion.priority}
                          </span>
                          <span className="leading-relaxed">{suggestion.suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.followUpQuestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">评委还想追问</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-foreground/80">
                      {result.followUpQuestions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
