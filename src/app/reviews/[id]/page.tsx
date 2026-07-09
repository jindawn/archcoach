"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { REVIEW_ROLES } from "@/core/review/roles";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArtifactsPanel } from "@/components/review/ArtifactsPanel";
import { ReportOverview } from "@/components/review/ReportOverview";
import { RoleCard } from "@/components/review/RoleCard";
import { RoleOpinions } from "@/components/review/RoleOpinions";
import { SESSION_STATUS_LABEL, isSessionRunning } from "@/components/review/status";
import type { ReviewPayload } from "@/components/review/types";

const ROLE_ORDER: string[] = REVIEW_ROLES.map((role) => role.key);
const ROLE_NAME = Object.fromEntries(REVIEW_ROLES.map((role) => [role.key, role.name]));

const fetcher = (url: string) =>
  fetch(url).then((res) => res.json()) as Promise<{ success: boolean; data: ReviewPayload }>;

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [retrying, setRetrying] = useState(false);
  const { data: body, mutate } = useSWR(`/api/reviews/${id}`, fetcher, {
    refreshInterval: (latest) =>
      latest?.data && !isSessionRunning(latest.data.session.status) ? 0 : 2_500,
  });

  if (!body) {
    return <p className="py-24 text-center text-sm text-muted-foreground">加载中…</p>;
  }
  if (!body.success || !body.data) {
    return <p className="py-24 text-center text-sm text-destructive-foreground">评审会话不存在</p>;
  }

  const data = body.data;
  const { session, submission } = data;
  const running = isSessionRunning(session.status);
  const orderedReviews = [...data.roleReviews].sort(
    (a, b) => ROLE_ORDER.indexOf(a.roleKey) - ROLE_ORDER.indexOf(b.roleKey),
  );

  const retry = async () => {
    if (!submission) return;
    setRetrying(true);
    try {
      await fetch(`/api/submissions/${submission.id}/review`, { method: "POST" });
      await mutate();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <section aria-labelledby="review-heading">
      <header className="mb-8">
        <p className="font-mono text-xs text-muted-foreground">
          {submission?.kind === "training" ? "训练题评审" : "架构方案评审"}
        </p>
        <h1 id="review-heading" className="font-display mt-1 text-2xl font-bold">
          {submission?.title ?? "评审"}
        </h1>
        {running && (
          <p className="mt-2 text-sm text-primary" role="status">
            {SESSION_STATUS_LABEL[session.status]}
            <span className="thinking-dots ml-0.5">
              <span>·</span>
              <span>·</span>
              <span>·</span>
            </span>
          </p>
        )}
      </header>

      {session.status === "failed" && (
        <div className="mb-8 rounded-lg border border-destructive/50 bg-destructive/10 p-5">
          <p className="text-sm leading-relaxed">{session.error ?? "评审失败"}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={retry} disabled={retrying}>
            {retrying ? "重新召集评委…" : "从断点继续评审"}
          </Button>
        </div>
      )}

      {running || session.status === "failed" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orderedReviews.map((review, index) => (
            <RoleCard
              key={review.roleKey}
              roleKey={review.roleKey}
              status={review.status}
              score={review.score}
              isBlocking={review.isBlocking}
              index={index}
            />
          ))}
        </div>
      ) : (
        <>
          <Tabs defaultValue="overview">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">总览</TabsTrigger>
              <TabsTrigger value="opinions">评委意见</TabsTrigger>
              <TabsTrigger value="artifacts">评审产物</TabsTrigger>
              <TabsTrigger value="questions">追问记录</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <ReportOverview data={data} />
            </TabsContent>
            <TabsContent value="opinions">
              <RoleOpinions reviews={orderedReviews} />
            </TabsContent>
            <TabsContent value="artifacts">
              <ArtifactsPanel artifacts={data.artifacts} submissionTitle={submission?.title ?? "评审"} />
            </TabsContent>
            <TabsContent value="questions">
              <QuestionsLog questions={data.questions} />
            </TabsContent>
          </Tabs>

          <footer className="mt-10 border-t border-border/60 pt-4 text-center font-mono text-xs text-muted-foreground">
            本次评审：{data.usage.calls} 次模型调用 · 输入 {data.usage.promptTokens.toLocaleString()}{" "}
            / 输出 {data.usage.completionTokens.toLocaleString()} tokens
            {data.usage.costUsd > 0 && <> · 估算成本 ${data.usage.costUsd.toFixed(4)}</>}
            {session.startedAt && session.completedAt && (
              <>
                {" "}
                · 耗时{" "}
                {Math.round(
                  (new Date(session.completedAt).getTime() -
                    new Date(session.startedAt).getTime()) /
                    1000,
                )}
                s
              </>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

function QuestionsLog({ questions }: { questions: ReviewPayload["questions"] }) {
  if (questions.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">本次评审没有追问记录。</p>;
  }
  return (
    <ol className="space-y-4">
      {questions.map((question, index) => (
        <li key={question.id} className="rounded-lg border border-border/70 bg-card p-4 text-sm">
          <p className="text-xs text-primary/90">
            {String(index + 1).padStart(2, "0")} · {ROLE_NAME[question.roleKey] ?? question.roleKey}
          </p>
          <p className="mt-1.5 leading-relaxed">{question.question}</p>
          <p className="mt-2 border-l-2 border-border pl-3 text-muted-foreground">
            {question.answer?.trim() ? question.answer : "（未回答）"}
          </p>
        </li>
      ))}
    </ol>
  );
}
