import { listScenarios } from "@/db/repositories/scenarios";
import { handleRouteError, ok } from "@/lib/api";

export async function GET() {
  try {
    const scenarios = await listScenarios();
    return ok(
      scenarios.map((s) => ({
        slug: s.slug,
        title: s.title,
        difficulty: s.difficulty,
        domain: s.domain,
        backgroundMd: s.backgroundMd,
        constraints: s.constraints,
      })),
    );
  } catch (error) {
    return handleRouteError(error, "GET /api/scenarios");
  }
}
