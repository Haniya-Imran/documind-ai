import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { handler, json, requireUser, HttpError } from "@/lib/api";
import { MAX_UPLOAD_BYTES } from "@/lib/rag/extract";

export const runtime = "nodejs";

/**
 * Issues a short-lived token so the browser can upload a PDF straight to Vercel Blob
 * (avoids the 4.5 MB serverless request limit). Only signed-in users get a token,
 * and only for PDFs under 20 MB stored under their own folder.
 */
export const POST = handler("upload.token", async (req: Request) => {
  const body = (await req.json()) as HandleUploadBody;
  if (body.type === "blob.generate-client-token") {
    const user = await requireUser();
    const path = body.payload.pathname || "";
    if (!path.startsWith(`uploads/${user.id}/`) || !/\.pdf$/i.test(path)) throw new HttpError(400, "Only PDF files can be uploaded.", "bad_path");
  }
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ["application/pdf"],
      maximumSizeInBytes: MAX_UPLOAD_BYTES,
      addRandomSuffix: true,
    }),
    onUploadCompleted: async () => { /* the client registers the file via POST /api/documents */ },
  });
  return json(result);
});
