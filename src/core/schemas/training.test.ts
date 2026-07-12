import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, test } from "vitest";
import { computeIndependence, trainingGuideSchema } from "./training";
import { assembleSolution, recommendedStep } from "@/lib/guided-training";

describe("guided training", () => {
  test("both beginner scenarios contain valid guides", () => {
    for (const file of ["short-url-beginner.md", "image-upload-beginner.md"]) {
      const { data } = matter(fs.readFileSync(path.join(process.cwd(), "scenarios", file), "utf8"));
      expect(data.difficulty).toBe("beginner");
      expect(trainingGuideSchema.parse(data.trainingGuide).steps).toHaveLength(5);
    }
  });

  test("rejects missing hints, unknown capabilities and template placeholders", () => {
    const invalid = { version: 1, intro: "intro", solutionTemplate: "{{one}}", steps: [
      { id: "one", title: "one", capability: "unknown", question: "a sufficiently long question", hints: ["a", "b"], rubric: ["x"] },
      { id: "two", title: "two", capability: "data", question: "a sufficiently long question", hints: ["a", "b", "c"], rubric: ["x"] },
      { id: "three", title: "three", capability: "data", question: "a sufficiently long question", hints: ["a", "b", "c"], rubric: ["x"] },
    ] };
    expect(trainingGuideSchema.safeParse(invalid).success).toBe(false);
  });

  test("independence is deterministic and decreases with hint use", () => {
    expect(computeIndependence([0, 0, 0, 0])).toBe(100);
    expect(computeIndependence([1, 2, 3, 0])).toBe(65);
    expect(computeIndependence([3, 3])).toBe(25);
  });

  test("assembles answers and selects lowest capability, breaking ties by hints", () => {
    const { data } = matter(fs.readFileSync(path.join(process.cwd(), "scenarios", "short-url-beginner.md"), "utf8"));
    const guide = trainingGuideSchema.parse(data.trainingGuide);
    const answers = guide.steps.map((step) => ({ stepId: step.id, answer: `回答-${step.id}`, followUpAnswer: null }));
    expect(assembleSolution(guide, answers)).toContain("回答-requirements");
    const scores = { scores: [
      { capability: "requirements" as const, score: 80, evidence: "x", advice: "x" },
      { capability: "data" as const, score: 40, evidence: "x", advice: "x" },
      { capability: "technology" as const, score: 40, evidence: "x", advice: "x" },
      { capability: "reliability" as const, score: 70, evidence: "x", advice: "x" },
      { capability: "capacity" as const, score: 70, evidence: "x", advice: "x" },
    ] };
    expect(recommendedStep(guide, scores, new Map([["technology", 3], ["data", 1]]))).toBe("technology");
  });
});
