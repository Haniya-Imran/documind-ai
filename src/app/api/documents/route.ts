import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { handler, json, requireUser, HttpError } from "@/lib/api";
import { getDb, schema } from "@/lib/db/client";
import { MAX_UPLOAD_BYTES } from "@/lib/rag/extract";

export const runtime = "nodejs";

export const GET = handler("documents.list", async () => {
  const user = await requireUser();
  const rows = await getDb().select({
    id: schema.documents.id, title: schema.documents.title, pages: schema.documents.pages, status: schema.documents.status, stage: schema.documents.stage,
    progress: schema.documents.progress, error: schema.documents.error, usedOcr: schema.documents.usedOcr,
    fileBytes: schema.documents.fileBytes, createdAt: schema.documents.createdAt,
  }).from(schema.documents).where(eq(schema.documents.ownerId, user.id)).orderBy(desc(schema.documents.createdAt));
  return json({ documents: rows });
});

const registerSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(200),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/** Registers a PDF the browser just uploaded to Blob storage. */
export const POST = handler("documents.create", async (req: Request) => {
  const user = await requireUser();
  const data = registerSchema.parse(await req.json());
  const u = new URL(data.url);
  // must be a Vercel Blob URL inside this user's own folder
  if (!u.hostname.endsWith(".blob.vercel-storage.com") || !u.pathname.startsWith(`/uploads/${user.id}/`)) {
    throw new HttpError(400, "Upload location is not valid.", "bad_url");
  }
  const count = await getDb().$count(schema.documents, eq(schema.documents.ownerId, user.id));
  if (count >= 50) throw new HttpError(400, "You can keep up to 50 documents. Delete some to upload more.", "quota");
  const title = data.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 140) || "Untitled document";
  const [doc] = await getDb().insert(schema.documents).values({
    ownerId: user.id, kind: "upload", title, fileUrl: data.url, fileBytes: data.size, status: "processing", stage: "extract",
  }).returning({ id: schema.documents.id, title: schema.documents.title, status: schema.documents.status });
  return json({ document: doc }, 201);
});
