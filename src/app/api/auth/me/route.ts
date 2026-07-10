import { authenticationEnabled, getCurrentUser } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  return ok({ enabled: authenticationEnabled(), user: user ? { id: user.id, email: user.email } : null });
}
