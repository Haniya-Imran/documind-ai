import { handler, json } from "@/lib/api";
import { SESSION_COOKIE, destroySession, getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = handler("auth.logout", async () => {
  const user = await getCurrentUser();
  if (user) await destroySession(user.sessionId);
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0) });
  return res;
});
