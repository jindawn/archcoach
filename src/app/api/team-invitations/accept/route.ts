import { z } from "zod";
import { acceptTeamInvitation } from "@/db/repositories/teams";
import { requireUser, normalizeEmail } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { hashInvitationToken } from "@/lib/team-invitations";
const schema = z.object({ token: z.string().min(20).max(200) });
export async function POST(request: Request) { try { const user = await requireUser(); if (!user) return fail("请先登录", 401); const input = schema.parse(await request.json()); const invitation = await acceptTeamInvitation(hashInvitationToken(input.token), user.id, normalizeEmail(user.email)); if (!invitation) return fail("邀请不存在、已过期或邮箱不匹配", 404); return ok({ teamId: invitation.teamId }); } catch (error) { return handleRouteError(error, "POST /api/team-invitations/accept"); } }
