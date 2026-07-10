import { clearCurrentSession } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";

export async function POST() {
  try {
    await clearCurrentSession();
    return ok({ loggedOut: true });
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/logout");
  }
}
