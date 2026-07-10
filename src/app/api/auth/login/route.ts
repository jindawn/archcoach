import { z } from "zod";
import { createAuthSession, getUserByEmail } from "@/db/repositories/auth";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  authenticationEnabled,
  createSessionToken,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    if (!authenticationEnabled()) return fail("LOCAL_MODE=true 时不启用账号认证", 409);
    const input = loginSchema.parse(await request.json());
    const user = await getUserByEmail(normalizeEmail(input.email));
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      return fail("邮箱或密码不正确", 401);
    }
    const token = createSessionToken();
    await createAuthSession(
      user.id,
      hashSessionToken(token),
      new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    );
    const response = ok({ id: user.id, email: user.email });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/login");
  }
}
