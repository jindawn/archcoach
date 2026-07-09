import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { logger } from "@/lib/logger";
import { upsertScenario, type ScenarioSeed } from "@/db/repositories/scenarios";

/**
 * Seeds training scenarios from /scenarios/*.md at boot. Idempotent upsert
 * by slug, so editing a scenario file and restarting updates the row.
 * Adding a scenario = adding a markdown file (the community contribution path).
 */
export async function seedScenarios(): Promise<void> {
  const dir = path.join(process.cwd(), "scenarios");
  if (!fs.existsSync(dir)) return;

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md") && !file.startsWith("_"));

  for (const file of files) {
    try {
      const { data, content } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      const seed = toSeed(data, content, file);
      await upsertScenario(seed);
    } catch (error) {
      logger.error({ err: error, file }, "failed to seed scenario");
    }
  }
  if (files.length > 0) {
    logger.info({ count: files.length }, "scenarios seeded");
  }
}

function toSeed(data: Record<string, unknown>, body: string, file: string): ScenarioSeed {
  const required = ["slug", "title", "difficulty", "domain"] as const;
  for (const key of required) {
    if (typeof data[key] !== "string" || !data[key]) {
      throw new Error(`scenario ${file} is missing frontmatter field "${key}"`);
    }
  }
  return {
    slug: data.slug as string,
    title: data.title as string,
    difficulty: data.difficulty as string,
    domain: data.domain as string,
    backgroundMd: body.trim(),
    constraints:
      data.constraints && typeof data.constraints === "object"
        ? (data.constraints as Record<string, unknown>)
        : {},
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
  };
}
