"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ErrorBox } from "@/components/app/States";
import { PdfPage } from "@/components/pdf";
import { api, ApiError } from "@/lib/client/api";
import type { TocItem } from "@/lib/client/types";

type DocInfo = { id: string; kind: string; title: string; pages: number; toc: TocItem[] | null; status: string };
type Hit = { page: number; snippet: string; matchStart: number };

function ReaderInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [num, setNum] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [stageW, setStageW] = useState(800);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [hl, setHl] = useState(params.get("hl") || "");
  const stage = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const { document } = await api<{ document: DocInfo }>(`/api/documents/${id}`);
      setDoc(document);
      const fromUrl = Number(params.get("page"));
      if (fromUrl > 0) setPage(fromUrl);
      else {
        const p = await api<{ page: number }>(`/api/progress/${id}`).catch(() => ({ page: 1 }));
        setPage(p.page || 1);
      }
    } catch (e) { setErr((e as ApiError).message); }
  }, [id, params]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el); return () => ro.disconnect();
  }, [doc]);

  // remember where the reader is (debounced)
  useEffect(() => {
    if (!page) return;
    setPageInput(String(page));
    const t = setTimeout(() => { api(`/api/progress/${id}`, { method: "PUT", body: { page } }).catch(() => {}); }, 900);
    return () => clearTimeout(t);
  }, [page, id]);

  const total = num || doc?.pages || 1;
  const go = useCallback((p: number) => { setPage(Math.max(1, Math.min(total, p))); stage.current?.scrollTo({ top: 0 }); }, [total]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(page - 1);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [go, page]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    try { setHits((await api<{ results: Hit[] }>(`/api/documents/${id}/search?q=${encodeURIComponent(q.trim())}`)).results); setHl(q.trim()); }
    catch (e) { setErr((e as ApiError).message); }
    finally { setSearching(false); }
  }

  if (err && !doc) return <div className="page"><ErrorBox message={err} onRetry={load} /><p style={{ marginTop: 16 }}><Link href="/dashboard/library">Back to the library</Link></p></div>;
  if (!doc || !page) return <div className="page"><div className="skeleton" style={{ height: 40, maxWidth: 420, marginBottom: 20 }} /><div className="skeleton" style={{ height: "70vh", maxWidth: 760 }} /></div>;

  const toc = doc.toc || [];
  const curCh = [...toc].reverse().find((t) => t.page <= page);
  const width = Math.max(260, Math.min(1400, (Math.min(stageW - 44, 860)) * zoom));

  return (
    <div className="reader">
      <aside className={`reader-side${sideOpen ? "" : " closed"}`}>
        <button className="btn btn-quiet btn-sm rs-toggle" onClick={() => setSideOpen(!sideOpen)} aria-expanded={sideOpen}><Icon name="list" />{sideOpen ? "Hide contents & search" : "Contents & search"}</button>
        <div>
          <Link href={doc.kind === "library" ? "/dashboard/library" : "/dashboard/documents"} className="hint" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="left" size={14} />Back</Link>
          <h2 style={{ marginTop: 8 }}>{doc.title}</h2>
          <p className="hint">{total} pages</p>
        </div>
        <form onSubmit={search} className="field">
          <label htmlFor="find">Find in this document</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input id="find" className="input" style={{ minHeight: 40 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. span of control" />
            <button className="icon-btn" type="submit" aria-label="Search" disabled={searching}>{searching ? <span className="spinner" /> : <Icon name="search" />}</button>
          </div>
        </form>
        {hits && (
          <div className="results">
            <span className="hint">{hits.length ? `${hits.length} page${hits.length === 1 ? "" : "s"} found` : "No matches in this document."}</span>
            {hits.map((h) => (
              <button key={h.page} onClick={() => { go(h.page); setSideOpen(false); }}>
                <b>p. {h.page}</b>{h.snippet.slice(0, h.matchStart)}<mark>{h.snippet.slice(h.matchStart, h.matchStart + q.trim().length)}</mark>{h.snippet.slice(h.matchStart + q.trim().length)}
              </button>
            ))}
          </div>
        )}
        {toc.length > 0 && (
          <div>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Contents</h3>
            <ol className="toc" style={{ padding: 0, margin: 0 }}>
              {toc.map((t) => <li key={t.title} className={curCh?.title === t.title ? "cur" : ""} onClick={() => { go(t.page); setSideOpen(false); }}><b style={{ fontSize: 14 }}>{t.title}</b><span>{t.page}</span></li>)}
            </ol>
          </div>
        )}
      </aside>
      <div className="reader-main">
        <div className="reader-bar">
          <button className="icon-btn" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page"><Icon name="left" /></button>
          <form className="pg" onSubmit={(e) => { e.preventDefault(); go(Number(pageInput) || page); }}>
            <label htmlFor="pg" className="sr-only">Page number</label>
            <input id="pg" className="input" inputMode="numeric" value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))} onBlur={() => go(Number(pageInput) || page)} />
            <span>of {total}</span>
          </form>
          <button className="icon-btn" onClick={() => go(page + 1)} disabled={page >= total} aria-label="Next page"><Icon name="right" /></button>
          <span style={{ width: 8 }} />
          <button className="icon-btn" onClick={() => setZoom((z) => Math.max(.5, +(z - .15).toFixed(2)))} aria-label="Zoom out"><Icon name="zoomOut" /></button>
          <span className="hint" style={{ minWidth: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom((z) => Math.min(2.2, +(z + .15).toFixed(2)))} aria-label="Zoom in"><Icon name="zoomIn" /></button>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {doc.status === "ready" && <Link className="btn btn-amber btn-sm" href={`/chat?docs=${doc.id}`}><Icon name="chat" />Ask this {doc.kind === "library" ? "book" : "PDF"}</Link>}
            <a className="btn btn-quiet btn-sm" href={`/api/documents/${doc.id}/file`} download><Icon name="down" />PDF</a>
          </span>
        </div>
        <div className="reader-stage" ref={stage}>
          <PdfPage file={`/api/documents/${doc.id}/file`} page={page} width={width} textLayer onLoad={setNum} highlight={hl} />
        </div>
      </div>
    </div>
  );
}

export default function ReaderPage() {
  return <Suspense fallback={<div className="page"><div className="skeleton" style={{ height: "70vh" }} /></div>}><ReaderInner /></Suspense>;
}
