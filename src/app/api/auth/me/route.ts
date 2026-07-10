import { authenticationEnabled, getCurrentUser } from "@/lib/auth";
import { ok } from "@/lib/api";
import { githubOAuthEnabled } from "@/lib/github-oauth";

export async function GET() {
  const user = await getCurrentUser();
  return ok({ enabled: authenticationEnabled(), githubOAuthEnabled: githubOAuthEnabled(), user: user ? { id: user.id, email: user.email } : null });
}
