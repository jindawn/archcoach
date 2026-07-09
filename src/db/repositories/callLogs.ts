import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { llmCallLogs, type NewLlmCallLog } from "@/db/schema";

export async function insertCallLog(data: NewLlmCallLog): Promise<void> {
  await db.insert(llmCallLogs).values(data);
}

export interface SessionUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export async function getSessionUsage(sessionId: string): Promise<SessionUsage> {
  const [row] = await db
    .select({
      calls: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(${llmCallLogs.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${llmCallLogs.completionTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${llmCallLogs.costUsd}), 0)::float`,
    })
    .from(llmCallLogs)
    .where(eq(llmCallLogs.sessionId, sessionId));
  return row;
}
