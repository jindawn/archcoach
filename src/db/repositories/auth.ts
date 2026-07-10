import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, users, type User } from "@/db/schema";

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user ?? null;
}

export async function createAuthSession(userId: string, tokenHash: string, expiresAt: Date) {
  await db.insert(authSessions).values({ userId, tokenHash, expiresAt });
}

export async function getUserBySession(tokenHash: string): Promise<User | null> {
  const [row] = await db
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, new Date())));
  return row?.user ?? null;
}

export async function deleteAuthSession(tokenHash: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}
