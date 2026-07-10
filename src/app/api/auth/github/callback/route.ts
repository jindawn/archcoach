import { NextRequest, NextResponse } from "next/server";
import { createAuthSession, createUser, getUserByEmail, getUserByOAuthAccount, linkOAuthAccount } from "@/db/repositories/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, authenticationEnabled, createSessionToken, hashSessionToken, normalizeEmail } from "@/lib/auth";
import { getGitHubIdentity, githubOAuthEnabled, statesMatch } from "@/lib/github-oauth";

const STATE_COOKIE = "archcoach_github_oauth_state";
const loginUrl = (request: Request, error?: string) => {
  const url = new URL("/login", request.url);
  if (error) url.searchParams.set("error", error);
  return url;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!authenticationEnabled() || !githubOAuthEnabled() || !state || !code || !expected || !statesMatch(state, expected)) {
    return NextResponse.redirect(loginUrl(request, "github_oauth_failed"));
  }
  try {
    const redirectUri = new URL("/api/auth/github/callback", request.url).toString();
    const identity = await getGitHubIdentity(code, redirectUri);
    let user = await getUserByOAuthAccount("github", identity.providerAccountId);
    if (!user) {
      user = await getUserByEmail(normalizeEmail(identity.email)) ?? await createUser(normalizeEmail(identity.email), null);
      await linkOAuthAccount(user.id, "github", identity.providerAccountId);
    }
    const token = createSessionToken();
    await createAuthSession(user.id, hashSessionToken(token), new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000));
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch {
    return NextResponse.redirect(loginUrl(request, "github_oauth_failed"));
  }
}
