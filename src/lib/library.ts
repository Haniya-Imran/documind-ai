import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import libraryMeta from "../../data/library.json";
import type { PageText } from "@/lib/rag/chunker";

export type LibraryBook = {
  slug: string; title: string; subtitle: string; topic: string; authors: string; license: string; license_url: string;
  source_url: string; book_url: string; chapters: string[]; pages: number; file: string; bytes: number; toc: { title: string; page: number }[];
};

export const LIBRARY = libraryMeta as LibraryBook[];

/** Makes sure the five built-in books exist as documents (idempotent). */
export async function ensureLibrary() {
  const db = getDb();
  const existing = await db.select({ slug: schema.documents.slug }).from(schema.documents)
    .where(and(eq(schema.documents.kind, "library"), isNull(schema.documents.ownerId)));
  const have = new Set(existing.map((e) => e.slug));
  const missing = LIBRARY.filter((b) => !have.has(b.slug));
  if (missing.length) {
    await db.insert(schema.documents).values(missing.map((b) => ({
      kind: "library", slug: b.slug, title: b.title, subtitle: b.subtitle, authors: b.authors, topic: b.topic,
      license: b.license, licenseUrl: b.license_url, sourceUrl: b.source_url, fileUrl: b.file, fileBytes: b.bytes,
      pages: b.pages, toc: b.toc, status: "processing", stage: "extract", progress: 0,
    }))).onConflictDoNothing();
  }
}

export async function libraryPages(slug: string): Promise<PageText[]> {
  const file = path.join(process.cwd(), "data", "library", `${slug}.pages.json`);
  return JSON.parse(await readFile(file, "utf8"));
}

export async function libraryPdfBytes(fileUrl: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path.join(process.cwd(), "public", fileUrl)));
}
