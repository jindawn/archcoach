import { z } from "zod";
import { createTeam, listTeamsForUser } from "@/db/repositories/teams";
import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
const schema = z.object({ name: z.string().min(2).max(80), slug: z.string().regex(/^[a-z0-9-]{2,50}$/) });
export async function GET() { try { const user = await requireUser(); return ok(user ? await listTeamsForUser(user.id) : []); } catch (error) { return handleRouteError(error, "GET /api/teams"); } }
export async function POST(request: Request) { try { const user = await requireUser(); if (!user) throw new Error("本地模式不支持团队"); const input = schema.parse(await request.json()); return ok(await createTeam(input.name, input.slug, user.id), 201); } catch (error) { return handleRouteError(error, "POST /api/teams"); } }
