/**
 * Approximate USD prices per 1M tokens (input, output). Update in this one
 * place when providers change pricing. Unknown models log tokens with a
 * null cost instead of guessing.
 */
const PRICES_PER_MTOK: Record<string, [number, number]> = {
  "deepseek-chat": [0.27, 1.1],
  "deepseek-reasoner": [0.55, 2.19],
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4o": [2.5, 10],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1": [2, 8],
  "gpt-5": [1.25, 10],
  "gpt-5-mini": [0.25, 2],
  "claude-haiku-4-5": [1, 5],
  "claude-sonnet-4-5": [3, 15],
  "claude-opus-4-5": [5, 25],
};

const MTOK = 1_000_000;

export function estimateCostUsd(
  modelId: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  // local models are free
  if (modelId.includes("ollama") || modelId.includes(":latest")) return 0;

  const matched = Object.entries(PRICES_PER_MTOK).find(([name]) =>
    modelId.toLowerCase().includes(name),
  );
  if (!matched || promptTokens === null || completionTokens === null) return null;

  const [inPrice, outPrice] = matched[1];
  return (promptTokens * inPrice + completionTokens * outPrice) / MTOK;
}
