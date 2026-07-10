import { z } from "zod";
import { addTeamMember, isTeamMember } from "@/db/repositories/teams";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
const schema = z.object({ userId: z.uuid() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireUser(); const { id } = await params; if (!user || !(await isTeamMember(id, user.id))) return fail("无团队权限", 403); const input = schema.parse(await request.json()); await addTeamMember(id, input.userId); return ok({ added: true }); } catch (error) { return handleRouteError(error, "POST /api/teams/[id]/members"); } }
