import { logger } from "@/lib/logger";

interface EmailConfig { apiKey: string; from: string }
export function loadInvitationEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim(); const from = env.INVITATION_EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

export async function sendInvitationEmail(input: {
  to: string; inviteUrl: string; invitationId: string;
}, env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): Promise<boolean> {
  const config = loadInvitationEmailConfig(env);
  if (!config) return false;
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `archcoach-team-invite-${input.invitationId}`,
        "User-Agent": "ArchCoach/1.0",
      },
      body: JSON.stringify({
        from: config.from, to: [input.to], subject: "邀请你加入 ArchCoach 团队评审室",
        text: `你收到了 ArchCoach 团队评审室邀请。请在七天内打开以下链接并使用此邮箱登录：\n\n${input.inviteUrl}\n`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
    return true;
  } catch (error) {
    logger.warn({ err: error, invitationId: input.invitationId }, "invitation email failed; link remains available");
    return false;
  }
}
