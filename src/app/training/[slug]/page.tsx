"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CAPABILITY_LABELS, type CapabilityKey, type FinalFeedback, type FirstFeedback, type TrainingGuide } from "@/core/schemas/training";

type Answer = { id: string; stepId: string; revision: number; answer: string; hintLevel: number; followUpQuestion: string | null; followUpAnswer: string | null; contentVersion: number; firstFeedback: FirstFeedback | null; finalFeedback: FinalFeedback | null };
type Version = { id:string; version:number; submissionId:string|null; assessmentStatus:string; capabilityScores:unknown };
type Payload = { attempt: { id: string; status: string }; answers: Answer[]; versions: Version[]; scenario: { title: string; backgroundMd: string; constraints: Record<string,string>; trainingGuide: TrainingGuide }; guide: TrainingGuide };
type SaveStatus = "saved" | "unsaved" | "saving" | "failed";

export default function GuidedTrainingPage() {
  const { slug } = useParams<{ slug: string }>(); const router = useRouter(); const search = useSearchParams();
  const retryStep = search.get("retry"); const existingAttempt = search.get("attempt");
  const [data, setData] = useState<Payload | null>(null); const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState(""); const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved"); const [busyAction, setBusyAction] = useState<string | null>(null); const [error, setError] = useState("");
  const [conflict, setConflict] = useState<Answer | null>(null); const timerRef = useRef<number | null>(null); const versionsRef = useRef(new Map<string, number>()); const generationsRef = useRef(new Map<string,number>()); const queueRef = useRef(Promise.resolve());
  const latest = useMemo(() => { const map = new Map<string, Answer>(); for (const item of data?.answers ?? []) if (!map.has(item.stepId) || (map.get(item.stepId)?.revision ?? 0) < item.revision) map.set(item.stepId, item); return map; }, [data]);
  const step = data?.guide.steps[stepIndex]; const saved = step ? latest.get(step.id) : undefined;

  const load = useCallback(async (attemptId: string) => { const body = await fetch(`/api/training/attempts/${attemptId}`).then((r)=>r.json()); if (!body.success) throw new Error(body.error); const loaded = body.data as Payload; setData(loaded); versionsRef.current = new Map(loaded.answers.map((a)=>[a.stepId,a.contentVersion])); return loaded; }, []);
  useEffect(() => { void (async () => { try { let id = existingAttempt; if (!id) { const started = await fetch("/api/training/attempts", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({scenarioSlug:slug}) }).then((r)=>r.json()); if (!started.success) throw new Error(started.error); id=started.data.id; } if (!id) throw new Error("训练记录创建失败"); const loaded=await load(id); const index=retryStep?Math.max(0,loaded.guide.steps.findIndex((s)=>s.id===retryStep)):0; const row=[...loaded.answers].filter((a)=>a.stepId===loaded.guide.steps[index].id).sort((a,b)=>b.revision-a.revision)[0]; setStepIndex(index); setAnswer(row?.answer??""); setFollowUpAnswer(row?.followUpAnswer??""); } catch(e) { setError(e instanceof Error?e.message:"加载失败"); } })(); },[slug,existingAttempt,retryStep,load]);

  const persist = useCallback((stepId:string, answerText:string, followText:string) => {
    if (!data || retryStep) return Promise.resolve(true); setSaveStatus("saving"); const generation=(generationsRef.current.get(stepId)??0)+1; generationsRef.current.set(stepId,generation);
    const operation = async () => { if(generationsRef.current.get(stepId)!==generation)return true; const expectedVersion=versionsRef.current.get(stepId)??0; for(let attempt=0;attempt<3;attempt+=1){try { const response=await fetch(`/api/training/attempts/${data.attempt.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"draft",stepId,answer:answerText,followUpAnswer:followText||undefined,expectedVersion})}); const body=await response.json(); if(response.status===409){if(body.data?.answer===answerText&&(body.data?.followUpAnswer??"")===(followText||"")){versionsRef.current.set(stepId,body.data.contentVersion);setSaveStatus("saved");return true;}setConflict(body.data);setSaveStatus("failed");return false;} if(!body.success)throw new Error(body.error); versionsRef.current.set(stepId,body.data.contentVersion); setSaveStatus("saved"); return true; } catch { if(attempt<2)await new Promise((resolve)=>setTimeout(resolve,500*2**attempt)); }} setSaveStatus("failed"); return false; };
    const result=queueRef.current.then(operation); queueRef.current=result.then(()=>undefined); return result;
  },[data,retryStep]);
  useEffect(()=>{ if(!step||retryStep||(answer===(saved?.answer??"")&&followUpAnswer===(saved?.followUpAnswer??"")))return; if(timerRef.current)window.clearTimeout(timerRef.current); timerRef.current=window.setTimeout(()=>void persist(step.id,answer,followUpAnswer),800); return()=>{if(timerRef.current)window.clearTimeout(timerRef.current);}; },[answer,followUpAnswer,step,saved,retryStep,persist]);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(saveStatus!=="saved"){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[saveStatus]);
  const flush=async()=>{if(!step||retryStep||saveStatus==="saved")return true;if(timerRef.current)window.clearTimeout(timerRef.current);return persist(step.id,answer,followUpAnswer);};
  const reload=async()=>{if(data)await load(data.attempt.id);};
  const action=async(body:object)=>{if(!data)return null;const key="action" in body?String((body as {action:unknown}).action):"action";setBusyAction(key);setError("");try{const response=await fetch(`/api/training/attempts/${data.attempt.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!result.success){setError(result.error);return null;}await reload();return result.data;}finally{setBusyAction(null);}};
  const goTo=async(index:number)=>{if(!await flush())return;const target=data?.guide.steps[index];if(!target)return;const row=latest.get(target.id);setStepIndex(index);setAnswer(row?.answer??"");setFollowUpAnswer(row?.followUpAnswer??"");setSaveStatus("saved");};
  const save=async()=>{if(!step||!await flush())return;const result=await action({action:retryStep?"retry":"save",stepId:step.id,answer,followUpAnswer:followUpAnswer||undefined});if(retryStep&&result)return router.back();};
  const confirmFollowUp=async()=>{if(step)await action({action:"finalFeedback",stepId:step.id,followUpAnswer});};
  const finish=async()=>{if(!data||!await flush())return;setBusyAction("finish");const body=await fetch(`/api/training/attempts/${data.attempt.id}/complete`,{method:"POST"}).then((r)=>r.json());setBusyAction(null);if(!body.success)return setError(body.error);router.push(`/submissions/${body.data.submissionId}/clarify`);};

  if(error&&!data)return <p className="py-24 text-center text-destructive-foreground">{error}</p>; if(!data||!step)return <p className="py-24 text-center text-sm text-muted-foreground">正在准备训练…</p>;
  const completed=data.guide.steps.every((s)=>latest.get(s.id)?.answer.trim());
  return <section className="mx-auto max-w-3xl animate-fade-up">
    <p className="font-mono text-xs text-primary">BEGINNER · 引导训练</p><h1 className="mt-1 font-display text-2xl font-bold">{data.scenario.title}</h1>
    <div className="mt-5 rounded-lg border bg-card p-4 text-sm leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{data.scenario.backgroundMd}</ReactMarkdown><p className="mt-3 text-muted-foreground">{data.guide.intro}</p></div>
    <div className="mt-6 flex gap-2">{data.guide.steps.map((s,i)=><button key={s.id} onClick={()=>void goTo(i)} className={`h-2 flex-1 rounded-full ${i===stepIndex?"bg-primary":latest.get(s.id)?.answer?"bg-primary/50":"bg-border"}`} aria-label={`第${i+1}步`}/>)}</div>
    <div className="mt-7 rounded-xl border bg-card p-5"><p className="text-xs text-primary">第 {stepIndex+1}/{data.guide.steps.length} 步 · {CAPABILITY_LABELS[step.capability as CapabilityKey]}</p><h2 className="mt-1 text-lg font-semibold">{step.title}</h2><p className="mt-3 leading-relaxed">{step.question}</p>
      <Textarea className="mt-4" rows={7} value={answer} onChange={(e)=>{setAnswer(e.target.value);setSaveStatus("unsaved");}} placeholder="用自己的话写下思路和选择理由。"/>
      <p className={`mt-1 text-right text-xs ${saveStatus==="failed"?"text-destructive-foreground":"text-muted-foreground"}`}>{{saved:"已保存",unsaved:"未保存",saving:"保存中…",failed:"保存失败"}[saveStatus]}{saveStatus==="failed"&&!conflict&&<button className="ml-2 text-primary underline" onClick={()=>void flush()}>重试</button>}</p>
      {(saved?.hintLevel??0)>0&&<div className="mt-3 space-y-2">{step.hints.slice(0,saved?.hintLevel??0).map((h,i)=><p key={i} className="rounded bg-secondary px-3 py-2 text-sm"><span className="text-primary">提示 {i+1}：</span>{h}</p>)}</div>}
      <div className="mt-3 flex gap-2"><Button variant="outline" size="sm" disabled={busyAction==="hint"||(saved?.hintLevel??0)>=3} onClick={()=>action({action:"hint",stepId:step.id})}>解锁提示</Button><Button size="sm" disabled={busyAction==="save"||busyAction==="retry"||answer.trim().length<10} onClick={save}>{retryStep?"保存重做版本":"提交本步并请教练反馈"}</Button></div>
      {saved?.firstFeedback?<Feedback feedback={saved.firstFeedback}/>:saved?.answer&&<button className="mt-4 text-sm text-primary underline" onClick={()=>action({action:"retryFeedback",stepId:step.id})}>教练反馈暂不可用，点击重试</button>}
      {saved?.firstFeedback&&!saved.finalFeedback&&<div className="mt-4 border-l-2 border-primary pl-4"><p className="text-sm font-medium">教练追问：{saved.firstFeedback.followUpQuestion}</p><Textarea className="mt-2" rows={3} value={followUpAnswer} onChange={(e)=>{setFollowUpAnswer(e.target.value);setSaveStatus("unsaved");}}/><Button className="mt-2" size="sm" disabled={busyAction==="finalFeedback"||followUpAnswer.trim().length<2} onClick={confirmFollowUp}>请教练确认理解</Button></div>}
      {saved?.finalFeedback&&<div className="mt-4 rounded bg-primary/5 p-3 text-sm"><p>{saved.finalFeedback.resolved?"✓ 已补齐关键理解":"仍需纠偏"}：{saved.finalFeedback.correction}</p><p className="mt-2 text-muted-foreground">可迁移知识：{saved.finalFeedback.takeaway}</p></div>}
    </div>
    {conflict&&<div className="mt-4 rounded border border-destructive/50 p-4 text-sm"><p>这一步已在其他页面更新。请选择保留哪份内容。</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={()=>{versionsRef.current.set(step.id,conflict.contentVersion);setConflict(null);void persist(step.id,answer,followUpAnswer);}}>保留本地内容</Button><Button variant="outline" size="sm" onClick={()=>{setAnswer(conflict.answer);setFollowUpAnswer(conflict.followUpAnswer??"");versionsRef.current.set(step.id,conflict.contentVersion);setConflict(null);setSaveStatus("saved");}}>恢复服务器内容</Button></div></div>}
    {error&&<p className="mt-4 text-sm text-destructive-foreground">{error}</p>}
    {!retryStep&&<div className="mt-6 flex justify-between"><Button variant="outline" disabled={stepIndex===0} onClick={()=>void goTo(stepIndex-1)}>上一步</Button>{stepIndex<data.guide.steps.length-1?<Button variant="outline" onClick={()=>void goTo(stepIndex+1)}>下一步</Button>:<Button disabled={!completed||busyAction==="finish"} onClick={finish}>完成并进入架构评审</Button>}</div>}
  </section>;
}

function Feedback({feedback}:{feedback:FirstFeedback}){return <div className="mt-4 rounded-lg border p-3 text-sm"><p className="font-medium">教练反馈</p>{feedback.strengths.length>0&&<div className="mt-2 text-grade-a">做得好：{feedback.strengths.map((item,i)=><p key={i}>{item.point}（依据：“{item.evidence}”）</p>)}</div>}{feedback.gaps.length>0&&<div className="mt-1 text-muted-foreground">还可补充：{feedback.gaps.map((item,i)=><p key={i}>{item.point}</p>)}</div>}</div>}
