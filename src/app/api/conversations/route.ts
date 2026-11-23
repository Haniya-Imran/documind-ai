import { handler, json, requireUser } from "@/lib/api";
import { listConversations } from "@/lib/chat";

export const runtime = "nodejs";

export const GET = handler("conversations.list", async () => {
  const user = await requireUser();
  return json({ conversations: await listConversations(user.id) });
});
