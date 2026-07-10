"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState(false);
  useEffect(() => {
    void fetch("/api/auth/me").then((response) => response.json()).then((body) => setGithubEnabled(Boolean(body.data?.githubOAuthEnabled)));
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!body.success) { setError(body.error ?? "认证失败"); return; }
      router.replace("/"); router.refresh();
    } catch { setError("网络错误，请重试"); } finally { setPending(false); }
  };
  return (
    <section className="mx-auto max-w-sm py-16">
      <h1 className="font-display text-2xl font-bold">{mode === "login" ? "登录 ArchCoach" : "创建账号"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{mode === "login" ? "登录后查看和管理自己的评审记录。" : "密码至少 12 位。"}</p>
      <form className="mt-8 space-y-5" onSubmit={submit}>
        <div className="space-y-2"><Label htmlFor="email">邮箱</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="password">密码</Label><Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "register" ? 12 : 1} required /></div>
        {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
        <Button className="w-full" disabled={pending}>{pending ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}</Button>
      </form>
      {githubEnabled && (
        <a href="/api/auth/github" className="mt-4 block rounded-md border border-border py-2 text-center text-sm font-medium hover:bg-accent">
          使用 GitHub 登录
        </a>
      )}
      <button className="mt-5 text-sm text-primary hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
        {mode === "login" ? "没有账号？创建一个" : "已有账号？登录"}
      </button>
    </section>
  );
}
