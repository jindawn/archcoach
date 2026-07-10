import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { AuthenticationError } from "@/lib/auth";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

/** Uniform catch-all: log details server-side, return a friendly message. */
export function handleRouteError(error: unknown, context: string): NextResponse {
  if (error instanceof AuthenticationError) return fail(error.message, 401);
  if (error instanceof ZodError) {
    const detail = error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return fail(`参数校验失败：${detail}`, 422);
  }
  logger.error({ err: error, context }, "route handler failed");
  const message = error instanceof Error ? error.message : "服务器内部错误";
  return fail(message, 500);
}
