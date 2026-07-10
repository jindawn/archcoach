import { getTrainingProgress } from "@/db/repositories/training";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
export async function GET() { try { const user = await requireUser(); return ok(await getTrainingProgress(user?.id)); } catch (error) { return handleRouteError(error, "GET /api/training/progress"); } }
