import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { deleteAuthSession, getUserBySession } from "@/db/repositories/auth";
import type { User } from "@/db/schema";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "archcoach_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export class AuthenticationError extends Error {
  constructor() {
    super("请先登录");
  }
}

export function authenticationEnabled(): boolean {
  return process.env.LOCAL_MODE === "false";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, expected] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, "base64url");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCurrentUser(): Promise<User | null> {
  if (!authenticationEnabled()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getUserBySession(hashSessionToken(token)) : null;
}

/** Returns null in LOCAL_MODE; otherwise requires a valid browser session. */
export async function requireUser(): Promise<User | null> {
  const user = await getCurrentUser();
  if (authenticationEnabled() && !user) throw new AuthenticationError();
  return user;
}

export async function clearCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await deleteAuthSession(hashSessionToken(token));
  cookieStore.delete(SESSION_COOKIE);
}
