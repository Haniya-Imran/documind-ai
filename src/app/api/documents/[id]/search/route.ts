import { sql } from "drizzle-orm";
import { handler, json, requireUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { resolveDoc, rowsOf } from "@/lib/rag/access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Find-in-book: returns pages containing the words, with a short snippet. */
export const GET = handler("documents.search", async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const doc = await resolveDoc(user.id, (await ctx.params).id);
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 100);
  if (q.length < 2) return json({ results: [] });
  const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
  const res = await getDb().execute(sql`
    select page, text from page_texts where document_id = ${doc.id}::uuid and text ilike ${like} order by page limit 60`);
  const lower = q.toLowerCase();
  const results = rowsOf<{ page: number; text: string }>(res).map((r) => {
    const t = r.text.replace(/\s+/g, " ");
    const i = t.toLowerCase().indexOf(lower);
    const start = Math.max(0, i - 70);
    return { page: Number(r.page), snippet: (start > 0 ? "…" : "") + t.slice(start, i + q.length + 90) + "…", matchStart: i - start + (start > 0 ? 1 : 0) };
  });
  return json({ results });
});
