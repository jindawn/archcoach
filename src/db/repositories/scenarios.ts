import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scenarios, type Scenario } from "@/db/schema";

export interface ScenarioSeed {
  slug: string;
  title: string;
  difficulty: string;
  domain: string;
  backgroundMd: string;
  constraints: Record<string, unknown>;
  sortOrder: number;
}

export async function upsertScenario(seed: ScenarioSeed): Promise<void> {
  await db
    .insert(scenarios)
    .values(seed)
    .onConflictDoUpdate({
      target: scenarios.slug,
      set: {
        title: seed.title,
        difficulty: seed.difficulty,
        domain: seed.domain,
        backgroundMd: seed.backgroundMd,
        constraints: seed.constraints,
        sortOrder: seed.sortOrder,
      },
    });
}

export async function listScenarios(): Promise<Scenario[]> {
  return db.select().from(scenarios).orderBy(asc(scenarios.sortOrder));
}

export async function getScenarioBySlug(slug: string): Promise<Scenario | null> {
  const [row] = await db.select().from(scenarios).where(eq(scenarios.slug, slug));
  return row ?? null;
}
