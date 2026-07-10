import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { teamMembers, teams, type Team } from "@/db/schema";

export async function createTeam(name: string, slug: string, ownerId: string): Promise<Team> {
  return await db.transaction(async (tx) => {
    const [team] = await tx.insert(teams).values({ name, slug }).returning();
    await tx.insert(teamMembers).values({ teamId: team.id, userId: ownerId, role: "owner" });
    return team;
  });
}
export async function listTeamsForUser(userId: string): Promise<Team[]> {
  return (await db.select({ team: teams }).from(teamMembers).innerJoin(teams, eq(teamMembers.teamId, teams.id)).where(eq(teamMembers.userId, userId)).orderBy(asc(teams.name))).map((row) => row.team);
}
