// Applies SQL migrations in ./drizzle to the Postgres database in DATABASE_URL.
// Runs during the Vercel build (see "vercel-build" in package.json).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}
const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("[migrate] database is up to date.");
