import { z } from "zod";
import { getTeamRole, listTeamMembers, removeTeamMember, updateTeamMemberRole } from "@/db/repositories/teams";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

const memberSchema = z.object({ userId: z.uuid(), role: z.enum(["owner", "member"]).optional() });
async function requireOwner(teamId: string) {
  const user = await requireUser();
  return user && (await getTeamRole(teamId, user.id)) === "owner" ? user : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const user = await requireUser(); if (!user || !(await getTeamRole(id, user.id))) return fail("无团队权限", 403); return ok(await listTeamMembers(id)); }
  catch (error) { return handleRouteError(error, "GET /api/teams/[id]/members"); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; if (!(await requireOwner(id))) return fail("仅 owner 可管理成员", 403); const input = memberSchema.parse(await request.json()); if (!input.role) return fail("缺少 role", 422); await updateTeamMemberRole(id, input.userId, input.role); return ok({ updated: true }); }
  catch (error) { return handleRouteError(error, "PATCH /api/teams/[id]/members"); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; if (!(await requireOwner(id))) return fail("仅 owner 可管理成员", 403); const input = memberSchema.parse(await request.json()); await removeTeamMember(id, input.userId); return ok({ removed: true }); }
  catch (error) { return handleRouteError(error, "DELETE /api/teams/[id]/members"); }
}
