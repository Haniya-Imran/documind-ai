"use client";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/app/Shell";
import { Empty, ErrorBox, SkeletonRows } from "@/components/app/States";
import { api, ApiError, fmtBytes, fmtDate } from "@/lib/client/api";
import type { UserDoc } from "@/lib/client/types";
import { useApi } from "@/lib/client/useApi";

const MAX = 20 * 1024 * 1024;
type Uploading = { key: string; name: string; pct: number; error?: string };
type State = { status: string; stage: string; progress: number; error?: string | null; pages: number };

const STAGE: Record<string, string> = { extract: "Reading pages", ocr: "Reading scanned pages (OCR)", embed: "Building the search index", done: "Ready" };

export default function DocumentsPage() {
  const me = useMe();
  const { data, error, reload, setData } = useApi<{ documents: UserDoc[] }>("/api/documents");
  const [ups, setUps] = useState<Uploading[]>([]);
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(new Set<string>());

  const patch = useCallback((id: string, p: Partial<UserDoc>) =>
    setData((d) => d && { documents: d.documents.map((x) => (x.id === id ? { ...x, ...p } : x)) }), [setData]);

  /** Keeps calling the processing endpoint (one small step per call) until the document is ready or failed. */
  const drive = useCallback(async (id: string, retry = false) => {
    if (running.current.has(id)) return;
    running.current.add(id);
    let fails = 0;
    try {
      for (let i = 0; i < 400; i++) {
        try {
          const s = await api<State>(`/api/documents/${id}/process${retry && i === 0 ? "?retry=1" : ""}`, { method: "POST" });
          fails = 0;
          patch(id, { status: s.status, progress: s.progress, error: s.error ?? null, pages: s.pages, stage: s.stage });
          if (s.status === "ready" || s.status === "failed") return;
        } catch (e) {
          const err = e as ApiError;
          if (err.status === 404) return;
          if (err.status && err.status < 500 && err.status !== 429) { patch(id, { status: "failed", error: err.message }); return; }
          if (++fails >= 4) { patch(id, { error: "Processing paused — the server is busy. It will continue when you reopen this page." }); return; }
          await new Promise((r) => setTimeout(r, 2500 * fails));
        }
      }
    } finally { running.current.delete(id); }
  }, [patch]);

  // resume any document that was still processing (e.g. after a refresh)
  useEffect(() => { data?.documents.filter((d) => d.status === "processing").forEach((d) => drive(d.id)); }, [data?.documents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFiles(files: FileList | File[]) {
    setNotice(null);
    for (const f of Array.from(files)) {
      const key = `${f.name}-${Date.now()}-${Math.random()}`;
      if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { setNotice(`"${f.name}" isn't a PDF. Only PDF files can be uploaded.`); continue; }
      if (f.size === 0) { setNotice(`"${f.name}" is empty.`); continue; }
      if (f.size > MAX) { setNotice(`"${f.name}" is ${fmtBytes(f.size)} — the limit is 20 MB per file.`); continue; }
      setUps((u) => [...u, { key, name: f.name, pct: 0 }]);
      try {
        const safe = f.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
        const blob = await upload(`uploads/${me.id}/${safe}`, f, {
          access: "public", handleUploadUrl: "/api/upload", contentType: "application/pdf",
          onUploadProgress: (p) => setUps((u) => u.map((x) => (x.key === key ? { ...x, pct: Math.round(p.percentage) } : x))),
        });
        const { document } = await api<{ document: { id: string; title: string; status: string } }>("/api/documents", { body: { url: blob.url, name: f.name, size: f.size } });
        setUps((u) => u.filter((x) => x.key !== key));
        setData((d) => ({ documents: [{ id: document.id, title: document.title, status: "processing", progress: 0, error: null, pages: null, usedOcr: false, fileBytes: f.size, createdAt: new Date().toISOString() }, ...(d?.documents ?? [])] }));
        drive(document.id);
      } catch (e) {
        const msg = (e as Error).message || "Upload failed.";
        setUps((u) => u.map((x) => (x.key === key ? { ...x, error: /network|fetch/i.test(msg) ? "Upload failed — check your connection and try again." : msg } : x)));
      }
    }
  }

  async function remove(d: UserDoc) {
    if (!confirm(`Delete "${d.title}"? Its search index will be removed too.`)) return;
    const before = data;
    setData((x) => x && { documents: x.documents.filter((y) => y.id !== d.id) });
    try { await api(`/api/documents/${d.id}`, { method: "DELETE" }); }
    catch (e) { setData(before); setNotice((e as ApiError).message); }
  }

  const docs = data?.documents ?? [];
  const ready = docs.filter((d) => d.status === "ready");
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>My documents</h1><p>Private to your account. Upload text or scanned PDFs (up to 20 MB) and chat with them.</p></div>
        {ready.length > 0 && <Link className="btn btn-amber" href={`/chat?docs=${ready.slice(0, 6).map((d) => d.id).join(",")}`}><Icon name="chat" />Chat with my PDFs</Link>}
      </div>

      <div className={`drop${over ? " over" : ""}`} role="button" tabIndex={0}
        onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
        <div className="ic"><Icon name="upload" size={24} /></div>
        <h3>Drop PDFs here or click to choose</h3>
        <p>PDF only · max 20 MB · up to 400 pages · scanned pages are read with OCR</p>
        <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {notice && <div style={{ marginTop: 14 }}><ErrorBox message={notice} /></div>}

      <div className="list" style={{ marginTop: 22 }}>
        {ups.map((u) => (
          <div key={u.key} className="card row docrow">
            <span className="ic"><Icon name="upload" /></span>
            <div className="grow">
              <b>{u.name}</b>
              {u.error ? <span className="err">{u.error}</span> : <><span>Uploading… {u.pct}%</span><div className="progress"><i style={{ width: `${u.pct}%` }} /></div></>}
            </div>
            {u.error && <button className="icon-btn" aria-label="Dismiss" onClick={() => setUps((x) => x.filter((y) => y.key !== u.key))}><Icon name="x" /></button>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: ups.length ? 10 : 0 }}>
        {error ? <ErrorBox message={error} onRetry={() => reload()} /> : !data ? <SkeletonRows n={3} /> : docs.length === 0 && ups.length === 0 ? (
          <div style={{ marginTop: 8 }}><Empty icon="file" title="No documents yet" text="Upload a PDF above — notes, a report, a scanned chapter. It stays private to you." /></div>
        ) : (
          <div className="list">
            {docs.map((d) => <DocRow key={d.id} d={d} onDelete={() => remove(d)} onRetry={() => { patch(d.id, { status: "processing", error: null }); drive(d.id, true); }} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function DocRow({ d, onDelete, onRetry }: { d: UserDoc; onDelete: () => void; onRetry: () => void }) {
  return (
    <div className="card row docrow">
      <span className="ic"><Icon name="file" /></span>
      <div className="grow">
        {d.status === "ready" ? <Link href={`/read/${d.id}`} style={{ textDecoration: "none" }}><b>{d.title}</b></Link> : <b>{d.title}</b>}
        <span>
          {[d.pages ? `${d.pages} pages` : null, fmtBytes(d.fileBytes), d.usedOcr ? "OCR used" : null, fmtDate(d.createdAt)].filter(Boolean).join(" · ")}
        </span>
        {d.status === "processing" && (
          <>
            <div className="progress"><i style={{ width: `${Math.max(4, d.progress)}%` }} /></div>
            <span className="hint">{STAGE[d.stage || ""] || "Processing"} — {d.progress}%{d.error ? ` · ${d.error}` : ""}</span>
          </>
        )}
        {d.status === "failed" && <span className="err" style={{ display: "block" }}>{d.error || "This PDF couldn't be processed."}</span>}
      </div>
      {d.status === "ready" && <span className="chip ok"><Icon name="check" size={13} />Ready</span>}
      {d.status === "processing" && <span className="chip amber"><span className="spinner" style={{ width: 12, height: 12 }} />Indexing</span>}
      {d.status === "failed" && <button className="btn btn-quiet btn-sm" onClick={onRetry}>Retry</button>}
      {d.status === "ready" && <Link className="btn btn-quiet btn-sm" href={`/chat?docs=${d.id}`}><Icon name="chat" />Chat</Link>}
      <button className="icon-btn" onClick={onDelete} aria-label={`Delete ${d.title}`} title="Delete"><Icon name="trash" /></button>
    </div>
  );
}
