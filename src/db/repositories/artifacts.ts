import { eq } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, type Artifact } from "@/db/schema";

export interface NewArtifact {
  sessionId: string;
  type: string;
  title: string;
  content: string;
  meta?: Record<string, unknown>;
}

export async function insertArtifact(data: NewArtifact): Promise<Artifact> {
  const [row] = await db.insert(artifacts).values(data).returning();
  return row;
}

export async function listArtifacts(sessionId: string): Promise<Artifact[]> {
  return db.select().from(artifacts).where(eq(artifacts.sessionId, sessionId));
}
