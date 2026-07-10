import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

export function githubOAuthEnabled(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOAuthState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export function statesMatch(state: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOAuthState(state), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function githubAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
}

interface GitHubUser { id: number }
interface GitHubEmail { email: string; primary: boolean; verified: boolean }

export async function getGitHubIdentity(code: string, redirectUri: string): Promise<{
  providerAccountId: string;
  email: string;
}> {
  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenResponse.ok || !token.access_token) throw new Error("GitHub 授权失败");
  const headers = { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json" };
  const [userResponse, emailsResponse] = await Promise.all([
    fetch(`${GITHUB_API_URL}/user`, { headers }),
    fetch(`${GITHUB_API_URL}/user/emails`, { headers }),
  ]);
  if (!userResponse.ok || !emailsResponse.ok) throw new Error("无法读取 GitHub 账户信息");
  const user = (await userResponse.json()) as GitHubUser;
  const emails = (await emailsResponse.json()) as GitHubEmail[];
  const email = emails.find((item) => item.primary && item.verified)?.email
    ?? emails.find((item) => item.verified)?.email;
  if (!email) throw new Error("GitHub 账户没有已验证邮箱");
  return { providerAccountId: String(user.id), email };
}
