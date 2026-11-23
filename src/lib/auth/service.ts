import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { HttpError } from "@/lib/api";
import { hashPassword, verifyPassword, signInSchema, signUpSchema } from "./password";
import { createSession } from "./session";

// A real hash used when the email is unknown, so sign-in takes the same time either way.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-account-password-1"));

export async function signUp(input: unknown) {
  const data = signUpSchema.parse(input);
  const db = getDb();
  const existing = await db.select({ id: schema.users.id }).from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${data.email}`).limit(1);
  if (existing.length) throw new HttpError(409, "An account with this email already exists. Try signing in.", "email_taken");
  const [user] = await db.insert(schema.users)
    .values({ name: data.name, email: data.email, passwordHash: await hashPassword(data.password) })
    .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email });
  const session = await createSession(user.id);
  return { user, ...session };
}

export async function signIn(input: unknown) {
  const data = signInSchema.parse(input);
  const db = getDb();
  const [user] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${data.email}`).limit(1);
  const ok = await verifyPassword(data.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) throw new HttpError(401, "Email or password is incorrect.", "bad_credentials");
  const session = await createSession(user.id);
  return { user: { id: user.id, name: user.name, email: user.email }, ...session };
}

export async function updateProfile(userId: string, name: string) {
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 80) throw new HttpError(400, "Name must be 2–80 characters.", "validation");
  await getDb().update(schema.users).set({ name: clean }).where(eq(schema.users.id, userId));
}

export async function changePassword(userId: string, current: string, next: string, keepSessionId: string) {
  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user || !(await verifyPassword(current, user.passwordHash))) throw new HttpError(400, "Your current password is incorrect.", "bad_password");
  const parsed = signUpSchema.shape.password.safeParse(next);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message, "validation");
  await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, userId));
  // sign out every other device
  await db.execute(sql`delete from ${schema.sessions} where user_id = ${userId} and id <> ${keepSessionId}`);
}
