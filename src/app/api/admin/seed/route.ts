import { and, eq, isNull, sql } from "drizzle-orm";
import { handler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { getDb, schema } from "@/lib/db/client";
import { ensureLibrary, libraryPages, libraryPdfBytes } from "@/lib/library";
import { processStep } from "@/lib/rag/ingest";
import type { IngestState } from "@/lib/rag/ingest";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  // books that only failed because of a temporary AI quota limit are resumed
  await db.update(schema.documents).set({ status: "processing", error: null })
    .where(and(eq(schema.documents.kind, "library"), eq(schema.documents.status, "failed"), sql`${schema.documents.error} ~* '429|RESOURCE_EXHAUSTED|quota'`));
  const books = await db.select().from(schema.documents).where(and(eq(schema.documents.kind, "library"), isNull(schema.documents.ownerId)));
  // Extraction needs no AI, so it runs for every book; embedding runs one batch per call
  // (the free Gemini tier allows ~100 embeddings a minute), so call this about once a minute until done.
  let embedded = false;
  let last: IngestState | null = null;
  for (const book of books) {
    let current = book;
    while (current.status === "processing" && (current.stage === "extract" || !embedded)) {
      const wasEmbed = current.stage === "embed";
      last = await processStep(current, () => libraryPdfBytes(current.fileUrl), current.stage === "extract" ? await libraryPages(current.slug!) : undefined);
      if (wasEmbed) embedded = true;
      const [fresh] = await db.select().from(schema.documents).where(eq(schema.documents.id, current.id));
      current = fresh;
      if (last.retryAfterMs) break;
    }
    if (last?.retryAfterMs) break;
  }
  const after = await db.select({ slug: schema.documents.slug, status: schema.documents.status, progress: schema.documents.progress, error: schema.documents.error })
    .from(schema.documents).where(and(eq(schema.documents.kind, "library"), isNull(schema.documents.ownerId)));
  return json({ done: after.every((b) => b.status === "ready"), retryAfterMs: last?.retryAfterMs ?? (after.every((b) => b.status === "ready") ? 0 : 61_000), books: after });
}

export const POST = handler("admin.seed", run);
export const GET = handler("admin.seed", run);
