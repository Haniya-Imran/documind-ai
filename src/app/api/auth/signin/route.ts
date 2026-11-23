import { handler, json, rateLimit, clientIp } from "@/lib/api";
import { signIn } from "@/lib/auth/service";
import { SESSION_COOKIE, cookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = handler("auth.signin", async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  await rateLimit(`signin:${clientIp(req)}:${email}`, 8, 900);
  const { user, token, expiresAt } = await signIn(body);
  const res = json({ user });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return res;
});
