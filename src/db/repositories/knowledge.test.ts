import { describe, expect, test } from "vitest";
import { cosineSimilarity, rankKnowledge, splitKnowledgeDocument } from "./knowledge";

describe("knowledge retrieval", () => {
  test("splits long documents without losing content", () => {
    const chunks = splitKnowledgeDocument("a".repeat(2_500));
    expect(chunks.map((chunk) => chunk.length)).toEqual([1_200, 1_200, 100]);
  });

  test("ranks chunks matching Chinese and technical terms", () => {
    const rows = [
      { title: "支付规范", content: "支付回调必须使用幂等键并进行签名校验" },
      { title: "日志规范", content: "日志保存三十天" },
    ];
    expect(rankKnowledge(rows, "支付回调如何保证幂等")[0]?.title).toBe("支付规范");
  });
  test("uses semantic similarity when embeddings are available", () => {
    const rows = [
      { title: "语义相关", content: "没有字面重合", embedding: [1, 0] },
      { title: "无关", content: "另一个片段", embedding: [0, 1] },
    ];
    expect(rankKnowledge(rows, "查询", 2, [1, 0])[0]?.title).toBe("语义相关");
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });
});
