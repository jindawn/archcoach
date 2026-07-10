import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { teamInvitations, teamMembers, teams, users, type Team } from "@/db/schema";

export async function createTeam(name: string, slug: string, ownerId: string): Promise<Team> {
  return db.transaction(async (tx) => {
    const [team] = await tx.insert(teams).values({ name, slug }).returning();
    await tx.insert(teamMembers).values({ teamId: team.id, userId: ownerId, role: "owner" });
    return team;
  });
}

export async function listTeamsForUser(userId: string): Promise<Team[]> {
  const rows = await db.select({ team: teams }).from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId)).orderBy(asc(teams.name));
  return rows.map((row) => row.team);
}

export async function getTeamRole(teamId: string, userId: string): Promise<string | null> {
  const [member] = await db.select({ role: teamMembers.role }).from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))).limit(1);
  return member?.role ?? null;
}

export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  return Boolean(await getTeamRole(teamId, userId));
}

export async function listTeamMembers(teamId: string) {
  return db.select({ userId: users.id, email: users.email, role: teamMembers.role })
    .from(teamMembers).innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId)).orderBy(asc(users.email));
}

export async function createTeamInvitation(input: {
  teamId: string; invitedBy: string; email: string; role: "owner" | "member";
  tokenHash: string; expiresAt: Date;
}) {
  const [invitation] = await db.insert(teamInvitations).values(input).returning();
  return invitation;
}

export async function acceptTeamInvitation(tokenHash: string, userId: string, email: string) {
  return db.transaction(async (tx) => {
    const [invitation] = await tx.select().from(teamInvitations).where(and(
      eq(teamInvitations.tokenHash, tokenHash), eq(teamInvitations.email, email),
      gt(teamInvitations.expiresAt, new Date()), isNull(teamInvitations.acceptedAt),
    )).limit(1);
    if (!invitation) return null;
    await tx.insert(teamMembers).values({ teamId: invitation.teamId, userId, role: invitation.role }).onConflictDoNothing();
    await tx.update(teamInvitations).set({ acceptedAt: new Date() }).where(eq(teamInvitations.id, invitation.id));
    return invitation;
  });
}

export async function updateTeamMemberRole(teamId: string, userId: string, role: "owner" | "member") {
  if (role === "member") {
    const [owners] = await db.select({ count: sql<number>`count(*)::int` }).from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, "owner")));
    const current = await getTeamRole(teamId, userId);
    if (current === "owner" && owners.count <= 1) throw new Error("团队必须至少保留一位 owner");
  }
  await db.update(teamMembers).set({ role }).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
}

export async function removeTeamMember(teamId: string, userId: string) {
  const role = await getTeamRole(teamId, userId);
  if (role === "owner") throw new Error("请先转移 owner 角色后再移除");
  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
}
