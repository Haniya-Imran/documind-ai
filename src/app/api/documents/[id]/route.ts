import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { handler, json, requireUser, HttpError } from "@/lib/api";
import { getDb, schema } from "@/lib/db/client";
import { resolveDoc } from "@/lib/rag/access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler("documents.get", async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const doc = await resolveDoc(user.id, (await ctx.params).id);
  return json({
    document: {
      id: doc.id, kind: doc.kind, title: doc.title, subtitle: doc.subtitle, authors: doc.authors, pages: doc.pages, toc: doc.toc,
      status: doc.status, progress: doc.progress, error: doc.error, license: doc.license, licenseUrl: doc.licenseUrl,
      sourceUrl: doc.sourceUrl, usedOcr: doc.usedOcr, topic: doc.topic,
    },
  });
});

export const DELETE = handler("documents.delete", async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const doc = await resolveDoc(user.id, (await ctx.params).id);
  if (doc.kind !== "upload" || doc.ownerId !== user.id) throw new HttpError(403, "Built-in library books can't be deleted.", "forbidden");
  await getDb().delete(schema.documents).where(eq(schema.documents.id, doc.id));
  try { await del(doc.fileUrl); } catch { /* file may already be gone */ }
  return json({ ok: true });
});
