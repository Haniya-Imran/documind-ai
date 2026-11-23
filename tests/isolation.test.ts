import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { freshDb, useFakeProvider, req, captureCookie, cookieJar } from "./helpers";
import { schema } from "@/lib/db/client";
import { processStep } from "@/lib/rag/ingest";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as listDocs, POST as registerDoc } from "@/app/api/documents/route";
import { GET as getDoc, DELETE as deleteDoc } from "@/app/api/documents/[id]/route";
import { POST as processDoc } from "@/app/api/documents/[id]/process/route";
import { GET as searchDoc } from "@/app/api/documents/[id]/search/route";
import { GET as fileDoc } from "@/app/api/documents/[id]/file/route";
import { POST as chat } from "@/app/api/chat/route";
import { GET as getConv, DELETE as delConv } from "@/app/api/conversations/[id]/route";
import { GET as listConvs } from "@/app/api/conversations/route";
import { GET as seed } from "@/app/api/admin/seed/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("user data isolation", () => {
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let tokenA = "", tokenB = "", userA = "", docA = "", convA = "";

  beforeAll(async () => {
    ({ db } = await freshDb());
    useFakeProvider();
    cookieJar.clear();
    const a = await signup(req("/api/auth/signup", { name: "Alice", email: "alice@x.co", password: "alicepass1" }));
    captureCookie(a); tokenA = cookieJar.get("dm_session")!; userA = (await a.json()).user.id;
    cookieJar.clear();
    captureCookie(await signup(req("/api/auth/signup", { name: "Bob", email: "bob@x.co", password: "bobpass12" })));
    tokenB = cookieJar.get("dm_session")!;

    // Alice owns a processed private document
    const [d] = await db.insert(schema.documents).values({ ownerId: userA, kind: "upload", title: "Alice private notes", fileUrl: `https://store.public.blob.vercel-storage.com/uploads/${userA}/a.pdf` }).returning();
    let doc = d;
    const bytes = new Uint8Array(readFileSync(path.join(__dirname, "fixtures", "injected.pdf")));
    for (let i = 0; i < 5 && doc.status === "processing"; i++) {
      await processStep(doc, async () => bytes);
      [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, doc.id));
    }
    docA = doc.id;
    cookieJar.set("dm_session", tokenA);
    const r = await chat(req("/api/chat", { documentIds: [docA], message: "How much are hotel costs reimbursed?" }));
    convA = (await r.json()).conversationId;
  });

  const asBob = () => cookieJar.set("dm_session", tokenB);

  it("Alice can see her own document and conversation", async () => {
    cookieJar.set("dm_session", tokenA);
    expect((await getDoc(req(`/api/documents/${docA}`), ctx(docA))).status).toBe(200);
    expect((await getConv(req(`/api/conversations/${convA}`), ctx(convA))).status).toBe(200);
  });

  it("Bob's document list does not include Alice's files", async () => {
    asBob();
    const body = await (await listDocs()).json();
    expect(body.documents).toEqual([]);
  });

  it("Bob cannot read, search, download, process or delete Alice's document", async () => {
    asBob();
    expect((await getDoc(req(`/api/documents/${docA}`), ctx(docA))).status).toBe(404);
    expect((await searchDoc(req(`/api/documents/${docA}/search?q=hotel`), ctx(docA))).status).toBe(404);
    expect((await fileDoc(req(`/api/documents/${docA}/file`), ctx(docA))).status).toBe(404);
    expect((await processDoc(req(`/api/documents/${docA}/process`, {}), ctx(docA))).status).toBe(404);
    expect((await deleteDoc(req(`/api/documents/${docA}`, undefined, "DELETE"), ctx(docA))).status).toBe(404);
  });

  it("Bob cannot chat with Alice's document (its vectors are never searched)", async () => {
    asBob();
    const r = await chat(req("/api/chat", { documentIds: [docA], message: "How much are hotel costs reimbursed?" }));
    expect(r.status).toBe(404);
    const msgs = await db.select().from(schema.messages);
    expect(msgs.every((m) => !/one hundred dollars/i.test(m.content) || m.conversationId === convA)).toBe(true);
  });

  it("Bob cannot open or delete Alice's conversation, and his history is empty", async () => {
    asBob();
    expect((await getConv(req(`/api/conversations/${convA}`), ctx(convA))).status).toBe(404);
    expect((await delConv(req(`/api/conversations/${convA}`, undefined, "DELETE"), ctx(convA))).status).toBe(404);
    expect((await (await listConvs()).json()).conversations).toEqual([]);
  });

  it("Bob cannot register a file stored in Alice's upload folder", async () => {
    asBob();
    const r = await registerDoc(req("/api/documents", { url: `https://store.public.blob.vercel-storage.com/uploads/${userA}/stolen.pdf`, name: "x.pdf", size: 1000 }));
    expect(r.status).toBe(400);
    const r2 = await registerDoc(req("/api/documents", { url: "https://evil.example.com/uploads/x.pdf", name: "x.pdf", size: 1000 }));
    expect(r2.status).toBe(400);
  });

  it("admin endpoints require the admin token", async () => {
    asBob();
    expect((await seed(req("/api/admin/seed"))).status).toBe(401);
    expect((await seed(req("/api/admin/seed?token=wrong-token-wrong-token-xx"))).status).toBe(401);
  });

  it("deleting an account's document removes its chunks", async () => {
    cookieJar.set("dm_session", tokenA);
    expect((await deleteDoc(req(`/api/documents/${docA}`, undefined, "DELETE"), ctx(docA))).status).toBe(200);
    const left = await db.select().from(schema.chunks).where(eq(schema.chunks.documentId, docA));
    expect(left.length).toBe(0);
  });
});
