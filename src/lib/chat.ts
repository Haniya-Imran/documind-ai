import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db/client";
import { HttpError } from "@/lib/api";
import { resolveDocs } from "@/lib/rag/access";
import { answerQuestion, type RagAnswer } from "@/lib/rag/answer";
import { log } from "@/lib/log";

export const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).min(1, "Choose at least one book or document.").max(6),
  message: z.string().trim().min(1, "Type a question first.").max(2000, "Please keep questions under 2000 characters."),
});

export async function getConversation(userId: string, id: string) {
  const db = getDb();
  const [conv] = await db.select().from(schema.conversations)
    .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, userId))).limit(1);
  if (!conv) throw new HttpError(404, "Conversation not found.", "not_found");
  const msgs = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, id)).orderBy(asc(schema.messages.createdAt));
  return { conversation: conv, messages: msgs };
}

export async function listConversations(userId: string) {
  return getDb().select({
    id: schema.conversations.id, title: schema.conversations.title, documentIds: schema.conversations.documentIds,
    updatedAt: schema.conversations.updatedAt,
  }).from(schema.conversations).where(eq(schema.conversations.userId, userId)).orderBy(desc(schema.conversations.updatedAt)).limit(100);
}

export async function sendMessage(userId: string, input: unknown) {
  const data = chatSchema.parse(input);
  const db = getDb();
  const docs = await resolveDocs(userId, data.documentIds, { requireReady: true });

  let conversationId = data.conversationId;
  let history: { role: "user" | "assistant"; content: string }[] = [];
  if (conversationId) {
    const { messages } = await getConversation(userId, conversationId);
    history = messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    await db.update(schema.conversations).set({ documentIds: docs.map((d) => d.id), updatedAt: sql`now()` })
      .where(eq(schema.conversations.id, conversationId));
  } else {
    const title = data.message.length > 70 ? data.message.slice(0, 67) + "…" : data.message;
    const [conv] = await db.insert(schema.conversations).values({ userId, title, documentIds: docs.map((d) => d.id) })
      .returning({ id: schema.conversations.id });
    conversationId = conv.id;
  }

  await db.insert(schema.messages).values({ conversationId, role: "user", content: data.message });
  let result: RagAnswer;
  try {
    result = await answerQuestion({ question: data.message, docs, history });
  } catch (e) {
    log.error("chat.answer_failed", { message: (e as Error)?.message });
    const limited = /429|RESOURCE_EXHAUSTED|quota/i.test(String((e as Error)?.message));
    result = { status: "error", answer: limited
      ? "The AI service is busy right now (free usage limit reached). Please wait a minute and ask again."
      : "The AI service didn't respond in time. Please try again in a moment.", citations: [], steps: [] };
  }
  const [assistant] = await db.insert(schema.messages).values({
    conversationId, role: "assistant", content: result.answer, status: result.status, citations: result.citations, steps: result.steps,
  }).returning();
  return { conversationId, message: { ...assistant, note: result.note } };
}
