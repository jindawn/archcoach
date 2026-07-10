import Link from "next/link";
import { listTeamsForUser } from "@/db/repositories/teams";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TeamsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const teams = await listTeamsForUser(user.id);
  return <section><h1 className="font-display text-2xl font-bold">团队评审室</h1><p className="mt-2 text-sm text-muted-foreground">团队成员可共同查看和推进团队归属的架构评审。</p><div className="mt-6 space-y-3">{teams.length ? teams.map((team) => <div key={team.id} className="rounded-lg border p-4"><p className="font-medium">{team.name}</p><p className="text-xs text-muted-foreground">{team.slug}</p></div>) : <p className="text-sm text-muted-foreground">尚未加入团队。可通过 API 创建团队：POST /api/teams。</p>}</div><Link href="/new" className="mt-6 inline-block text-sm text-primary hover:underline">创建团队评审 →</Link></section>;
}
