"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Match { title: string; content: string; score: number }

export function KnowledgePanel({ teamId }: { teamId: string }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const upload = async () => {
    setMessage(null);
    const response = await fetch(`/api/teams/${teamId}/knowledge`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    const body = await response.json();
    if (!body.success) return setMessage(body.error ?? "上传失败");
    setTitle(""); setContent(""); setMessage("知识文档已入库");
  };
  const search = async () => {
    const response = await fetch(`/api/teams/${teamId}/knowledge?q=${encodeURIComponent(query)}`);
    const body = await response.json();
    setMatches(body.success ? body.data : []);
  };
  return <div className="mt-6 grid gap-6 lg:grid-cols-2">
    <section className="space-y-3 rounded-lg border p-4"><h2 className="font-medium">录入团队知识</h2><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="文档标题" /><Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={10} placeholder="粘贴架构规范、技术决策、合规要求等 Markdown 文本" /><Button onClick={upload} disabled={title.length < 2 || content.length < 20}>上传并分段</Button>{message && <p className="text-sm text-muted-foreground">{message}</p>}</section>
    <section className="space-y-3 rounded-lg border p-4"><h2 className="font-medium">检索验证</h2><div className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：支付回调幂等" /><Button variant="outline" onClick={search}>检索</Button></div>{matches.map((match, index) => <article key={`${match.title}-${index}`} className="border-t pt-3"><p className="font-medium">{match.title}</p><p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">{match.content}</p></article>)}</section>
  </div>;
}
