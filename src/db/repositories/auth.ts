import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, oauthAccounts, users, type User } from "@/db/schema";

export async function createUser(email: string, passwordHash: string | null): Promise<User> {
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();
  return user;
}

export async function getUserByOAuthAccount(
  provider: string,
  providerAccountId: string,
): Promise<User | null> {
  const [row] = await db
    .select({ user: users })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerAccountId, providerAccountId),
      ),
    );
  return row?.user ?? null;
}

export async function linkOAuthAccount(
  userId: string,
  provider: string,
  providerAccountId: string,
): Promise<void> {
  await db.insert(oauthAccounts).values({ userId, provider, providerAccountId });
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
