import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { log } from "@/lib/log";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "error") {
    super(message);
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Wraps a route handler with consistent error handling and logging. */
export function handler<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const started = Date.now();
    try {
      const res = await fn(...args);
      log.info(name, { status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      if (err instanceof HttpError) {
        log.warn(name, { status: err.status, message: err.message });
        return json({ error: err.message, code: err.code }, err.status);
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return json({ error: first?.message || "Invalid input", field: first?.path?.join("."), code: "validation" }, 400);
      }
      log.error(name, { message: (err as Error)?.message, stack: (err as Error)?.stack?.split("\n").slice(0, 4).join(" | ") });
      return json({ error: "Something went wrong on our side. Please try again.", code: "server" }, 500);
    }
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.", "unauthorized");
  return user;
}

/** Simple fixed-window rate limit stored in Postgres (works across serverless instances). */
export async function rateLimit(key: string, max: number, windowSec: number) {
  const db = getDb();
  const rows = await db.execute<{ count: number }>(sql`
    insert into ${schema.loginAttempts} (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when ${schema.loginAttempts.windowStart} < now() - make_interval(secs => ${windowSec}) then 1 else ${schema.loginAttempts.count} + 1 end,
      window_start = case when ${schema.loginAttempts.windowStart} < now() - make_interval(secs => ${windowSec}) then now() else ${schema.loginAttempts.windowStart} end
    returning count`);
  const count = Number((rows as unknown as { rows?: { count: number }[] }).rows?.[0]?.count ?? (rows as unknown as { count: number }[])[0]?.count ?? 0);
  if (count > max) throw new HttpError(429, "Too many attempts. Please wait a few minutes and try again.", "rate_limited");
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
