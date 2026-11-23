import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { HttpError } from "@/lib/api";

export type DocRow = typeof schema.documents.$inferSelect;

/**
 * Returns the requested documents only if this user may use them:
 * built-in library books (no owner) or the user's own uploads.
 * Any other id is treated as "not found" so one user can never reach another user's files.
 */
export async function resolveDocs(userId: string, ids: string[], opts: { requireReady?: boolean } = {}): Promise<DocRow[]> {
  const unique = [...new Set(ids)].filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (!unique.length) throw new HttpError(400, "Choose at least one book or document.", "no_documents");
  if (unique.length > 6) throw new HttpError(400, "You can compare up to 6 documents at once.", "too_many");
  const rows = await getDb().select().from(schema.documents).where(and(
    inArray(schema.documents.id, unique),
    or(and(eq(schema.documents.kind, "library"), isNull(schema.documents.ownerId)), eq(schema.documents.ownerId, userId)),
  ));
  if (rows.length !== unique.length) throw new HttpError(404, "One of the selected documents was not found.", "not_found");
  if (opts.requireReady) {
    const notReady = rows.find((r) => r.status !== "ready");
    if (notReady) throw new HttpError(409, `“${notReady.title}” is still being processed. Please wait a moment.`, "not_ready");
  }
  return rows;
}

export async function resolveDoc(userId: string, id: string) {
  return (await resolveDocs(userId, [id]))[0];
}

export function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] })?.rows ?? []) as T[];
}
