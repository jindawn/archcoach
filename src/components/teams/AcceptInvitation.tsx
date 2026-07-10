"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function AcceptInvitation({ token }: { token: string }) { const router = useRouter(); const [error, setError] = useState<string | null>(null); const accept = async () => { const response = await fetch("/api/team-invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const body = await response.json(); if (!body.success) return setError(body.error); router.push(`/teams/${body.data.teamId}/settings`); router.refresh(); }; return <div><Button onClick={accept}>接受邀请</Button>{error && <p className="mt-3 text-sm text-destructive-foreground">{error}</p>}</div>; }
