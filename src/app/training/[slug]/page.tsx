"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CAPABILITY_LABELS, type CapabilityKey, type TrainingGuide } from "@/core/schemas/training";

type Answer = { id: string; stepId: string; revision: number; answer: string; hintLevel: number; followUpQuestion: string | null; followUpAnswer: string | null };
type Payload = { attempt: { id: string; status: string; submissionId: string | null }; answers: Answer[]; scenario: { title: string; backgroundMd: string; constraints: Record<string,string>; trainingGuide: TrainingGuide }; guide: TrainingGuide };

export default function GuidedTrainingPage() {
  const { slug } = useParams<{ slug: string }>(); const router = useRouter();
  const search = useSearchParams(); const retryStep = search.get("retry"); const existingAttempt = search.get("attempt");
  const [data, setData] = useState<Payload | null>(null); const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState(""); const [followUpAnswer, setFollowUpAnswer] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const latest = useMemo(() => { const map = new Map<string, Answer>(); for (const item of data?.answers ?? []) if (!map.has(item.stepId) || (map.get(item.stepId)?.revision ?? 0) < item.revision) map.set(item.stepId, item); return map; }, [data]);
  const step = data?.guide.steps[stepIndex]; const saved = step ? latest.get(step.id) : undefined;

  useEffect(() => { void (async () => { let id = existingAttempt; if (!id) { const started = await fetch("/api/training/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioSlug: slug }) }).then((r)=>r.json()); if (!started.success) { setError(started.error); return; } id = started.data.id; } const loaded = await fetch(`/api/training/attempts/${id}`).then((r)=>r.json()); if (loaded.success) { const loadedData = loaded.data as Payload; const index = retryStep ? Math.max(0, loadedData.guide.steps.findIndex((s)=>s.id===retryStep)) : 0; const rows = loadedData.answers.filter((a)=>a.stepId===loadedData.guide.steps[index].id).sort((a,b)=>b.revision-a.revision); setData(loadedData); setStepIndex(index); setAnswer(rows[0]?.answer ?? ""); setFollowUpAnswer(rows[0]?.followUpAnswer ?? ""); } else setError(loaded.error); })(); }, [slug, existingAttempt, retryStep]);
  useEffect(() => {
    if (!data || !step || retryStep || (answer === (saved?.answer ?? "") && followUpAnswer === (saved?.followUpAnswer ?? ""))) return;
    const timer = window.setTimeout(() => { void fetch(`/api/training/attempts/${data.attempt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draft", stepId: step.id, answer, followUpAnswer: followUpAnswer || undefined }) }); }, 800);
    return () => window.clearTimeout(timer);
  }, [answer, followUpAnswer, data, step, saved, retryStep]);

  const reload = async () => { if (!data) return; const body = await fetch(`/api/training/attempts/${data.attempt.id}`).then((r)=>r.json()); if (body.success) setData(body.data); };
  const call = async (body: object) => { if (!data) return null; setBusy(true); setError(""); try { const result = await fetch(`/api/training/attempts/${data.attempt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r)=>r.json()); if (!result.success) { setError(result.error); return null; } await reload(); return result.data; } finally { setBusy(false); } };
  const goTo = (index: number) => { const target = data?.guide.steps[index]; if (!target) return; const existing = latest.get(target.id); setStepIndex(index); setAnswer(existing?.answer ?? ""); setFollowUpAnswer(existing?.followUpAnswer ?? ""); };
  const save = async () => { if (!step) return; const row = await call({ action: retryStep ? "retry" : "save", stepId: step.id, answer, followUpAnswer: followUpAnswer || undefined }); if (retryStep && row) return router.back(); if (row && stepIndex < (data?.guide.steps.length ?? 1) - 1 && !row.followUpQuestion) goTo(stepIndex+1); };
  const finish = async () => { if (!data) return; setBusy(true); const body = await fetch(`/api/training/attempts/${data.attempt.id}/complete`, { method: "POST" }).then((r)=>r.json()); setBusy(false); if (!body.success) return setError(body.error); router.push(`/submissions/${body.data.submissionId}/clarify`); };

  if (error && !data) return <p className="py-24 text-center text-destructive-foreground">{error}</p>;
  if (!data || !step) return <p className="py-24 text-center text-sm text-muted-foreground">正在准备训练…</p>;
  const completed = data.guide.steps.every((s) => latest.get(s.id)?.answer.trim());
  return <section className="mx-auto max-w-3xl animate-fade-up">
    <p className="font-mono text-xs text-primary">BEGINNER · 引导训练</p><h1 className="mt-1 font-display text-2xl font-bold">{data.scenario.title}</h1>
    <div className="mt-5 rounded-lg border bg-card p-4 text-sm leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{data.scenario.backgroundMd}</ReactMarkdown><p className="mt-3 text-muted-foreground">{data.guide.intro}</p></div>
    <div className="mt-6 flex gap-2" aria-label="训练进度">{data.guide.steps.map((s,i)=><button key={s.id} onClick={()=>goTo(i)} className={`h-2 flex-1 rounded-full ${i===stepIndex ? "bg-primary" : latest.get(s.id)?.answer ? "bg-primary/50" : "bg-border"}`} aria-label={`第${i+1}步`} />)}</div>
    <div className="mt-7 rounded-xl border border-border/70 bg-card p-5">
      <p className="text-xs text-primary">第 {stepIndex+1}/{data.guide.steps.length} 步 · {CAPABILITY_LABELS[step.capability as CapabilityKey]}</p><h2 className="mt-1 text-lg font-semibold">{step.title}</h2><p className="mt-3 leading-relaxed">{step.question}</p>
      <Textarea className="mt-4" rows={7} value={answer} onChange={(e)=>setAnswer(e.target.value)} placeholder="用自己的话写下思路和选择理由，不要求术语完整。" />
      {(saved?.hintLevel ?? 0) > 0 && <div className="mt-4 space-y-2">{step.hints.slice(0,saved?.hintLevel ?? 0).map((h,i)=><p key={i} className="rounded-md bg-secondary px-3 py-2 text-sm"><span className="text-primary">提示 {i+1}：</span>{h}</p>)}</div>}
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy || (saved?.hintLevel ?? 0)>=3} onClick={()=>call({action:"hint",stepId:step.id})}>解锁下一级提示</Button><Button size="sm" disabled={busy || answer.trim().length<10} onClick={save}>{busy ? "保存中…" : retryStep ? "保存重做并更新成绩" : "保存本步"}</Button></div>
      {saved?.followUpQuestion && <div className="mt-5 border-l-2 border-primary pl-4"><p className="text-sm font-medium">教练追问：{saved.followUpQuestion}</p><Textarea className="mt-2" rows={3} value={followUpAnswer} onChange={(e)=>setFollowUpAnswer(e.target.value)} placeholder="可选；补充后再次保存本步" /></div>}
    </div>
    {error && <p className="mt-4 text-sm text-destructive-foreground">{error}</p>}
    {!retryStep && <div className="mt-6 flex justify-between"><Button variant="outline" disabled={stepIndex===0} onClick={()=>goTo(stepIndex-1)}>上一步</Button>{stepIndex < data.guide.steps.length-1 ? <Button variant="outline" onClick={()=>goTo(stepIndex+1)}>下一步</Button> : <Button disabled={!completed || busy} onClick={finish}>完成并进入架构评审</Button>}</div>}
  </section>;
}
