import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * One shared database handle. In production this is Neon Postgres over HTTP
 * (works inside Vercel serverless functions). Tests inject an in-memory
 * PGlite database through setDbForTests().
 */
type Db = ReturnType<typeof drizzleNeon<typeof schema>>;
let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  // Local preview only (scripts/local-preview.mjs injects an embedded Postgres). Never set on Vercel.
  const local = (globalThis as { __DOCUMIND_LOCAL_DB__?: Db }).__DOCUMIND_LOCAL_DB__;
  if (local) return local;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Connect a Postgres database (Neon) in Vercel.");
  db = drizzleNeon(neon(url), { schema });
  return db;
}

export function setDbForTests(testDb: unknown) {
  db = testDb as Db;
}

export { schema };
