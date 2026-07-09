/**
 * Masks obviously sensitive values before any text leaves the machine.
 * Warn-only design: callers surface `hits` to the user, the masked text is
 * what gets sent to the LLM provider.
 */

interface SanitizePattern {
  type: string;
  regex: RegExp;
}

const PATTERNS: SanitizePattern[] = [
  {
    type: "private_key",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  { type: "api_key", regex: /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g },
  { type: "aws_access_key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    type: "secret_assignment",
    regex:
      /\b(api[_-]?key|secret|password|passwd|access[_-]?token)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
  },
  {
    type: "internal_ip",
    regex:
      /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,
  },
  { type: "email", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { type: "cn_mobile", regex: /\b1[3-9]\d{9}\b/g },
];

export interface SanitizeResult {
  text: string;
  hits: string[];
}

export function sanitizeText(input: string): SanitizeResult {
  const hits = new Set<string>();
  const text = PATTERNS.reduce((current, { type, regex }) => {
    return current.replace(regex, (match) => {
      hits.add(type);
      // keep the key name in assignments so context survives for the reviewer
      if (type === "secret_assignment") {
        const eq = match.search(/[:=]/);
        return `${match.slice(0, eq + 1)} [REDACTED:${type}]`;
      }
      return `[REDACTED:${type}]`;
    });
  }, input);
  return { text, hits: [...hits] };
}
