import { handler, json, requireUser, rateLimit } from "@/lib/api";
import { sendMessage } from "@/lib/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handler("chat.send", async (req: Request) => {
  const user = await requireUser();
  await rateLimit(`chat:${user.id}`, 40, 600);
  const result = await sendMessage(user.id, await req.json().catch(() => ({})));
  return json(result);
});
