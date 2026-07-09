/**
 * Anti-hallucination check: every issue must quote the dossier verbatim.
 * Quotes that cannot be located (after whitespace/punctuation normalization)
 * are marked unverified and rendered de-emphasized in the report.
 */

import type { RoleReviewOutput, VerifiedRoleReview } from "../schemas/review";

const PUNCTUATION = /[\s,，。.、;；:：!！?？'"“”‘’()（）\[\]【】<>《》\-—_*`#|]/g;

function normalize(text: string): string {
  return text.replace(PUNCTUATION, "").toLowerCase();
}

/**
 * A quote counts as verified when its normalized form appears in the
 * normalized dossier, or when at least 60% of its punctuation-split segments
 * do (models often stitch two adjacent sentences together).
 */
export function isEvidenceVerified(dossier: string, evidence: string): boolean {
  const normalizedDossier = normalize(dossier);
  const normalizedEvidence = normalize(evidence);
  if (normalizedEvidence.length < 4) return false;
  if (normalizedDossier.includes(normalizedEvidence)) return true;

  const segments = evidence
    .split(/[,，。.、;；:：\n]/)
    .map(normalize)
    .filter((segment) => segment.length >= 4);
  if (segments.length === 0) return false;
  const found = segments.filter((segment) => normalizedDossier.includes(segment));
  return found.length / segments.length >= 0.6;
}

export function verifyRoleReview(dossier: string, output: RoleReviewOutput): VerifiedRoleReview {
  return {
    ...output,
    issues: output.issues.map((issue) => ({
      ...issue,
      verified: isEvidenceVerified(dossier, issue.evidence),
    })),
  };
}
