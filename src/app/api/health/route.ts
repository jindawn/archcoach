import { NextResponse } from "next/server";
import { pool } from "@/db/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ success: true, data: { db: "up" } });
  } catch (error) {
    logger.error({ err: error }, "health check: database unreachable");
    return NextResponse.json(
      { success: false, error: "database unreachable" },
      { status: 503 },
    );
  }
}
