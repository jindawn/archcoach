import { describe, expect, test } from "vitest";
import { computeOverallScore, type RoleScoreInput } from "./index";

function role(overrides: Partial<RoleScoreInput> = {}): RoleScoreInput {
  return { roleKey: "sre", score: 8, isBlocking: false, riskLevel: "medium", ...overrides };
}

describe("computeOverallScore", () => {
  test("averages role scores to a 0-100 scale", () => {
    const result = computeOverallScore([role({ score: 8 }), role({ score: 6 })]);
    expect(result.score).toBe(70);
    expect(result.grade).toBe("B");
    expect(result.capApplied).toBeNull();
  });

  test("blocking verdict caps the score at 65 — averaging cannot dilute it", () => {
    const result = computeOverallScore([
      role({ score: 9 }),
      role({ score: 9 }),
      role({ score: 9 }),
      role({ score: 5, isBlocking: true, riskLevel: "critical" }),
    ]);
    expect(result.score).toBe(65);
    expect(result.grade).toBe("C");
    expect(result.blocked).toBe(true);
    expect(result.capApplied).toBe("blocking");
  });

  test("critical risk without blocking caps at 75", () => {
    const result = computeOverallScore([
      role({ score: 9 }),
      role({ score: 9, riskLevel: "critical" }),
    ]);
    expect(result.score).toBe(75);
    expect(result.capApplied).toBe("critical");
  });

  test("caps do not raise low scores", () => {
    const result = computeOverallScore([role({ score: 3, isBlocking: true })]);
    expect(result.score).toBe(30);
    expect(result.grade).toBe("D");
    expect(result.capApplied).toBeNull();
  });

  test("empty input yields zero", () => {
    expect(computeOverallScore([]).score).toBe(0);
  });

  test("grade boundaries", () => {
    expect(computeOverallScore([role({ score: 9 })]).grade).toBe("S");
    expect(computeOverallScore([role({ score: 8 })]).grade).toBe("A");
    expect(computeOverallScore([role({ score: 6 })]).grade).toBe("C");
  });
});
