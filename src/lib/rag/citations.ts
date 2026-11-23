import { splitSentences } from "./chunker";

export type Evidence = { n: number; chunkId: string; documentId: string; title: string; page: number; section: string | null; content: string };
export type VerifiedCitation = { n: number; documentId: string; title: string; page: number; excerpt: string };

const STOP = new Set("a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those which who whom what when where why how than then so such can could should would may might will shall do does did not no yes into over under about after before between during per via your you our we they he she them his her their there here also more most less very just only".split(" "));

export function contentWords(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/(ing|ed|es|s)$/, "")),
  );
}

export function overlap(a: string, b: string): number {
  const A = contentWords(a);
  if (!A.size) return 0;
  const B = contentWords(b);
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / A.size;
}

export function bestExcerpt(chunk: string, claim: string, max = 260): string {
  const sents = splitSentences(chunk);
  if (!sents.length) return chunk.slice(0, max);
  let best = sents[0], score = -1;
  for (const s of sents) {
    const o = overlap(claim, s);
    if (o > score) { score = o; best = s; }
  }
  return best.length > max ? best.slice(0, max - 1) + "…" : best;
}

/**
 * Checks the model's [n] markers against the evidence that was actually retrieved.
 * - Drops markers that point to evidence that doesn't exist.
 * - When `lexical` is true (answer in the same language as the source), also drops
 *   a marker if the sentence shares almost no content words with that evidence.
 * - Renumbers the surviving citations 1..k in order of first use.
 */
export function verifyCitations(answer: string, evidence: Evidence[], opts: { lexical: boolean; minOverlap?: number } = { lexical: true }) {
  const byN = new Map(evidence.map((e) => [e.n, e]));
  const minOverlap = opts.minOverlap ?? 0.15;
  const order: number[] = [];
  const claimFor = new Map<number, string>();
  const dropped: number[] = [];

  // Each marker group is checked against the text written since the previous marker group,
  // which is exactly the claim the model attached it to.
  const markerRe = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let last = 0;
  let prevClaim = "";
  const rebuilt = answer.replace(markerRe, (_m, list: string, offset: number) => {
    let claim = answer.slice(last, offset).replace(markerRe, "").trim();
    last = offset + _m.length;
    if (contentWords(claim).size === 0) claim = prevClaim; // e.g. "… 1. [3]" — use the sentence before
    prevClaim = claim;
    const keep: number[] = [];
    for (const raw of list.split(",")) {
      const n = Number(raw.trim());
      const ev = byN.get(n);
      if (!ev) { dropped.push(n); continue; }
      if (opts.lexical && claim && overlap(claim, (ev.section || "") + " " + ev.content) < minOverlap) {
        dropped.push(n); continue;
      }
      if (!order.includes(n)) order.push(n);
      if (!claimFor.has(n)) claimFor.set(n, claim);
      keep.push(n);
    }
    return keep.length ? `[${keep.join(",")}]` : "";
  });

  const renumber = new Map(order.map((n, i) => [n, i + 1]));
  const text = rebuilt
    .replace(/\[(\d+(?:,\d+)*)\]/g, (_m, list: string) => `[${list.split(",").map((n) => renumber.get(Number(n))).join(",")}]`)
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const citations: VerifiedCitation[] = order.map((n) => {
    const ev = byN.get(n)!;
    return { n: renumber.get(n)!, documentId: ev.documentId, title: ev.title, page: ev.page, excerpt: bestExcerpt(ev.content, claimFor.get(n) || "") };
  });
  return { text, citations, dropped, valid: citations.length > 0 };
}
