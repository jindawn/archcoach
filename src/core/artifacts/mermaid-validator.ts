/**
 * Server-side mermaid syntax validation. mermaid v11 parses flowcharts in
 * plain Node, so generated diagrams are verified before they are stored and
 * parse errors are fed back to the model for repair.
 */

export interface MermaidValidation {
  valid: boolean;
  error?: string;
}

let initialized = false;

/** mermaid needs a DOM even for parse(); provide one via jsdom on the server. */
async function ensureDom(): Promise<void> {
  if (typeof window !== "undefined") return;
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!DOCTYPE html><body></body>");
  const assign = (key: string, value: unknown) => {
    try {
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    } catch {
      // read-only global (e.g. navigator in newer Node) — keep the built-in
    }
  };
  assign("window", dom.window);
  assign("document", dom.window.document);
  if (typeof navigator === "undefined") assign("navigator", dom.window.navigator);
}

export async function validateMermaid(source: string): Promise<MermaidValidation> {
  try {
    await ensureDom();
    const mermaid = (await import("mermaid")).default;
    if (!initialized) {
      mermaid.initialize({ startOnLoad: false });
      initialized = true;
    }
    await mermaid.parse(source);
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, error: message.slice(0, 500) };
  }
}

/** Strips ```mermaid fences the model sometimes adds despite instructions. */
export function extractMermaidSource(raw: string): string {
  const fenced = raw.match(/```(?:mermaid)?\s*\n([\s\S]*?)```/);
  return autoFixCommonMistakes((fenced ? fenced[1] : raw).trim());
}

/**
 * Safe string-level fixes for the mermaid mistakes weak models make most:
 * invented arrow variants, HTML line breaks, and style lines (banned by our
 * prompt but emitted anyway).
 */
export function autoFixCommonMistakes(source: string): string {
  return source
    .replace(/--+>>+/g, "-->")
    .replace(/---+>/g, "-->")
    .replace(/(\|[^|\n]*\|)>/g, "$1")
    .replace(/<\/?br\s*\/?>/gi, "")
    .split("\n")
    .filter((line) => !/^\s*(style|classDef|linkStyle|click)\s/.test(line))
    .join("\n");
}
