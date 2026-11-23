import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import { setDbForTests } from "@/lib/db/client";
import { setProviderForTests, type AIProvider } from "@/lib/rag/provider";
import { contentWords } from "@/lib/rag/citations";

/** Fresh in-memory Postgres (with pgvector) running the real migration SQL. */
export async function freshDb() {
  const pg = new PGlite({ extensions: { vector } });
  const sqlText = readFileSync(path.join(__dirname, "..", "drizzle", "0000_init.sql"), "utf8");
  for (const stmt of sqlText.split("--> statement-breakpoint")) {
    if (stmt.trim()) await pg.exec(stmt);
  }
  const db = drizzle(pg, { schema });
  setDbForTests(db);
  return { pg, db };
}

/** Deterministic bag-of-words embedding so tests can exercise vector search without an API. */
export function fakeEmbed(text: string, dim = 768): number[] {
  const v = new Array(dim).fill(0);
  for (const w of contentWords(text)) {
    let h = 2166136261;
    for (const ch of w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    v[Math.abs(h) % dim] += 1;
  }
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/**
 * Test double for the AI provider (only used in tests — production calls Gemini).
 * It behaves like a careful model: rewrites nothing, reranks by word overlap,
 * answers with the best-matching evidence sentence and a [n] citation, or says "insufficient".
 */
export function fakeProvider(overrides: Partial<{ answer: (prompt: string) => unknown; understand: (prompt: string) => unknown }> = {}): AIProvider {
  return {
    async embed(texts) { return texts.map((t) => fakeEmbed(t)); },
    async ocrPdf() { return [{ page: 1, text: "Scanned page text about photosynthesis in green plants and sunlight energy." }]; },
    async json<T>(task: string, _system: string, prompt: string): Promise<T> {
      if (task === "understand") {
        if (overrides.understand) return overrides.understand(prompt) as T;
        const q = prompt.split("Latest user message:")[1]?.trim() || "";
        const summary = /summar/i.test(q);
        const chapter = q.match(/chapter\s+["“]?([^"”?]+)["”]?/i)?.[1];
        return { standalone: q, searchQueries: [q], language: /\b(kya|hai|kitna)\b/i.test(q) ? "roman-ur" : "en", intent: summary ? "summary" : /compare/i.test(q) ? "compare" : "qa", chapter: chapter ? { chapterTitle: chapter.trim() } : null, related: true } as T;
      }
      if (task === "rerank") {
        const question = prompt.split("\n")[0].replace("Question:", "");
        const passages = prompt.split(/\n\nPassage \d+ /).slice(1);
        const q = contentWords(question);
        return { scores: passages.map((p, i) => { const w = contentWords(p); let hit = 0; for (const x of q) if (w.has(x)) hit++; const r = q.size ? hit / q.size : 0; return { i: i + 1, s: r >= 0.5 ? 3 : r >= 0.3 ? 2 : r > 0 ? 1 : 0 }; }) } as T;
      }
      if (task === "answer") {
        if (overrides.answer) return overrides.answer(prompt) as T;
        const passages = [...prompt.matchAll(/<passage n="(\d+)"[^>]*>\n([\s\S]*?)\n<\/passage>/g)];
        if (!passages.length) return { status: "insufficient", answer: "", note: "" } as T;
        // pick the sentence that best matches the question, like a careful model would
        const question = contentWords(prompt.split("Question:").pop() || "");
        let best = { n: passages[0][1], sentence: passages[0][2].split(/(?<=[.!?])\s+/)[0], score: -1 };
        for (const [, n, text] of passages) for (const sentence of text.split(/(?<=[.!?])\s+/)) {
          const w = contentWords(sentence); let hit = 0; for (const x of question) if (w.has(x)) hit++;
          if (hit > best.score) best = { n, sentence, score: hit };
        }
        return { status: "answered", answer: `${best.sentence} [${best.n}]`, note: "" } as T;
      }
      throw new Error("unknown task " + task);
    },
  };
}

export function useFakeProvider(p = fakeProvider()) { setProviderForTests(p); return p; }

/** Simulates the browser cookie jar for route-handler tests (next/headers is mocked in tests/setup.ts). */
export const cookieJar: Map<string, string> = (globalThis as unknown as { __cookieJar: Map<string, string> }).__cookieJar;

export function captureCookie(res: Response) {
  const set = res.headers.get("set-cookie") || "";
  const m = set.match(/dm_session=([^;]*)/);
  if (m) { if (m[1]) cookieJar.set("dm_session", m[1]); else cookieJar.delete("dm_session"); }
}

export function req(url: string, body?: unknown, method = body ? "POST" : "GET", headers: Record<string, string> = {}) {
  return new Request("http://localhost" + url, {
    method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined,
  });
}
