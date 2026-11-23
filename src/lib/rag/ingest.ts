import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { chunkPages, type PageText } from "./chunker";
import { detectInjection } from "./injection";
import { getProvider } from "./provider";
import { extractPages } from "./extract";
import { rowsOf } from "./access";
import { log } from "@/lib/log";

const EMBED_BATCH = 90; // stays under the Gemini free tier (100 embeddings per minute) per call

export type IngestState = { id: string; status: string; stage: string; progress: number; error?: string | null; pages: number; retryAfterMs?: number; note?: string };

/** True when the AI provider refused because of a rate limit / quota (temporary — try again later). */
export function isRateLimit(e: unknown) {
  const m = String((e as Error)?.message || e);
  return (e as { status?: number })?.status === 429 || /RESOURCE_EXHAUSTED|"code":\s*429|quota|rate.?limit/i.test(m);
}

/** Stores page texts and chunks (without embeddings yet) for a document. */
export async function storePagesAndChunks(documentId: string, pages: PageText[]) {
  const db = getDb();
  await db.delete(schema.chunks).where(eq(schema.chunks.documentId, documentId));
  await db.delete(schema.pageTexts).where(eq(schema.pageTexts.documentId, documentId));
  for (let i = 0; i < pages.length; i += 200) {
    await db.insert(schema.pageTexts).values(pages.slice(i, i + 200).map((p) => ({ documentId, page: p.page, text: p.text.normalize("NFKC") })));
  }
  const chunks = chunkPages(pages);
  for (let i = 0; i < chunks.length; i += 200) {
    await db.insert(schema.chunks).values(chunks.slice(i, i + 200).map((c) => ({
      documentId, page: c.page, idx: c.idx, section: c.section, content: c.content, flagged: detectInjection(c.content).flagged,
    })));
  }
  return chunks.length;
}

async function setDoc(id: string, values: Partial<typeof schema.documents.$inferInsert>) {
  await getDb().update(schema.documents).set(values).where(eq(schema.documents.id, id));
}

/** Embeds the next batch of chunks that don't have vectors yet. */
export async function embedNextBatch(documentId: string) {
  const db = getDb();
  const batch = await db.select({ id: schema.chunks.id, section: schema.chunks.section, content: schema.chunks.content })
    .from(schema.chunks).where(and(eq(schema.chunks.documentId, documentId), isNull(schema.chunks.embedding)))
    .orderBy(schema.chunks.idx).limit(EMBED_BATCH);
  if (!batch.length) return { done: true, embedded: 0 };
  const vectors = await getProvider().embed(batch.map((c) => (c.section ? `${c.section}\n` : "") + c.content), "document");
  const values = sql.join(batch.map((c, i) => sql`(${c.id}::uuid, ${`[${vectors[i].map((x) => x.toFixed(6)).join(",")}]`}::vector)`), sql`, `);
  await db.execute(sql`update chunks set embedding = v.e from (values ${values}) as v(id, e) where chunks.id = v.id`);
  return { done: false, embedded: batch.length };
}

async function counts(documentId: string) {
  const res = await getDb().execute(sql`select count(*)::int as total, count(embedding)::int as done from chunks where document_id = ${documentId}::uuid`);
  const r = rowsOf<{ total: number; done: number }>(res)[0] || { total: 0, done: 0 };
  return { total: Number(r.total), done: Number(r.done) };
}

/**
 * Advances processing by one bounded step (safe for serverless time limits).
 * Clients call this repeatedly until status is "ready" or "failed".
 */
export async function processStep(doc: typeof schema.documents.$inferSelect, loadBytes: () => Promise<Uint8Array>, libraryPages?: PageText[]): Promise<IngestState> {
  try {
    if (doc.status === "ready" || doc.status === "failed") return { id: doc.id, status: doc.status, stage: doc.stage, progress: doc.progress, error: doc.error, pages: doc.pages };
    if (doc.stage === "extract") {
      let pages: PageText[]; let usedOcr = false; let title: string | undefined;
      if (libraryPages) pages = libraryPages;
      else ({ pages, usedOcr, title } = await extractPages(await loadBytes()));
      const n = await storePagesAndChunks(doc.id, pages);
      const update: Partial<typeof schema.documents.$inferInsert> = { stage: "embed", progress: 5, pages: pages.length, usedOcr };
      if (title && doc.kind === "upload" && /\.pdf$/i.test(doc.title)) update.title = title;
      await setDoc(doc.id, update);
      log.info("ingest.extracted", { doc: doc.id, pages: pages.length, chunks: n, usedOcr });
      return { id: doc.id, status: "processing", stage: "embed", progress: 5, pages: pages.length };
    }
    // embed stage — one batch per call keeps us inside the AI provider's per-minute quota
    const result = await embedNextBatch(doc.id);
    const { total, done } = await counts(doc.id);
    if (result.done || (total > 0 && done >= total)) {
      await setDoc(doc.id, { status: "ready", stage: "done", progress: 100 });
      return { id: doc.id, status: "ready", stage: "done", progress: 100, pages: doc.pages };
    }
    const progress = Math.max(5, Math.min(99, Math.round((done / Math.max(1, total)) * 100)));
    await setDoc(doc.id, { progress });
    return { id: doc.id, status: "processing", stage: "embed", progress, pages: doc.pages };
  } catch (e) {
    if (isRateLimit(e)) {
      // temporary: keep the document in "processing" and ask the caller to wait, instead of failing it
      log.warn("ingest.rate_limited", { doc: doc.id, quota: (String((e as Error)?.message).match(/quotaId[^,]*?:\s*\\?"([A-Za-z-]+)/) || [])[1], message: String((e as Error)?.message).slice(0, 400) });
      await setDoc(doc.id, { error: null });
      return { id: doc.id, status: "processing", stage: doc.stage, progress: doc.progress, pages: doc.pages, retryAfterMs: 60_000, note: "Waiting for AI quota" };
    }
    const message = (e as { status?: number; message?: string })?.status ? (e as Error).message : "Processing failed. Please try uploading the PDF again.";
    log.error("ingest.failed", { doc: doc.id, message: (e as Error)?.message });
    await setDoc(doc.id, { status: "failed", error: message });
    return { id: doc.id, status: "failed", stage: doc.stage, progress: doc.progress, error: message, pages: doc.pages };
  }
}
