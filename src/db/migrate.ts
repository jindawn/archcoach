import fs from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";

/**
 * Applies pending drizzle migrations at server boot (called from
 * instrumentation.ts). Uses the drizzle-orm migrator API instead of
 * drizzle-kit so the production image only needs runtime dependencies.
 */
export async function runMigrations(): Promise<void> {
  if (process.env.SKIP_MIGRATIONS === "true") return;

  const folder = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(path.join(folder, "meta", "_journal.json"))) {
    return; // no migrations generated yet
  }

  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { pool } = await import("./client");
    await migrate(drizzle(pool), { migrationsFolder: folder });
    logger.info("migrations applied");
  } catch (error) {
    logger.error({ err: error }, "migration failed");
    if (process.env.NODE_ENV === "production") throw error;
  }
}
