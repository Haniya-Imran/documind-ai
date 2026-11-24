import { and, eq, isNull } from "drizzle-orm";
import { handler, json, HttpError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { getDb, schema } from "@/lib/db/client";
import { getProvider } from "@/lib/rag/provider";
import { hybridSearch, vectorSearch, keywordSearch } from "@/lib/rag/retrieve";
import { summarise } from "@/lib/rag/metrics";
import { answerQuestion } from "@/lib/rag/answer";
import evalSet from "../../../../../data/eval.json";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Runs the retrieval evaluation (Recall@K, Precision@K, MRR) and the refusal check on the live library. */
export const GET = handler("admin.eval", async (req: Request) => {
  requireAdmin(req);
  const db = getDb();
  const books = await db.select().from(schema.documents).where(and(eq(schema.documents.kind, "library"), isNull(schema.documents.ownerId)));
  const bySlug = new Map(books.map((b) => [b.slug, b]));
  const params = new URL(req.url).searchParams;
  // ?probe=<question>&book=<slug> runs one full RAG answer and returns its steps and timings
  const probe = params.get("probe");
  if (probe) {
    const book = bySlug.get(params.get("book") || "python-programming");
    if (!book) throw new HttpError(404, "Unknown book", "not_found");
    const t = Date.now();
    const r = await answerQuestion({ question: probe, docs: [book], history: [] });
    return json({ ms: Date.now() - t, ...r });
  }
  const ai = getProvider();
  type Row = { retrieved: number[]; gold: number[] };
  const rows: { hybrid: Row[]; vector: Row[]; keyword: Row[] } = { hybrid: [], vector: [], keyword: [] };
  const perQuestion: unknown[] = [];
  const vecs = await ai.embed(evalSet.retrieval.map((r) => r.q), "query");
  for (const [i, item] of evalSet.retrieval.entries()) {
    const book = bySlug.get(item.book);
    if (!book || book.status !== "ready") continue;
    const dedupe = (pages: number[]) => pages.filter((p, j) => pages.indexOf(p) === j);
    const h = dedupe((await hybridSearch({ queries: [item.q], vectors: [vecs[i]], docIds: [book.id], limit: 10 })).map((x) => x.page));
    const v = dedupe((await vectorSearch(vecs[i], [book.id], 10)).map((x) => x.page));
    const k = dedupe((await keywordSearch(item.q, [book.id], 10)).map((x) => x.page));
    rows.hybrid.push({ retrieved: h, gold: item.gold });
    rows.vector.push({ retrieved: v, gold: item.gold });
    rows.keyword.push({ retrieved: k, gold: item.gold });
    perQuestion.push({ book: item.book, q: item.q, gold: item.gold, hybridTop5: h.slice(0, 5) });
  }
  const withRefusal = params.get("refusal") === "1";
  const refusal: unknown[] = [];
  if (withRefusal) {
    for (const item of evalSet.unanswerable) {
      const book = bySlug.get(item.book);
      if (!book) continue;
      const r = await answerQuestion({ question: item.q, docs: [book], history: [] });
      refusal.push({ q: item.q, book: item.book, status: r.status, refused: r.status !== "answered" });
    }
  }
  return json({
    metrics: { hybrid: summarise(rows.hybrid), vectorOnly: summarise(rows.vector), keywordOnly: summarise(rows.keyword) },
    refusal: withRefusal ? { total: refusal.length, correctlyRefused: refusal.filter((r) => (r as { refused: boolean }).refused).length, items: refusal } : "add ?refusal=1",
    perQuestion,
  });
});
