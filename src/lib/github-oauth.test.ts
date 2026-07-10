import { describe, expect, test } from "vitest";
import { githubOAuthEnabled, hashOAuthState, statesMatch } from "./github-oauth";

describe("GitHub OAuth helpers", () => {
  test("validates the state against its stored hash", () => {
    const state = "state-for-test";
    expect(statesMatch(state, hashOAuthState(state))).toBe(true);
    expect(statesMatch("other-state", hashOAuthState(state))).toBe(false);
  });

  test("is disabled unless both client credentials exist", () => {
    const originalId = process.env.GITHUB_CLIENT_ID;
    const originalSecret = process.env.GITHUB_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    expect(githubOAuthEnabled()).toBe(false);
    process.env.GITHUB_CLIENT_ID = "id";
    process.env.GITHUB_CLIENT_SECRET = "secret";
    expect(githubOAuthEnabled()).toBe(true);
    if (originalId === undefined) delete process.env.GITHUB_CLIENT_ID; else process.env.GITHUB_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET; else process.env.GITHUB_CLIENT_SECRET = originalSecret;
  });
});
