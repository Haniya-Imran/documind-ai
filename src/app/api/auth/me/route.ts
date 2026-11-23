import { handler, json, requireUser } from "@/lib/api";
import { updateProfile, changePassword } from "@/lib/auth/service";

export const runtime = "nodejs";

export const GET = handler("auth.me", async () => {
  const u = await requireUser();
  return json({ user: { id: u.id, name: u.name, email: u.email } });
});

export const PATCH = handler("auth.update", async (req: Request) => {
  const u = await requireUser();
  const body = await req.json().catch(() => ({}));
  if (typeof body.name === "string") await updateProfile(u.id, body.name);
  if (typeof body.newPassword === "string") await changePassword(u.id, String(body.currentPassword || ""), body.newPassword, u.sessionId);
  return json({ ok: true });
});
