import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { rowsOf } from "./access";
import { rrf } from "./fusion";

export type Hit = {
  id: string; documentId: string; page: number; section: string | null; content: string; flagged: boolean;
  sim?: number; kw?: number; rrf?: number; rerank?: number;
};

type Raw = { id: string; document_id: string; page: number; section: string | null; content: string; flagged: boolean; sim?: number; kw?: number };
const toHit = (r: Raw): Hit => ({ id: r.id, documentId: r.document_id, page: Number(r.page), section: r.section, content: r.content, flagged: r.flagged, sim: r.sim == null ? undefined : Number(r.sim), kw: r.kw == null ? undefined : Number(r.kw) });

const idList = (ids: string[]) => sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);

export async function vectorSearch(vec: number[], docIds: string[], limit = 30, pageRange?: [number, number]): Promise<Hit[]> {
  const v = `[${vec.map((x) => x.toFixed(6)).join(",")}]`;
  const range = pageRange ? sql`and page between ${pageRange[0]} and ${pageRange[1]}` : sql``;
  const res = await getDb().execute(sql`
    select id, document_id, page, section, content, flagged, 1 - (embedding <=> ${v}::vector) as sim
    from chunks where document_id in (${idList(docIds)}) and embedding is not null ${range}
    order by embedding <=> ${v}::vector limit ${limit}`);
  return rowsOf<Raw>(res).map(toHit);
}

export async function keywordSearch(query: string, docIds: string[], limit = 30, pageRange?: [number, number]): Promise<Hit[]> {
  const q = query.replace(/[^\p{L}\p{N}\s"'-]/gu, " ").trim();
  if (!q) return [];
  const range = pageRange ? sql`and page between ${pageRange[0]} and ${pageRange[1]}` : sql``;
  // websearch_to_tsquery ANDs the words; fall back to OR so partial matches still count.
  const orQuery = q.split(/\s+/).filter((w) => w.length > 2).slice(0, 12).join(" or ");
  const res = await getDb().execute(sql`
    select id, document_id, page, section, content, flagged,
      ts_rank_cd(tsv, websearch_to_tsquery('english', ${orQuery || q})) as kw
    from chunks where document_id in (${idList(docIds)}) and tsv @@ websearch_to_tsquery('english', ${orQuery || q}) ${range}
    order by kw desc limit ${limit}`);
  return rowsOf<Raw>(res).map(toHit);
}

/**
 * Hybrid retrieval: vector search for every query variant + keyword search, merged with RRF.
 * When `balanced` is set (comparisons), each document gets its own share of results.
 */
export async function hybridSearch(opts: {
  queries: string[]; vectors: number[][]; docIds: string[]; limit?: number; balanced?: boolean; pageRange?: [number, number];
}): Promise<Hit[]> {
  const { queries, vectors, docIds, limit = 24, balanced, pageRange } = opts;
  const run = async (ids: string[], k: number) => {
    const lists: Hit[][] = [];
    for (const v of vectors) lists.push(await vectorSearch(v, ids, 30, pageRange));
    for (const q of queries) lists.push(await keywordSearch(q, ids, 20, pageRange));
    const sims = new Map<string, number>();
    lists.flat().forEach((h) => { if (h.sim != null) sims.set(h.id, Math.max(sims.get(h.id) ?? 0, h.sim)); });
    return rrf(lists).slice(0, k).map((h) => ({ ...h, sim: sims.get(h.id) ?? h.sim }));
  };
  if (balanced && docIds.length > 1) {
    const per = Math.max(6, Math.ceil(limit / docIds.length));
    const all = await Promise.all(docIds.map((d) => run([d], per)));
    return all.flat();
  }
  return run(docIds, limit);
}
