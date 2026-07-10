import { describe, expect, test } from "vitest";
import { loadEmbeddingConfig } from "./embeddings";
describe("embedding config", () => {
  test("keeps semantic retrieval optional", () => {
    expect(loadEmbeddingConfig({})).toBeNull();
    expect(loadEmbeddingConfig({ EMBEDDING_BASE_URL: "http://localhost:11434/v1", EMBEDDING_MODEL: "nomic-embed-text" })).toEqual({ baseUrl: "http://localhost:11434/v1", model: "nomic-embed-text", apiKey: undefined });
  });
});
