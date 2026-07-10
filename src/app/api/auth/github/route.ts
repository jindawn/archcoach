import { NextResponse } from "next/server";
import { authenticationEnabled } from "@/lib/auth";
import { fail } from "@/lib/api";
import { createOAuthState, githubAuthorizeUrl, githubOAuthEnabled, hashOAuthState } from "@/lib/github-oauth";

const STATE_COOKIE = "archcoach_github_oauth_state";

export async function GET(request: Request) {
  if (!authenticationEnabled() || !githubOAuthEnabled()) return fail("GitHub 登录尚未配置", 404);
  const state = createOAuthState();
  const redirectUri = new URL("/api/auth/github/callback", request.url).toString();
  const response = NextResponse.redirect(githubAuthorizeUrl(redirectUri, state));
  response.cookies.set(STATE_COOKIE, hashOAuthState(state), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/github", maxAge: 600,
  });
  return response;
}
