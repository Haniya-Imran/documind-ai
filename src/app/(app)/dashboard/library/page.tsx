"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { ErrorBox, SkeletonRows } from "@/components/app/States";
import { coverBg, shortFor } from "@/lib/client/books";
import type { Book } from "@/lib/client/types";
import { useApi } from "@/lib/client/useApi";

const chatUrl = (id: string, q?: string) => `/chat?docs=${id}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

function LibraryInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, error, reload } = useApi<{ books: Book[] }>("/api/library");
  const sel = data?.books.find((b) => b.slug === params.get("book"));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Library</h1><p>Five real, openly licensed textbooks. Read them online or chat with them — answers cite the exact page.</p></div>
        {sel && <button className="btn btn-quiet" onClick={() => router.push("/dashboard/library")}><Icon name="left" />All books</button>}
      </div>
      {error ? <ErrorBox message={error} onRetry={() => reload()} /> : !data ? <SkeletonRows n={2} h={200} /> : sel ? (
        <BookDetail b={sel} />
      ) : (
        <div className="books">
          {data.books.map((b) => (
            <article key={b.id} className="card book">
              <Link href={`/dashboard/library?book=${b.slug}`} className="cover" style={{ background: coverBg(b.slug), textDecoration: "none" }}>
                <small>{shortFor(b.slug)}</small><h3>{b.title}</h3>
              </Link>
              <div className="body">
                <span className="meta">{b.pages} pages · {(b.toc || []).length} chapters</span>
                {b.status !== "ready" && <span className="chip warn"><span className="spinner" style={{ width: 12, height: 12 }} />Being indexed — {b.progress}%</span>}
                <div className="acts">
                  <Link className="btn btn-ink btn-sm" href={`/read/${b.id}`}><Icon name="book" />Read</Link>
                  <Link className="btn btn-quiet btn-sm" href={chatUrl(b.id)} aria-disabled={b.status !== "ready"}><Icon name="chat" />Chat</Link>
                  <Link className="btn btn-quiet btn-sm" href={`/dashboard/library?book=${b.slug}`}>Details</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function BookDetail({ b }: { b: Book }) {
  const ready = b.status === "ready";
  return (
    <div className="card detail">
      <div className="cover" style={{ background: coverBg(b.slug) }}><small>{shortFor(b.slug)}</small><h3 style={{ fontSize: 28 }}>{b.title}</h3></div>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <div>
          <h2 style={{ fontSize: 30, fontStretch: "90%" }}>{b.title}</h2>
          {b.subtitle && <p style={{ color: "var(--soft)", marginTop: 6 }}>{b.subtitle}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="chip">{b.pages} pages</span>
          {b.topic && <span className="chip">{b.topic}</span>}
          <span className={`chip ${ready ? "ok" : "warn"}`}>{ready ? "Ready to chat" : `Being indexed — ${b.progress}%`}</span>
        </div>
        <p className="hint" style={{ fontSize: 14 }}>
          {b.authors && <>Source: {b.authors}. </>}
          {b.license && <>License: {b.licenseUrl ? <a href={b.licenseUrl} target="_blank" rel="noreferrer">{b.license}</a> : b.license}. </>}
          {b.bookUrl && <>Original: <a href={b.bookUrl} target="_blank" rel="noreferrer">openstax.org</a>.</>}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btn-ink" href={`/read/${b.id}`}><Icon name="book" />Read online</Link>
          <Link className="btn btn-amber" href={chatUrl(b.id)}><Icon name="chat" />Chat with this book</Link>
          <a className="btn btn-quiet" href={`/api/documents/${b.id}/file`} download><Icon name="down" />PDF</a>
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontStretch: "92%", marginTop: 8 }}>Chapters</h3>
          <ol className="toc">
            {(b.toc || []).map((t, i) => (
              <li key={t.title}>
                <b>{i + 1}. {t.title}</b><span>p. {t.page}</span>
                <Link className="btn btn-quiet btn-sm" href={`/read/${b.id}?page=${t.page}`}>Read</Link>
                <Link className="btn btn-quiet btn-sm" href={chatUrl(b.id, `Summarise the chapter "${t.title}"`)}>Summarise</Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return <Suspense fallback={<div className="page"><SkeletonRows n={2} h={200} /></div>}><LibraryInner /></Suspense>;
}
