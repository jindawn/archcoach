import type { Gateway } from "../llm/gateway";
import { loadPromptTemplate, renderTemplate } from "../prompts/loader";
import { roleReviewOutputSchema, type Severity, type VerifiedRoleReview } from "../schemas/review";
import { verifyRoleReview } from "./evidence";
import { getRole, type RoleKey } from "./roles";

export interface RoleReviewRunResult {
  roleKey: RoleKey;
  review: VerifiedRoleReview;
  riskLevel: Severity;
  promptVersion: string;
  model: string;
  degraded: boolean;
}

const SEVERITY_ORDER: Severity[] = ["low", "medium", "high", "critical"];

/** Overall risk level of one role's review = its most severe verified issue. */
export function deriveRiskLevel(review: VerifiedRoleReview): Severity {
  const severities = review.issues.map((issue) => issue.severity);
  if (severities.length === 0) return "low";
  return severities.reduce((max, s) =>
    SEVERITY_ORDER.indexOf(s) > SEVERITY_ORDER.indexOf(max) ? s : max,
  );
}

export async function reviewWithRole(
  gateway: Gateway,
  roleKey: RoleKey,
  dossier: string,
  options: { sessionId?: string } = {},
): Promise<RoleReviewRunResult> {
  const role = getRole(roleKey);
  const base = loadPromptTemplate("roles/_base");
  const brief = loadPromptTemplate(role.promptName);

  const system = renderTemplate(base.content, { role_brief: brief.content });
  const promptVersion = `${base.version}+${roleKey}@${brief.version}`;

  const result = await gateway.call({
    task: `role_review:${roleKey}`,
    schema: roleReviewOutputSchema,
    system,
    prompt: dossier,
    tier: "standard",
    promptVersion,
    sessionId: options.sessionId,
  });

  const review = verifyRoleReview(dossier, result.object);
  return {
    roleKey,
    review,
    riskLevel: deriveRiskLevel(review),
    promptVersion,
    model: result.model,
    degraded: result.degraded,
  };
}
