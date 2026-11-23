import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { freshDb, req, captureCookie, cookieJar } from "./helpers";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as signin } from "@/app/api/auth/signin/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me, PATCH as updateMe } from "@/app/api/auth/me/route";
import { GET as listDocs } from "@/app/api/documents/route";

describe("authentication API", () => {
  let pg: Awaited<ReturnType<typeof freshDb>>["pg"];
  beforeAll(async () => { ({ pg } = await freshDb()); });
  beforeEach(() => cookieJar.clear());

  it("signs up, stores a hashed password and sets a secure session cookie", async () => {
    const res = await signup(req("/api/auth/signup", { name: "Haniya", email: "Haniya@Example.com", password: "strongpass1" }));
    expect(res.status).toBe(201);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/dm_session=/);
    expect(cookie.toLowerCase()).toContain("httponly");
    const row = await pg.query<{ password_hash: string; email: string }>("select password_hash, email from users");
    expect(row.rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(row.rows[0].password_hash).not.toContain("strongpass1");
    expect(row.rows[0].email).toBe("haniya@example.com");
  });

  it("rejects a duplicate email (case-insensitive)", async () => {
    const res = await signup(req("/api/auth/signup", { name: "Other", email: "HANIYA@example.com", password: "strongpass1" }));
    expect(res.status).toBe(409);
  });

  it("validates input", async () => {
    const res = await signup(req("/api/auth/signup", { name: "A", email: "bad", password: "x" }));
    expect(res.status).toBe(400);
  });

  it("rejects a wrong password with a generic message", async () => {
    const res = await signin(req("/api/auth/signin", { email: "haniya@example.com", password: "wrongpass1" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Email or password is incorrect.");
    const res2 = await signin(req("/api/auth/signin", { email: "nobody@example.com", password: "wrongpass1" }));
    expect((await res2.json()).error).toBe("Email or password is incorrect.");
  });

  it("signs in, reads the profile, then logs out and loses access", async () => {
    const res = await signin(req("/api/auth/signin", { email: "haniya@example.com", password: "strongpass1" }));
    expect(res.status).toBe(200);
    captureCookie(res);
    const prof = await me();
    expect(prof.status).toBe(200);
    expect((await prof.json()).user.name).toBe("Haniya");
    const out = await logout();
    captureCookie(out);
    // the old token must not work even if replayed
    const sessions = await pg.query("select count(*)::int as n from sessions");
    expect(sessions.rows.length).toBe(1);
    expect((await me()).status).toBe(401);
  });

  it("blocks protected endpoints without a session", async () => {
    expect((await listDocs()).status).toBe(401);
  });

  it("revokes a session server-side even if the cookie is kept", async () => {
    const res = await signin(req("/api/auth/signin", { email: "haniya@example.com", password: "strongpass1" }));
    captureCookie(res);
    const token = cookieJar.get("dm_session")!;
    await logout();
    cookieJar.set("dm_session", token); // attacker replays the old cookie
    expect((await me()).status).toBe(401);
  });

  it("changes the password and requires the current one", async () => {
    captureCookie(await signin(req("/api/auth/signin", { email: "haniya@example.com", password: "strongpass1" })));
    expect((await updateMe(req("/api/auth/me", { currentPassword: "nope", newPassword: "newpass123" }, "PATCH"))).status).toBe(400);
    expect((await updateMe(req("/api/auth/me", { currentPassword: "strongpass1", newPassword: "newpass123" }, "PATCH"))).status).toBe(200);
    cookieJar.clear();
    expect((await signin(req("/api/auth/signin", { email: "haniya@example.com", password: "newpass123" }))).status).toBe(200);
  });

  it("rate-limits repeated failed sign-ins", async () => {
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await signin(req("/api/auth/signin", { email: "victim@example.com", password: "guess" + i }, "POST", { "x-forwarded-for": "9.9.9.9" }))).status;
    expect(last).toBe(429);
  });
});
