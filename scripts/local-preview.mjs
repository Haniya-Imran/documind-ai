// Local preview without any cloud services:
//  - embedded Postgres (PGlite + pgvector) instead of Neon
//  - an offline, deterministic stand-in for Gemini (keyword-based; answers are NOT real AI answers)
// Usage: AUTH_SECRET=... ADMIN_TOKEN=... node scripts/local-preview.mjs   (then open http://localhost:3000)
// Production on Vercel never runs this file.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import next from "next";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pg = new PGlite({ extensions: { vector } });
for (const stmt of readFileSync(path.join(root, "drizzle", "0000_init.sql"), "utf8").split("--> statement-breakpoint")) {
  if (stmt.trim()) await pg.exec(stmt);
}
globalThis.__DOCUMIND_LOCAL_DB__ = drizzle(pg);

const STOP = new Set("the a an and or of to in on for is are was were be by with as at it this that from what how why which who when does do did can into about your you".split(" "));
const words = (t) => new Set((t.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOP.has(w)));
const embed = (text) => {
  const v = new Array(768).fill(0);
  for (const w of words(text)) { let h = 2166136261; for (const c of w) h = Math.imul(h ^ c.charCodeAt(0), 16777619); v[Math.abs(h) % 768] += 1; }
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
};
globalThis.__DOCUMIND_LOCAL_AI__ = {
  async embed(texts) { return texts.map(embed); },
  async ocrPdf() { return []; },
  async json(task, _system, prompt) {
    if (task === "understand") {
      const q = prompt.split("Latest user message:")[1]?.trim() || "";
      const chapter = q.match(/chapter\s+["“]?([^"”?]+)["”]?/i)?.[1];
      const unrelated = /world cup|capital of|weather|bitcoin/i.test(q);
      return { standalone: q, searchQueries: [q], language: /\b(kya|hai|mein|ko|farq)\b/i.test(q) ? "roman-ur" : "en", intent: /summar/i.test(q) ? "summary" : /compare/i.test(q) ? "compare" : "qa", chapter: chapter ? { chapterTitle: chapter.trim() } : null, related: !unrelated };
    }
    if (task === "rerank") {
      const q = words(prompt.split("\n")[0]);
      const passages = prompt.split(/\n\nPassage \d+ /).slice(1);
      return { scores: passages.map((p, i) => { const w = words(p); let hit = 0; for (const x of q) if (w.has(x)) hit++; const r = q.size ? hit / q.size : 0; return { i: i + 1, s: r >= 0.5 ? 3 : r >= 0.3 ? 2 : r > 0 ? 1 : 0 }; }) };
    }
    if (task === "answer") {
      const passages = [...prompt.matchAll(/<passage n="(\d+)"[^>]*>\n([\s\S]*?)\n<\/passage>/g)];
      if (!passages.length) return { status: "insufficient", answer: "", note: "" };
      const q = words(prompt.split("Question:").pop() || "");
      const scored = [];
      for (const [, n, text] of passages) for (const s of text.split(/(?<=[.!?])\s+/)) {
        const w = words(s); let hit = 0; for (const x of q) if (w.has(x)) hit++;
        scored.push({ n, s, hit });
      }
      scored.sort((a, b) => b.hit - a.hit);
      const top = scored.slice(0, 2).filter((x) => x.hit > 0);
      if (!top.length) return { status: "insufficient", answer: "", note: "" };
      return { status: "answered", answer: `**Offline preview answer** (local keyword stand-in, not Gemini):\n\n${top.map((x) => `- ${x.s} [${x.n}]`).join("\n")}`, note: "" };
    }
    throw new Error("unknown task " + task);
  },
};

const app = next({ dev: process.env.PREVIEW_DEV === "1", dir: root });
await app.prepare();
const handle = app.getRequestHandler();
const port = Number(process.env.PORT || 3000);
createServer((req, res) => handle(req, res)).listen(port, () => console.log(`Local preview on http://localhost:${port}`));
