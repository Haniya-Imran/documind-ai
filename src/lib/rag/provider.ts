import { GoogleGenAI } from "@google/genai";
import { EMBED_DIM } from "@/lib/db/schema";

/** The AI services the RAG pipeline needs. Production uses Google Gemini. */
export interface AIProvider {
  embed(texts: string[], kind: "document" | "query"): Promise<number[][]>;
  /** Returns parsed JSON produced by the model for the given task. */
  json<T>(task: string, system: string, prompt: string): Promise<T>;
  /** Transcribes the given pages of a (scanned) PDF; returns text per page. */
  ocrPdf(pdf: Uint8Array, fromPage: number, toPage: number): Promise<{ page: number; text: string }[]>;
}

let override: AIProvider | null = null;
export function setProviderForTests(p: AIProvider | null) { override = p; }

export function getProvider(): AIProvider {
  if (override) return override;
  // Local preview only (scripts/local-preview.mjs injects an offline stand-in). Never set on Vercel.
  const local = (globalThis as { __DOCUMIND_LOCAL_AI__?: AIProvider }).__DOCUMIND_LOCAL_AI__;
  if (local) return local;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.");
  return geminiProvider(key);
}

const GEN_MODEL = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
const EMBED_MODEL = () => process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

function normalise(v: number[]) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const msg = String((e as Error)?.message || e);
      // Quota errors (429) are not retried here: retrying immediately only uses up more of the quota.
      if (/429|RESOURCE_EXHAUSTED/i.test(msg) || !/500|503|UNAVAILABLE|deadline|fetch failed/i.test(msg)) break;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw last;
}

export function parseJsonLoose<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t) as T; } catch {
    const m = t.match(/[[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Model did not return valid JSON");
  }
}

function geminiProvider(apiKey: string): AIProvider {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async embed(texts, kind) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 90) {
        const batch = texts.slice(i, i + 90).map((t) => t.slice(0, 7000));
        const res = await withRetry(() => ai.models.embedContent({
          model: EMBED_MODEL(),
          contents: batch,
          config: { outputDimensionality: EMBED_DIM, taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT" },
        }));
        for (const e of res.embeddings ?? []) out.push(normalise(e.values ?? []));
      }
      if (out.length !== texts.length) throw new Error("Embedding count mismatch");
      return out;
    },
    async json<T>(_task: string, system: string, prompt: string) {
      const res = await withRetry(() => ai.models.generateContent({
        model: GEN_MODEL(),
        contents: prompt,
        config: { systemInstruction: system, responseMimeType: "application/json" },
      }));
      return parseJsonLoose<T>(res.text ?? "");
    },
    async ocrPdf(pdf, fromPage, toPage) {
      const res = await withRetry(() => ai.models.generateContent({
        model: GEN_MODEL(),
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: Buffer.from(pdf).toString("base64") } },
            { text: `Transcribe the text of pages ${fromPage} to ${toPage} of this PDF exactly as written. Do not summarise or add anything. Return JSON: {"pages":[{"page":<number>,"text":"..."}]}` },
          ],
        }],
        config: { responseMimeType: "application/json" },
      }));
      const data = parseJsonLoose<{ pages: { page: number; text: string }[] }>(res.text ?? "");
      return (data.pages || []).filter((p) => p.page >= fromPage && p.page <= toPage);
    },
  };
}
