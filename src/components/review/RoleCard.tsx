import { REVIEW_ROLES } from "@/core/review/roles";
import { cn } from "@/lib/utils";

const ROLE_META = Object.fromEntries(REVIEW_ROLES.map((role) => [role.key, role]));

interface RoleCardProps {
  roleKey: string;
  status: string; // pending | running | completed | failed
  score: number | null;
  isBlocking: boolean | null;
  index: number;
}

/** 评审进行页的评委卡片：暗色中逐个点亮，是产品的招牌时刻 */
export function RoleCard({ roleKey, status, score, isBlocking, index }: RoleCardProps) {
  const role = ROLE_META[roleKey];
  const lit = status === "completed";

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border/70 bg-card p-5 transition-all duration-500 animate-fade-up",
        status === "running" && "role-card-running",
        lit && "role-card-lit",
        status === "pending" && "opacity-55",
        status === "failed" && "border-destructive/50",
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <p className="font-display text-base font-bold">{role?.name ?? roleKey}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{role?.title}</p>

      <div className="mt-5 flex h-10 items-end justify-between">
        {status === "pending" && <span className="text-xs text-muted-foreground">等待入场</span>}
        {status === "running" && (
          <span className="text-xs text-primary">
            审阅中
            <span className="thinking-dots ml-0.5">
              <span>·</span>
              <span>·</span>
              <span>·</span>
            </span>
          </span>
        )}
        {status === "failed" && (
          <span className="text-xs text-destructive-foreground">评审失败</span>
        )}
        {lit && (
          <>
            <span
              className={cn(
                "animate-stamp font-mono text-3xl font-bold leading-none",
                (score ?? 0) >= 7
                  ? "text-grade-a"
                  : (score ?? 0) >= 5
                    ? "text-grade-c"
                    : "text-grade-d",
              )}
            >
              {score?.toFixed(1)}
            </span>
            {isBlocking && (
              <span className="rounded border border-severity-critical/60 bg-severity-critical/15 px-1.5 py-0.5 font-display text-[11px] text-severity-critical -rotate-3">
                阻塞上线
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
