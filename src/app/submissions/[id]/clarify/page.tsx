"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { REVIEW_ROLES } from "@/core/review/roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Question {
  id: string;
  roleKey: string;
  question: string;
  whyMatters: string;
}

const ROLE_NAME = Object.fromEntries(REVIEW_ROLES.map((role) => [role.key, role.name]));

type Phase = "loading" | "generating" | "answering" | "starting" | "error";

export default function ClarifyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    setPhase("generating");
    const response = await fetch(`/api/submissions/${id}/clarify`, { method: "POST" });
    const body = await response.json();
    if (!body.success) {
      setError(body.error ?? "追问生成失败");
      setPhase("error");
      return;
    }
    setQuestions(body.data.questions);
    setPhase("answering");
  }, [id]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const response = await fetch(`/api/submissions/${id}`);
      const body = await response.json();
      if (!body.success) {
        setError(body.error ?? "加载失败");
        setPhase("error");
        return;
      }
      if (body.data.latestSession) {
        router.replace(`/reviews/${body.data.latestSession.id}`);
        return;
      }
      if (body.data.questions.length > 0) {
        setQuestions(body.data.questions);
        setPhase("answering");
      } else {
        await generate();
      }
    })();
  }, [id, router, generate]);

  const startReview = async () => {
    setPhase("starting");
    setError(null);
    try {
      const filled = Object.entries(answers)
        .filter(([, value]) => value.trim() !== "")
        .map(([questionId, answer]) => ({ questionId, answer }));
      if (filled.length > 0) {
        await fetch(`/api/submissions/${id}/answers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: filled }),
        });
      }
      const response = await fetch(`/api/submissions/${id}/review`, { method: "POST" });
      const body = await response.json();
      if (!body.success) {
        setError(body.error ?? "评审启动失败");
        setPhase("answering");
        return;
      }
      router.push(`/reviews/${body.data.sessionId}`);
    } catch {
      setError("网络错误，请重试");
      setPhase("answering");
    }
  };

  if (phase === "loading" || phase === "generating") {
    return (
      <section className="flex flex-col items-center justify-center py-28 text-center animate-fade-up">
        <p className="font-display text-2xl font-bold">
          {phase === "generating" ? "评委正在阅读你的方案" : "加载中"}
          <span className="thinking-dots ml-1 text-primary">
            <span>·</span>
            <span>·</span>
            <span>·</span>
          </span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          委员会正在找出评审前必须澄清的关键信息缺口，约需 10-30 秒。
        </p>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section className="py-24 text-center">
        <p className="text-destructive-foreground">{error}</p>
        <Button variant="outline" className="mt-6" onClick={generate}>
          重试
        </Button>
      </section>
    );
  }

  const answeredCount = Object.values(answers).filter((value) => value.trim() !== "").length;

  return (
    <section className="mx-auto max-w-3xl animate-fade-up" aria-labelledby="clarify-heading">
      <h1 id="clarify-heading" className="font-display text-2xl font-bold">
        评审前追问
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        评委在正式评审前想确认 {questions.length} 个问题。回答越具体，评审越准；也可以直接跳过。
      </p>

      <ol className="mt-8 space-y-6">
        {questions.map((question, index) => (
          <li
            key={question.id}
            className="rounded-lg border border-border/70 bg-card p-5 animate-fade-up"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-xs text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <p className="text-[13px] text-primary/90">
                  {ROLE_NAME[question.roleKey] ?? question.roleKey} 提问
                </p>
                <p className="mt-1 leading-relaxed">{question.question}</p>
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-foreground">
                    为什么问这个
                  </summary>
                  <p className="mt-1 leading-relaxed">{question.whyMatters}</p>
                </details>
                <Textarea
                  className="mt-3 text-sm"
                  rows={2}
                  placeholder="你的回答（可留空跳过）"
                  value={answers[question.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                  }
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mt-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 mt-8 flex items-center justify-end gap-3 border-t border-border/60 bg-background/85 py-4 backdrop-blur">
        <span className="mr-auto font-mono text-xs text-muted-foreground">
          已回答 {answeredCount}/{questions.length}
        </span>
        <Button variant="outline" onClick={startReview} disabled={phase === "starting"}>
          跳过追问，直接评审
        </Button>
        <Button onClick={startReview} disabled={phase === "starting"}>
          {phase === "starting" ? "正在召集评委…" : "提交回答，开始评审"}
        </Button>
      </div>
    </section>
  );
}
