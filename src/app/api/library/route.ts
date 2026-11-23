import { and, eq, isNull } from "drizzle-orm";
import { handler, json, requireUser } from "@/lib/api";
import { getDb, schema } from "@/lib/db/client";
import { ensureLibrary, LIBRARY } from "@/lib/library";

export const runtime = "nodejs";

export const GET = handler("library.list", async () => {
  await requireUser();
  await ensureLibrary();
  const rows = await getDb().select().from(schema.documents)
    .where(and(eq(schema.documents.kind, "library"), isNull(schema.documents.ownerId)));
  const order = LIBRARY.map((b) => b.slug);
  rows.sort((a, b) => order.indexOf(a.slug!) - order.indexOf(b.slug!));
  return json({
    books: rows.map((r) => {
      const meta = LIBRARY.find((b) => b.slug === r.slug);
      return {
        id: r.id, slug: r.slug, title: r.title, subtitle: r.subtitle, authors: r.authors, topic: r.topic, pages: r.pages,
        license: r.license, licenseUrl: r.licenseUrl, sourceUrl: r.sourceUrl, bookUrl: meta?.book_url, toc: r.toc,
        status: r.status, progress: r.progress, fileUrl: r.fileUrl,
      };
    }),
  });
});
