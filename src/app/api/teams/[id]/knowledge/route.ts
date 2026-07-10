import { z } from "zod";
import { addKnowledgeDocument, searchKnowledge, splitKnowledgeDocument } from "@/db/repositories/knowledge";
import { isTeamMember } from "@/db/repositories/teams";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { embedTexts } from "@/lib/embeddings";
const schema = z.object({ title: z.string().min(2).max(200), content: z.string().min(20).max(200000) });
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const { id } = await params; if (!user || !(await isTeamMember(id, user.id))) return fail("无团队权限", 403); const query = new URL(request.url).searchParams.get("q") ?? ""; const embedding = query.trim() ? (await embedTexts([query]))?.[0] : undefined; return ok(await searchKnowledge(id, query, embedding)); } catch (error) { return handleRouteError(error, "GET knowledge"); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const { id } = await params; if (!user || !(await isTeamMember(id, user.id))) return fail("无团队权限", 403); const input = schema.parse(await request.json()); const embeddings = await embedTexts(splitKnowledgeDocument(input.content)); return ok(await addKnowledgeDocument(id, input.title, input.content, embeddings), 201); } catch (error) { return handleRouteError(error, "POST knowledge"); } }
