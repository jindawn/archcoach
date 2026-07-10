import { desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeChunks, knowledgeDocuments } from "@/db/schema";
export async function addKnowledgeDocument(teamId: string, title: string, content: string) { return db.transaction(async (tx) => { const [doc] = await tx.insert(knowledgeDocuments).values({ teamId, title, content }).returning(); const chunks = content.match(/[\s\S]{1,1200}(?:\s|$)/g) ?? [content]; await tx.insert(knowledgeChunks).values(chunks.map((chunk, sortOrder) => ({ documentId: doc.id, content: chunk, sortOrder }))); return doc; }); }
export async function searchKnowledge(teamId: string, query: string) { return db.select({ title: knowledgeDocuments.title, content: knowledgeChunks.content }).from(knowledgeChunks).innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id)).where(eq(knowledgeDocuments.teamId, teamId)).orderBy(desc(knowledgeDocuments.createdAt)).limit(6); }
