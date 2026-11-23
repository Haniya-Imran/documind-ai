/** Retrieval metrics. `retrieved` is the ranked list of page numbers returned for a question. */
export function precisionAtK(retrieved: number[], gold: number[], k: number) {
  const top = retrieved.slice(0, k);
  if (!top.length) return 0;
  return top.filter((p) => gold.includes(p)).length / top.length;
}

export function recallAtK(retrieved: number[], gold: number[], k: number) {
  if (!gold.length) return 0;
  const top = new Set(retrieved.slice(0, k));
  return gold.filter((g) => top.has(g)).length / gold.length;
}

export function reciprocalRank(retrieved: number[], gold: number[]) {
  const i = retrieved.findIndex((p) => gold.includes(p));
  return i < 0 ? 0 : 1 / (i + 1);
}

export function summarise(rows: { retrieved: number[]; gold: number[] }[], ks = [1, 3, 5, 10]) {
  const n = rows.length || 1;
  const out: Record<string, number> = { questions: rows.length };
  for (const k of ks) {
    out[`recall@${k}`] = rows.reduce((s, r) => s + recallAtK(r.retrieved, r.gold, k), 0) / n;
    out[`precision@${k}`] = rows.reduce((s, r) => s + precisionAtK(r.retrieved, r.gold, k), 0) / n;
  }
  out.mrr = rows.reduce((s, r) => s + reciprocalRank(r.retrieved, r.gold), 0) / n;
  return out;
}
