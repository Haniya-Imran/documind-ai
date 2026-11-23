import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/lib/db/client";

export const SESSION_COOKIE = "dm_session";
const SESSION_DAYS = 7;

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (at least 32 characters).");
  return new TextEncoder().encode(s);
}

export async function signSessionToken(sid: string, uid: string, expires: Date) {
  return new SignJWT({ sid, uid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expires.getTime() / 1000))
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<{ sid: string; uid: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sid !== "string" || typeof payload.uid !== "string") return null;
    return { sid: payload.sid, uid: payload.uid };
  } catch {
    return null;
  }
}

/** Creates a DB session and returns the signed cookie value. */
export async function createSession(userId: string) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const [row] = await db.insert(schema.sessions).values({ userId, expiresAt }).returning({ id: schema.sessions.id });
  const token = await signSessionToken(row.id, userId, expiresAt);
  return { token, expiresAt };
}

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export type SessionUser = { id: string; name: string; email: string; sessionId: string };

/** Looks up the signed-in user from a raw cookie value (verifies signature, expiry and DB session). */
export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const claims = await readSessionToken(token);
  if (!claims) return null;
  const db = getDb();
  const rows = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, claims.sid), eq(schema.sessions.userId, claims.uid), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ? { ...rows[0], sessionId: claims.sid } : null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return userFromToken(store.get(SESSION_COOKIE)?.value);
}

export async function destroySession(sessionId: string) {
  await getDb().delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}
