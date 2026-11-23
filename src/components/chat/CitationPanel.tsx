"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { PdfPage } from "@/components/pdf";
import type { Citation } from "@/lib/client/types";

export function CitationPanel({ c, onClose }: { c: Citation; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(380);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.min(560, el.clientWidth - 32)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <aside className="panel" aria-label="Source preview">
      <div className="panel-head">
        <span className="cite-chip" style={{ cursor: "default" }}>{c.n}</span>
        <b>{c.title} · page {c.page}</b>
        <button className="icon-btn" onClick={onClose} aria-label="Close source preview"><Icon name="x" /></button>
      </div>
      <div className="panel-body" ref={box}>
        <blockquote>&ldquo;{c.excerpt}&rdquo;</blockquote>
        <Link className="btn btn-ink btn-sm" href={`/read/${c.documentId}?page=${c.page}&hl=${encodeURIComponent(c.excerpt.slice(0, 120))}`}><Icon name="book" />Open page {c.page} in reader</Link>
        <PdfPage key={`${c.documentId}-${c.page}`} file={`/api/documents/${c.documentId}/file`} page={c.page} width={w} textLayer highlight={c.excerpt} />
      </div>
    </aside>
  );
}
