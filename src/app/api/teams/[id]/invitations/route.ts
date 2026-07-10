import { z } from "zod";
import { createTeamInvitation, getTeamRole } from "@/db/repositories/teams";
import { requireUser, normalizeEmail } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createInvitationToken, hashInvitationToken, INVITATION_TTL_MS } from "@/lib/team-invitations";

const schema = z.object({ email: z.email(), role: z.enum(["owner", "member"]).default("member") });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await params;
    if (!user || (await getTeamRole(id, user.id)) !== "owner") return fail("仅 owner 可邀请成员", 403);
    const input = schema.parse(await request.json()); const token = createInvitationToken();
    await createTeamInvitation({ teamId: id, invitedBy: user.id, email: normalizeEmail(input.email), role: input.role, tokenHash: hashInvitationToken(token), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) });
    return ok({ token, expiresInDays: 7 }, 201);
  } catch (error) { return handleRouteError(error, "POST /api/teams/[id]/invitations"); }
}
