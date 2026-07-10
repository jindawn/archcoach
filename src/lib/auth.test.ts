import { describe, expect, test } from "vitest";
import { hashPassword, hashSessionToken, normalizeEmail, verifyPassword } from "./auth";

describe("authentication helpers", () => {
  test("normalizes email addresses before identity lookup", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  test("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("a-safe-password");
    expect(hash).not.toContain("a-safe-password");
    await expect(verifyPassword("a-safe-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  test("derives a stable, non-reversible session lookup key", () => {
    expect(hashSessionToken("token")).toHaveLength(64);
    expect(hashSessionToken("token")).toBe(hashSessionToken("token"));
  });
});
