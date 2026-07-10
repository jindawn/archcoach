import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeChunks, knowledgeDocuments } from "@/db/schema";

export interface KnowledgeMatch {
  title: string;
  content: string;
  score: number;
}

export function splitKnowledgeDocument(content: string, size = 1_200): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < content.length; offset += size) {
    chunks.push(content.slice(offset, offset + size).trim());
  }
  return chunks.filter(Boolean);
}

function queryTerms(query: string): string[] {
  const normalized = query.toLowerCase();
  const words = normalized.match(/[a-z0-9_-]{3,}|[\u3400-\u9fff]{2,}/g) ?? [];
  const terms = new Set<string>();
  for (const word of words) {
    terms.add(word);
    if (/^[\u3400-\u9fff]+$/.test(word)) {
      for (let index = 0; index < word.length - 1; index += 1) terms.add(word.slice(index, index + 2));
    }
  }
  return [...terms].slice(0, 40);
}

export function rankKnowledge(
  rows: Array<{ title: string; content: string }>,
  query: string,
  limit = 6,
): KnowledgeMatch[] {
  const terms = queryTerms(query);
  return rows
    .map((row) => {
      const haystack = `${row.title}\n${row.content}`.toLowerCase();
      return { ...row, score: terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) };
    })
    .filter((row) => terms.length === 0 || row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function addKnowledgeDocument(teamId: string, title: string, content: string) {
  return db.transaction(async (tx) => {
    const [document] = await tx.insert(knowledgeDocuments).values({ teamId, title, content }).returning();
    const chunks = splitKnowledgeDocument(content);
    await tx.insert(knowledgeChunks).values(
      chunks.map((chunk, sortOrder) => ({ documentId: document.id, content: chunk, sortOrder })),
    );
    return document;
  });
}

export async function searchKnowledge(teamId: string, query: string): Promise<KnowledgeMatch[]> {
  const rows = await db
    .select({ title: knowledgeDocuments.title, content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(eq(knowledgeDocuments.teamId, teamId))
    .orderBy(desc(knowledgeDocuments.createdAt))
    .limit(200);
  return rankKnowledge(rows, query);
}
