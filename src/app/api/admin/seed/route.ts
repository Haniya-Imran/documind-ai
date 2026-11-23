import { and, eq, isNull } from "drizzle-orm";
import { handler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { getDb, schema } from "@/lib/db/client";
import { ensureLibrary, libraryPages, libraryPdfBytes } from "@/lib/library";
import { processStep } from "@/lib/rag/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Prepares the built-in library: creates the five book records, chunks their pages and
 * embeds them. Each call does a bounded amount of work; call again until all are "ready".
 * Pass ?reset=<slug> to re-process one book.
 */
async function run(req: Request) {
  requireAdmin(req);
  await ensureLibrary();
  const db = getDb();
  const reset = new URL(req.url).searchParams.get("reset");
  if (reset) {
    await db.update(schema.documents).set({ status: "processing", stage: "extract", progress: 0, error: null })
      .where(and(eq(schema.documents.slug, reset), eq(schema.documents.kind, "library")));
  }
  const books = await db.select().from(schema.documents).where(and(eq(schema.documents.kind, "library"), isNull(schema.documents.ownerId)));
  const started = Date.now();
  for (const book of books) {
    let current = book;
    while (current.status === "processing" && Date.now() - started < 240_000) {
      const state = await processStep(current, () => libraryPdfBytes(current.fileUrl), current.stage === "extract" ? await libraryPages(current.slug!) : undefined);
      const [fresh] = await db.select().from(schema.documents).where(eq(schema.documents.id, current.id));
      current = fresh;
      if (state.status !== "processing") break;
    }
  }
  const after = await db.select({ slug: schema.documents.slug, status: schema.documents.status, progress: schema.documents.progress, error: schema.documents.error })
    .from(schema.documents).where(and(eq(schema.documents.kind, "library"), isNull(schema.documents.ownerId)));
  return json({ done: after.every((b) => b.status === "ready"), books: after });
}

export const POST = handler("admin.seed", run);
export const GET = handler("admin.seed", run);
