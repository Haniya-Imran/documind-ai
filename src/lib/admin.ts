import { timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/api";

/** Admin endpoints (seeding the library, running the evaluation) need the ADMIN_TOKEN secret. */
export function requireAdmin(req: Request) {
  const expected = process.env.ADMIN_TOKEN || "";
  const given = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("token") || "";
  const a = Buffer.from(expected), b = Buffer.from(given);
  if (expected.length < 24 || a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "Admin token required.", "unauthorized");
}
