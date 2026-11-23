import { handler, json, rateLimit, clientIp } from "@/lib/api";
import { signUp } from "@/lib/auth/service";
import { SESSION_COOKIE, cookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = handler("auth.signup", async (req: Request) => {
  await rateLimit(`signup:${clientIp(req)}`, 10, 3600);
  const { user, token, expiresAt } = await signUp(await req.json().catch(() => ({})));
  const res = json({ user }, 201);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return res;
});
