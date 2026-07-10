import { logger } from "@/lib/logger";

interface EmbeddingConfig { baseUrl: string; apiKey?: string; model: string }

export function loadEmbeddingConfig(env: Record<string, string | undefined> = process.env): EmbeddingConfig | null {
  const baseUrl = env.EMBEDDING_BASE_URL?.trim();
  const model = env.EMBEDDING_MODEL?.trim();
  if (!baseUrl || !model) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey: env.EMBEDDING_API_KEY?.trim() || undefined, model };
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const config = loadEmbeddingConfig();
  if (!config || texts.length === 0) return null;
  try {
    const embeddings: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += 64) {
      const batch = texts.slice(offset, offset + 64);
      const response = await fetch(`${config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: config.model, input: batch }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { data?: Array<{ index: number; embedding: number[] }> };
      const data = [...(body.data ?? [])].sort((a, b) => a.index - b.index);
      if (data.length !== batch.length || data.some((item) =>
        !Array.isArray(item.embedding) || item.embedding.length === 0 || item.embedding.length > 4_096
        || item.embedding.some((value) => !Number.isFinite(value)))) {
        throw new Error("invalid embeddings response");
      }
      embeddings.push(...data.map((item) => item.embedding));
    }
    const dimensions = embeddings[0]?.length;
    if (!dimensions || embeddings.some((embedding) => embedding.length !== dimensions)) {
      throw new Error("inconsistent embedding dimensions");
    }
    return embeddings;
  } catch (error) {
    logger.warn({ err: error }, "embedding request failed; falling back to lexical retrieval");
    return null;
  }
}
