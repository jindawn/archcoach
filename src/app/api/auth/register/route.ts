import { z } from "zod";
import { createAuthSession, createUser, getUserByEmail } from "@/db/repositories/auth";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  authenticationEnabled,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
} from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(12, "密码至少 12 位").max(200),
});

export async function POST(request: Request) {
  try {
    if (!authenticationEnabled()) return fail("LOCAL_MODE=true 时不启用账号认证", 409);
    const input = registerSchema.parse(await request.json());
    const email = normalizeEmail(input.email);
    if (await getUserByEmail(email)) return fail("该邮箱已注册", 409);
    const user = await createUser(email, await hashPassword(input.password));
    const token = createSessionToken();
    await createAuthSession(
      user.id,
      hashSessionToken(token),
      new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    );
    const response = ok({ id: user.id, email: user.email }, 201);
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/register");
  }
}
