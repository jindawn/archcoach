import { notFound } from "next/navigation";
import { TeamSettings } from "@/components/teams/TeamSettings";
import { getTeamRole } from "@/db/repositories/teams";
import { requireUser } from "@/lib/auth";
export default async function TeamSettingsPage({ params }: { params: Promise<{ id: string }> }) { const user = await requireUser(); const { id } = await params; const role = user ? await getTeamRole(id, user.id) : null; if (!role) notFound(); return <section><h1 className="font-display text-2xl font-bold">团队设置</h1><p className="mt-2 text-sm text-muted-foreground">管理成员、角色与邀请。</p><TeamSettings teamId={id} isOwner={role === "owner"} /></section>; }
