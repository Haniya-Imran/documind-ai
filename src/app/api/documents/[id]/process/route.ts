import { eq } from "drizzle-orm";
import { handler, json, requireUser, HttpError } from "@/lib/api";
import { getDb, schema } from "@/lib/db/client";
import { resolveDoc } from "@/lib/rag/access";
import { processStep } from "@/lib/rag/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/** Runs one processing step for the user's uploaded PDF (the browser keeps calling until ready). */
export const POST = handler("documents.process", async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const doc = await resolveDoc(user.id, (await ctx.params).id);
  if (doc.kind !== "upload") throw new HttpError(403, "Library books are prepared automatically.", "forbidden");
  // "Retry" after a failure resumes from the stage that failed
  if (new URL(req.url).searchParams.get("retry") === "1" && doc.status === "failed") {
    await getDb().update(schema.documents).set({ status: "processing", error: null }).where(eq(schema.documents.id, doc.id));
    doc.status = "processing"; doc.error = null;
  }
  const state = await processStep(doc, async () => {
    const res = await fetch(doc.fileUrl);
    if (!res.ok) throw new HttpError(502, "The uploaded file could not be read from storage.", "storage");
    return new Uint8Array(await res.arrayBuffer());
  });
  return json(state);
});
