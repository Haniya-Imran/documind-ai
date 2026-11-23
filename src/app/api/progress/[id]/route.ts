import { and, eq, sql } from "drizzle-orm";
import { handler, json, requireUser } from "@/lib/api";
import { getDb, schema } from "@/lib/db/client";
import { resolveDoc } from "@/lib/rag/access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler("progress.get", async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const doc = await resolveDoc(user.id, (await ctx.params).id);
  const [row] = await getDb().select().from(schema.readingProgress)
    .where(and(eq(schema.readingProgress.userId, user.id), eq(schema.readingProgress.documentId, doc.id))).limit(1);
  return json({ page: row?.page ?? 1 });
});

export const PUT = handler("progress.put", async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const doc = await resolveDoc(user.id, (await ctx.params).id);
  const body = await req.json().catch(() => ({}));
  const page = Math.max(1, Math.min(doc.pages || 1, Number(body.page) || 1));
  await getDb().insert(schema.readingProgress).values({ userId: user.id, documentId: doc.id, page })
    .onConflictDoUpdate({ target: [schema.readingProgress.userId, schema.readingProgress.documentId], set: { page, updatedAt: sql`now()` } });
  return json({ page });
});
