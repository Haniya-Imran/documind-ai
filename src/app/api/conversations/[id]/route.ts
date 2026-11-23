import { and, eq } from "drizzle-orm";
import { handler, json, requireUser } from "@/lib/api";
import { getConversation } from "@/lib/chat";
import { getDb, schema } from "@/lib/db/client";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler("conversations.get", async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  return json(await getConversation(user.id, (await ctx.params).id));
});

export const DELETE = handler("conversations.delete", async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = (await ctx.params).id;
  await getConversation(user.id, id);
  await getDb().delete(schema.conversations).where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, user.id)));
  return json({ ok: true });
});
