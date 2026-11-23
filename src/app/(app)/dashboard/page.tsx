"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/app/Shell";
import { ErrorBox, SkeletonRows } from "@/components/app/States";
import { fmtAgo } from "@/lib/client/api";
import { coverBg, shortFor } from "@/lib/client/books";
import type { Book, ConversationSummary, UserDoc } from "@/lib/client/types";
import { useApi } from "@/lib/client/useApi";

export default function Overview() {
  const me = useMe();
  const lib = useApi<{ books: Book[] }>("/api/library");
  const docs = useApi<{ documents: UserDoc[] }>("/api/documents");
  const convs = useApi<{ conversations: ConversationSummary[] }>("/api/conversations");
  const books = lib.data?.books ?? [];
  const pages = books.reduce((s, b) => s + (b.pages || 0), 0) + (docs.data?.documents ?? []).reduce((s, d) => s + (d.pages || 0), 0);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{hello}, {me.name.split(" ")[0]}</h1><p>Ask a question, open a book, or upload your own PDF. Every answer comes with its page.</p></div>
      </div>

      <div className="grid-stats">
        <div className="card stat"><b>{lib.data ? books.length : "–"}</b><span>Library books</span></div>
        <div className="card stat"><b>{docs.data ? docs.data.documents.length : "–"}</b><span>My documents</span></div>
        <div className="card stat"><b>{convs.data ? convs.data.conversations.length : "–"}</b><span>Conversations</span></div>
        <div className="card stat"><b>{lib.data ? pages.toLocaleString() : "–"}</b><span>Searchable pages</span></div>
      </div>

      <div className="quick">
        <Link className="card" href="/chat?scope=library"><span className="ic"><Icon name="book" /></span><div><h3>Chat with a book</h3><p>Pick one of five built-in books and ask anything.</p></div></Link>
        <Link className="card" href="/dashboard/documents"><span className="ic"><Icon name="upload" /></span><div><h3>Upload a PDF</h3><p>Text or scanned — it&apos;s indexed for you in about a minute.</p></div></Link>
        <Link className="card" href="/chat?scope=compare"><span className="ic"><Icon name="compare" /></span><div><h3>Compare documents</h3><p>Ask one question across several books at once.</p></div></Link>
      </div>

      <div className="sec-title"><h2>Library</h2><Link href="/dashboard/library">See all</Link></div>
      {lib.error ? <ErrorBox message={lib.error} onRetry={() => lib.reload()} /> : !lib.data ? <SkeletonRows n={1} h={120} /> : (
        <div className="books" style={{ marginBottom: 34 }}>
          {books.map((b) => (
            <Link key={b.id} className="card book" href={`/dashboard/library?book=${b.slug}`} style={{ textDecoration: "none" }}>
              <div className="cover" style={{ background: coverBg(b.slug), aspectRatio: "16/9" }}><small>{shortFor(b.slug)}</small><h3>{b.title}</h3></div>
              <div className="body"><span className="meta">{b.pages} pages · {b.status === "ready" ? "Ready to chat" : "Preparing…"}</span></div>
            </Link>
          ))}
        </div>
      )}

      <div className="sec-title"><h2>Recent conversations</h2><Link href="/dashboard/history">History</Link></div>
      {convs.error ? <ErrorBox message={convs.error} onRetry={() => convs.reload()} /> : !convs.data ? <SkeletonRows n={3} /> :
        convs.data.conversations.length === 0 ? <p className="hint">No conversations yet — your chats will show up here.</p> : (
          <div className="list">
            {convs.data.conversations.slice(0, 5).map((c) => (
              <Link key={c.id} className="card row" href={`/chat?c=${c.id}`}>
                <Icon name="chat" />
                <div className="grow"><b>{c.title}</b><span>{c.documentIds.length} document{c.documentIds.length === 1 ? "" : "s"} · {fmtAgo(c.updatedAt)}</span></div>
                <Icon name="right" />
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
