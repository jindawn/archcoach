import Link from "next/link";
import { listSubmissions } from "@/db/repositories/submissions";
import { GradeStamp } from "@/components/review/GradeStamp";
import { SESSION_STATUS_LABEL, isSessionRunning } from "@/components/review/status";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function submissionHref(item: Awaited<ReturnType<typeof listSubmissions>>[number]): string {
  if (item.latestSession) return `/reviews/${item.latestSession.id}`;
  return `/submissions/${item.id}/clarify`;
}

export default async function HomePage() {
  const user = await requireUser();
  if (!user && process.env.LOCAL_MODE === "false") redirect("/login");
  const items = await listSubmissions(50, user?.id);

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center py-24 text-center animate-fade-up">
        <p className="font-display text-3xl font-bold">评审桌还空着</p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          提交一份架构方案，6 位 AI 评委将对它进行追问、评审、打分，
          并产出评审报告、架构图、ADR 与面试讲解稿。
        </p>
        <Link
          href="/new"
          className="mt-8 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          发起第一次评审
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="list-heading">
      <div className="mb-6 flex items-end justify-between">
        <h1 id="list-heading" className="font-display text-2xl font-bold">
          评审记录
        </h1>
        <span className="font-mono text-xs text-muted-foreground">{items.length} 份卷宗</span>
      </div>
      <ul className="divide-y divide-border/60 border-y border-border/60">
        {items.map((item, index) => {
          const session = item.latestSession;
          return (
            <li
              key={item.id}
              className="animate-fade-up"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Link
                href={submissionHref(item)}
                className="group flex items-center gap-4 px-2 py-4 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium transition-colors group-hover:text-primary">
                    {item.title}
                  </p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{item.kind === "training" ? "训练题" : "真实方案"}</span>
                    <span className="font-mono">
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                    {session && (
                      <span className={isSessionRunning(session.status) ? "text-primary" : ""}>
                        {SESSION_STATUS_LABEL[session.status] ?? session.status}
                      </span>
                    )}
                  </p>
                </div>
                {session?.grade ? (
                  <GradeStamp grade={session.grade} />
                ) : (
                  <span className="text-xs text-muted-foreground">{session ? "…" : "待评审"}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
