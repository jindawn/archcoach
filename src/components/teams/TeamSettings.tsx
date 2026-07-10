"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member { userId: string; email: string; role: "owner" | "member" }
export function TeamSettings({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
  const [members, setMembers] = useState<Member[]>([]); const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = () => void fetch(`/api/teams/${teamId}/members`).then((r) => r.json()).then((body) => setMembers(body.data ?? []));
  useEffect(load, [teamId]);
  const invite = async () => { setError(null); const response = await fetch(`/api/teams/${teamId}/invitations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: "member" }) }); const body = await response.json(); if (!body.success) return setError(body.error); setInviteUrl(`${location.origin}/team-invitations/accept?token=${body.data.token}`); setEmail(""); };
  const setRole = async (member: Member, role: Member["role"]) => { await fetch(`/api/teams/${teamId}/members`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: member.userId, role }) }); load(); };
  return <div className="mt-6 space-y-6"><section className="rounded-lg border p-4"><h2 className="font-medium">成员</h2><div className="mt-3 divide-y">{members.map((member) => <div key={member.userId} className="flex items-center gap-3 py-3"><span className="flex-1 text-sm">{member.email}</span><span className="text-xs text-muted-foreground">{member.role}</span>{isOwner && <Button variant="outline" size="sm" onClick={() => setRole(member, member.role === "owner" ? "member" : "owner")}>设为 {member.role === "owner" ? "member" : "owner"}</Button>}</div>)}</div></section>{isOwner && <section className="rounded-lg border p-4"><h2 className="font-medium">邀请成员</h2><div className="mt-3 flex gap-2"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" /><Button onClick={invite} disabled={!email}>生成邀请</Button></div>{inviteUrl && <Input className="mt-3" readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />}{error && <p className="mt-2 text-sm text-destructive-foreground">{error}</p>}</section>}</div>;
}
