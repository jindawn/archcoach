import { describe, expect, test, vi } from "vitest";
import { loadInvitationEmailConfig, sendInvitationEmail } from "./invitation-email";
describe("invitation email", () => {
  test("is optional when provider settings are absent", () => { expect(loadInvitationEmailConfig({})).toBeNull(); });
  test("sends through the documented Resend HTTP API", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    await expect(sendInvitationEmail({ to: "member@example.com", inviteUrl: "https://app/invite", invitationId: "invite-1" }, { RESEND_API_KEY: "re_test", INVITATION_EMAIL_FROM: "ArchCoach <team@example.com>" }, fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer re_test", "Idempotency-Key": "archcoach-team-invite-invite-1" }) }));
  });
});
