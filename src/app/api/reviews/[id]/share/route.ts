import { randomBytes } from "node:crypto";
import { getSession, setShareSlug } from "@/db/repositories/sessions";
import { fail, handleRouteError, ok } from "@/lib/api";

/** Enables sharing: mints an unguessable slug (idempotent — existing slug is kept). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) return fail("评审会话不存在", 404);
    if (session.status !== "completed") return fail("评审完成后才能分享", 409);

    if (session.shareSlug) {
      return ok({ slug: session.shareSlug, reused: true });
    }
    const slug = randomBytes(9).toString("base64url");
    await setShareSlug(id, slug);
    return ok({ slug, reused: false }, 201);
  } catch (error) {
    return handleRouteError(error, "POST /api/reviews/[id]/share");
  }
}

/** Revokes sharing: the public link stops working immediately. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) return fail("评审会话不存在", 404);
    await setShareSlug(id, null);
    return ok({ revoked: true });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/reviews/[id]/share");
  }
}
