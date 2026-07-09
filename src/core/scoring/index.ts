import type { Severity } from "../schemas/review";

export interface RoleScoreInput {
  roleKey: string;
  score: number; // 0-10
  isBlocking: boolean;
  /** highest severity among *verified* issues */
  riskLevel: Severity;
}

export type Grade = "S" | "A" | "B" | "C" | "D";

export interface OverallScore {
  /** 0-100 */
  score: number;
  grade: Grade;
  blocked: boolean;
  /** which arbitration rule capped the score, if any */
  capApplied: "blocking" | "critical" | null;
}

/** blocking issues cap the overall result so averaging cannot dilute them */
const BLOCKING_CAP = 65;
const CRITICAL_CAP = 75;

function toGrade(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

/**
 * Deterministic arbitration: the overall score is the mean of role scores
 * (x10), then capped — any blocking verdict caps at 65 (grade C at best),
 * any critical risk caps at 75. LLMs summarize; code decides.
 */
export function computeOverallScore(roles: readonly RoleScoreInput[]): OverallScore {
  if (roles.length === 0) {
    return { score: 0, grade: "D", blocked: false, capApplied: null };
  }

  const mean = roles.reduce((sum, role) => sum + role.score, 0) / roles.length;
  const raw = Math.round(mean * 10 * 10) / 10;

  const blocked = roles.some((role) => role.isBlocking);
  const hasCritical = roles.some((role) => role.riskLevel === "critical");

  let capApplied: OverallScore["capApplied"] = null;
  let score = raw;
  if (blocked && score > BLOCKING_CAP) {
    score = BLOCKING_CAP;
    capApplied = "blocking";
  } else if (hasCritical && score > CRITICAL_CAP) {
    score = CRITICAL_CAP;
    capApplied = "critical";
  }

  return { score, grade: toGrade(score), blocked, capApplied };
}
