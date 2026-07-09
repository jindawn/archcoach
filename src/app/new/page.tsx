"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EXAMPLE_SUBMISSION } from "./example";

interface ScenarioOption {
  slug: string;
  title: string;
  difficulty: string;
  backgroundMd: string;
  constraints: Record<string, string | number>;
}

interface FormState {
  title: string;
  scenarioSlug: string;
  businessContext: string;
  solutionMd: string;
  techStack: string;
  constraints: Record<string, string>;
  diagramSource: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  scenarioSlug: "",
  businessContext: "",
  solutionMd: "",
  techStack: "",
  constraints: { qps: "", dataVolume: "", sla: "", teamSize: "", budget: "" },
  diagramSource: "",
};

const CONSTRAINT_LABELS: Record<string, string> = {
  qps: "峰值 QPS",
  dataVolume: "数据量",
  sla: "SLA 要求",
  teamSize: "团队规模",
  budget: "成本约束",
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NewSubmissionPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: scenariosRes } = useSWR<{ data: ScenarioOption[] }>("/api/scenarios", fetcher);
  const scenarios = scenariosRes?.data ?? [];

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const loadExample = () => {
    setForm({
      ...EMPTY_FORM,
      ...EXAMPLE_SUBMISSION,
      scenarioSlug: "",
      constraints: { ...EMPTY_FORM.constraints, ...EXAMPLE_SUBMISSION.constraints },
    });
    setError(null);
  };

  const pickScenario = (slug: string) => {
    const scenario = scenarios.find((s) => s.slug === slug);
    if (!scenario) {
      set({ scenarioSlug: "" });
      return;
    }
    const constraints = Object.fromEntries(
      Object.entries(scenario.constraints ?? {}).map(([k, v]) => [k, String(v)]),
    );
    setForm((prev) => ({
      ...prev,
      scenarioSlug: slug,
      title: scenario.title,
      businessContext: scenario.backgroundMd,
      constraints: { ...EMPTY_FORM.constraints, ...constraints },
    }));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const constraints = Object.fromEntries(
        Object.entries(form.constraints).filter(([, value]) => value.trim() !== ""),
      );
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          kind: form.scenarioSlug ? "training" : "real",
          scenarioSlug: form.scenarioSlug || undefined,
          businessContext: form.businessContext,
          solutionMd: form.solutionMd,
          techStack: form.techStack || undefined,
          constraints,
          diagramSource: form.diagramSource || undefined,
          diagramType: form.diagramSource ? "mermaid" : undefined,
        }),
      });
      const body = await response.json();
      if (!body.success) {
        setError(body.error ?? "提交失败");
        return;
      }
      router.push(`/submissions/${body.data.id}/clarify`);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl animate-fade-up" aria-labelledby="new-heading">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 id="new-heading" className="font-display text-2xl font-bold">
            提交架构方案
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            材料越具体，评委的意见越有价值。写不出来的部分，评委会追问你。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadExample}>
          载入示例（秒杀系统）
        </Button>
      </div>

      <div className="space-y-7">
        {scenarios.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="scenario">训练题（可选）</Label>
            <select
              id="scenario"
              value={form.scenarioSlug}
              onChange={(e) => pickScenario(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="">不使用训练题 — 评审我自己的方案</option>
              {scenarios.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.title}（{s.difficulty}）
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">方案标题 *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="例如：电商双十一秒杀系统"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="context">业务背景 *</Label>
          <Textarea
            id="context"
            value={form.businessContext}
            onChange={(e) => set({ businessContext: e.target.value })}
            rows={5}
            placeholder="业务是什么、用户是谁、核心链路是什么。请写上关键数字：流量、数据量、增长预期。"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="solution">架构方案（Markdown）*</Label>
          <Textarea
            id="solution"
            value={form.solutionMd}
            onChange={(e) => set({ solutionMd: e.target.value })}
            rows={14}
            className="font-mono text-sm"
            placeholder="整体架构、分层设计、关键决策、异常路径。支持 Markdown。"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tech">技术栈</Label>
          <Input
            id="tech"
            value={form.techStack}
            onChange={(e) => set({ techStack: e.target.value })}
            placeholder="例如：Go + Redis + Kafka + MySQL"
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">约束条件（评委会拿这些数字对照你的方案）</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.keys(CONSTRAINT_LABELS).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`constraint-${key}`} className="text-xs text-muted-foreground">
                  {CONSTRAINT_LABELS[key]}
                </Label>
                <Input
                  id={`constraint-${key}`}
                  value={form.constraints[key] ?? ""}
                  onChange={(e) =>
                    set({ constraints: { ...form.constraints, [key]: e.target.value } })
                  }
                />
              </div>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="diagram">架构图 Mermaid 源码（可选）</Label>
          <Textarea
            id="diagram"
            value={form.diagramSource}
            onChange={(e) => set({ diagramSource: e.target.value })}
            rows={6}
            className="font-mono text-sm"
            placeholder={"flowchart LR\n  user[用户] --> gw[网关]"}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-6">
          <span className="mr-auto text-xs text-muted-foreground">
            下一步：AI 评委生成追问 → 你补充回答 → 开始评审
          </span>
          <Button
            onClick={submit}
            disabled={submitting || !form.title || !form.businessContext || form.solutionMd.length < 50}
          >
            {submitting ? "提交中…" : "提交并生成追问"}
          </Button>
        </div>
      </div>
    </section>
  );
}
