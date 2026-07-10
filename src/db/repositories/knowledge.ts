import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeChunks, knowledgeDocuments } from "@/db/schema";

export interface KnowledgeMatch {
  title: string;
  content: string;
  score: number;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]; leftNorm += left[index] ** 2; rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
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
  rows: Array<{ title: string; content: string; embedding?: number[] | null }>,
  query: string,
  limit = 6,
  queryEmbedding?: number[] | null,
): KnowledgeMatch[] {
  const terms = queryTerms(query);
  return rows
    .map((row) => {
      const haystack = `${row.title}\n${row.content}`.toLowerCase();
      const hits = terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
      const lexical = Math.min(1, hits / 3);
      const semantic = queryEmbedding && row.embedding
        ? (cosineSimilarity(queryEmbedding, row.embedding) + 1) / 2
        : null;
      return { title: row.title, content: row.content, score: semantic === null ? hits : semantic * 0.7 + lexical * 0.3, hits, semantic };
    })
    .filter((row) => row.semantic !== null || terms.length === 0 || row.hits > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function addKnowledgeDocument(teamId: string, title: string, content: string, embeddings?: number[][] | null) {
  return db.transaction(async (tx) => {
    const [document] = await tx.insert(knowledgeDocuments).values({ teamId, title, content }).returning();
    const chunks = splitKnowledgeDocument(content);
    await tx.insert(knowledgeChunks).values(
      chunks.map((chunk, sortOrder) => ({ documentId: document.id, content: chunk, sortOrder, embedding: embeddings?.[sortOrder] })),
    );
    return document;
  });
}

export async function searchKnowledge(teamId: string, query: string, queryEmbedding?: number[] | null): Promise<KnowledgeMatch[]> {
  const rows = await db
    .select({ title: knowledgeDocuments.title, content: knowledgeChunks.content, embedding: knowledgeChunks.embedding })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(eq(knowledgeDocuments.teamId, teamId))
    .orderBy(desc(knowledgeDocuments.createdAt))
    .limit(200);
  return rankKnowledge(rows, query, 6, queryEmbedding);
}
