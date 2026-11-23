import { handler, requireUser, HttpError } from "@/lib/api";
import { resolveDoc } from "@/lib/rag/access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Streams an uploaded PDF to its owner only; library books redirect to their public static file. */
export const GET = handler("documents.file", async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const doc = await resolveDoc(user.id, (await ctx.params).id);
  const headers = { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600", "Content-Disposition": "inline" };
  // Library books are openly licensed static files served from the CDN.
  if (doc.kind === "library") return Response.redirect(new URL(doc.fileUrl, req.url), 302);
  const res = await fetch(doc.fileUrl);
  if (!res.ok || !res.body) throw new HttpError(502, "The file could not be loaded from storage.", "storage");
  return new Response(res.body, { headers });
});
