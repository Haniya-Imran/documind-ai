/**
 * Structure-aware chunker.
 * - Never crosses a page boundary, so every chunk has one exact page number.
 * - Recognises headings (short title-like lines) and carries the latest heading
 *   as the chunk's `section`, even onto following pages.
 * - Packs whole paragraphs/sentences up to ~TARGET characters with a sentence
 *   overlap, so meaning isn't cut mid-thought.
 */
export type PageText = { page: number; text: string };
export type Chunk = { page: number; idx: number; section: string | null; content: string };

const TARGET = 1100;
const MIN = 200;
const OVERLAP_SENTENCES = 1;

export function isHeading(line: string): boolean {
  const l = line.trim();
  if (l.length < 3 || l.length > 90) return false;
  if (/[.,;:!?]$/.test(l) && !/^chapter\s+\d+/i.test(l)) return false;
  if (/^(page|figure|table)\s+\d+/i.test(l)) return false;
  if (/^chapter\s+\d+\b/i.test(l)) return true;
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(l)) return true;
  const words = l.split(/\s+/);
  if (words.length > 12) return false;
  const caps = words.filter((w) => /^[A-Z0-9(“"']/.test(w)).length;
  return caps / words.length >= 0.6 && /[A-Za-z]/.test(l);
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?۔])\s+(?=[A-Z0-9“"(؀-ۿ])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Photo credits ("credit: modification of work …, CC BY 2.0") are not book content — keep them out of answers.
const CREDIT_LICENSED = /\(?\bcredits?:[\s\S]{0,300}?(?:CC[ -]?BY(?:[ -](?:NC|SA|ND))*[ -]?\d\.\d|CC0(?: \d\.\d)?|[Pp]ublic [Dd]omain(?: Mark \d\.\d)?)\)?/g;
const CREDIT_PAREN = /\(credits?:[^)\n]{0,200}\)/gi;
const CREDIT_LINE = /^credits?:.*(?:\n[A-Z][a-z]+$)?/gim;

export function normalisePageText(t: string): string {
  return t
    .normalize("NFKC") // ligatures like "ﬁ" → "fi" so keyword search and quotes match
    .replace(CREDIT_LICENSED, "")
    .replace(CREDIT_PAREN, "")
    .replace(CREDIT_LINE, "")
    .replace(/­/g, "")
    .replace(/-\n(?=[a-z])/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkPages(pages: PageText[]): Chunk[] {
  const out: Chunk[] = [];
  let section: string | null = null;
  let idx = 0;
  for (const { page, text } of pages) {
    const clean = normalisePageText(text);
    if (!clean) continue;
    // Group lines into paragraphs; headings start new paragraphs and update the section.
    const paras: { heading?: string; text: string }[] = [];
    let buf: string[] = [];
    const flush = () => { if (buf.length) { paras.push({ text: buf.join(" ") }); buf = []; } };
    for (const raw of clean.split("\n")) {
      const line = raw.trim();
      if (!line) { flush(); continue; }
      if (isHeading(line) && buf.join(" ").length > 0 && buf.join(" ").length < 40 && isHeading(buf.join(" "))) {
        buf.push(line); continue; // multi-line heading
      }
      if (isHeading(line)) { flush(); paras.push({ heading: line, text: "" }); continue; }
      buf.push(line);
    }
    flush();

    let cur: string[] = [];
    let curLen = 0;
    let fresh = 0; // sentences added since the last emitted chunk (excludes overlap)
    const emit = () => {
      const content = cur.join(" ").trim();
      if (content.length >= 40) out.push({ page, idx: idx++, section, content });
      const keep = cur.slice(-OVERLAP_SENTENCES);
      cur = content.length > MIN ? keep : [];
      curLen = cur.join(" ").length;
      fresh = 0;
    };
    for (const p of paras) {
      if (p.heading) {
        if (fresh > 0 && curLen >= MIN) emit();
        section = p.heading.replace(/\s+/g, " ").slice(0, 120);
        continue;
      }
      for (const s of splitSentences(p.text)) {
        if (curLen + s.length > TARGET && curLen >= MIN) emit();
        cur.push(s);
        curLen += s.length + 1;
        fresh++;
      }
    }
    // emit the rest of the page, unless it is only the overlap carried from the previous chunk
    if (fresh > 0 && curLen >= 40) out.push({ page, idx: idx++, section, content: cur.join(" ").trim() });
  }
  return out;
}
