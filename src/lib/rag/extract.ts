import { HttpError } from "@/lib/api";
import { getProvider } from "./provider";
import type { PageText } from "./chunker";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 400;
export const OCR_PAGE_LIMIT = 40;

/** Gateway checks: real PDF signature, size limits, not encrypted, readable page count. */
export async function validatePdf(bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw new HttpError(400, "The file is empty.", "empty");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, "The PDF is larger than 20 MB.", "too_large");
  const head = new TextDecoder().decode(bytes.slice(0, 1024));
  if (!head.includes("%PDF-")) throw new HttpError(415, "This file is not a valid PDF.", "not_pdf");
  const { getDocumentProxy } = await import("unpdf");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (/password/i.test(msg)) throw new HttpError(422, "This PDF is password-protected. Please upload an unlocked copy.", "encrypted");
    throw new HttpError(422, "This PDF could not be opened. It may be damaged.", "corrupt");
  }
  if (pdf.numPages < 1) throw new HttpError(422, "This PDF has no pages.", "no_pages");
  if (pdf.numPages > MAX_PAGES) throw new HttpError(413, `This PDF has ${pdf.numPages} pages; the limit is ${MAX_PAGES}.`, "too_many_pages");
  return pdf;
}

/** Extracts text page by page, keeping original page numbers. Falls back to OCR for scanned pages. */
export async function extractPages(bytes: Uint8Array): Promise<{ pages: PageText[]; usedOcr: boolean; title?: string }> {
  const pdf = await validatePdf(bytes);
  const { extractText } = await import("unpdf");
  const { text } = await extractText(pdf, { mergePages: false });
  const pages: PageText[] = (text as string[]).map((t, i) => ({ page: i + 1, text: (t || "").trim() }));
  let title: string | undefined;
  try {
    const meta = await pdf.getMetadata();
    const info = meta?.info as { Title?: string } | undefined;
    if (info?.Title && info.Title.trim().length > 2) title = info.Title.trim().slice(0, 140);
  } catch { /* metadata is optional */ }

  const empty = pages.filter((p) => p.text.replace(/\s/g, "").length < 40);
  let usedOcr = false;
  if (empty.length / pages.length > 0.5) {
    // Scanned document: transcribe pages with the vision model, in small batches.
    const ai = getProvider();
    const limit = Math.min(pages.length, OCR_PAGE_LIMIT);
    for (let from = 1; from <= limit; from += 8) {
      const to = Math.min(limit, from + 7);
      const res = await ai.ocrPdf(bytes, from, to);
      for (const r of res) {
        const target = pages[r.page - 1];
        if (target && r.text?.trim()) target.text = r.text.trim();
      }
    }
    usedOcr = true;
  }
  const readable = pages.filter((p) => p.text.replace(/\s/g, "").length >= 40).length;
  if (!readable) throw new HttpError(422, "No readable text was found in this PDF.", "no_text");
  return { pages, usedOcr, title };
}
