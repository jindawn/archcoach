import { notFound } from "next/navigation";
import { KnowledgePanel } from "@/components/teams/KnowledgePanel";
import { isTeamMember } from "@/db/repositories/teams";
import { requireUser } from "@/lib/auth";

export default async function TeamKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user || !(await isTeamMember(id, user.id))) notFound();
  return <section><h1 className="font-display text-2xl font-bold">团队知识库</h1><p className="mt-2 text-sm text-muted-foreground">评审会自动检索这里的规范与决策，并作为参考上下文提供给评委。</p><KnowledgePanel teamId={id} /></section>;
}
