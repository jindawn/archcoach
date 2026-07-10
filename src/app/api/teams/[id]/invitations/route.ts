import { z } from "zod";
import { createTeamInvitation, getTeamRole } from "@/db/repositories/teams";
import { requireUser, normalizeEmail } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createInvitationToken, hashInvitationToken, INVITATION_TTL_MS } from "@/lib/team-invitations";
import { sendInvitationEmail } from "@/lib/invitation-email";

const schema = z.object({ email: z.email(), role: z.enum(["owner", "member"]).default("member") });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await params;
    if (!user || (await getTeamRole(id, user.id)) !== "owner") return fail("仅 owner 可邀请成员", 403);
    const input = schema.parse(await request.json()); const token = createInvitationToken(); const email = normalizeEmail(input.email);
    const invitation = await createTeamInvitation({ teamId: id, invitedBy: user.id, email, role: input.role, tokenHash: hashInvitationToken(token), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) });
    const origin = process.env.APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
    const inviteUrl = `${origin}/team-invitations/accept?token=${encodeURIComponent(token)}`;
    const emailSent = await sendInvitationEmail({ to: email, inviteUrl, invitationId: invitation.id });
    return ok({ token, inviteUrl, emailSent, expiresInDays: 7 }, 201);
  } catch (error) { return handleRouteError(error, "POST /api/teams/[id]/invitations"); }
}
