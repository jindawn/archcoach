import { z } from "zod";

const MAX_SOLUTION_CHARS = 51_200; // ~50KB

export const createSubmissionSchema = z.object({
  title: z.string().min(2).max(200),
  kind: z.enum(["real", "training"]).default("real"),
  scenarioSlug: z.string().max(100).optional(),
  teamId: z.uuid().optional(),
  businessContext: z.string().min(20).max(20_000),
  solutionMd: z.string().min(50).max(MAX_SOLUTION_CHARS),
  techStack: z.string().max(2_000).optional(),
  constraints: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  diagramSource: z.string().max(20_000).optional(),
  diagramType: z.enum(["mermaid", "plantuml", "c4dsl"]).optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const saveAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        answer: z.string().max(4_000),
      }),
    )
    .min(1)
    .max(20),
});

export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;
