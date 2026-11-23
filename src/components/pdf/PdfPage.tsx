"use client";
import "react-pdf/dist/Page/TextLayer.css";
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Props = {
  file: string; page: number; width: number; textLayer?: boolean;
  onLoad?: (numPages: number) => void; highlight?: string;
};

/** Renders one page of a PDF (client-only). Shared by the reader and the citation preview. */
export default function PdfPage({ file, page, width, textLayer = false, onLoad, highlight }: Props) {
  const [err, setErr] = useState<string | null>(null);
  // short highlight = a search term (match it anywhere); long = a cited excerpt (match lines that are part of it)
  const hl = (highlight || "").toLowerCase().replace(/[…"“”]/g, " ").replace(/\s+/g, " ").trim();
  const isTerm = hl.length > 0 && hl.split(" ").length <= 4;
  const matches = (str: string) => {
    const t = str.toLowerCase().replace(/\s+/g, " ").trim();
    if (!t || !hl) return false;
    return isTerm ? t.includes(hl) : t.length > 10 && hl.includes(t);
  };
  return (
    <Document
      file={file}
      onLoadSuccess={(d) => { setErr(null); onLoad?.(d.numPages); }}
      onLoadError={() => setErr("This PDF couldn't be loaded. Check your connection and try again.")}
      loading={<div className="skeleton" style={{ width, height: width * 1.3 }} />}
      error={<div className="banner bad" style={{ width }}>{err || "This PDF couldn't be loaded."}</div>}
    >
      <Page
        pageNumber={page}
        width={width}
        renderTextLayer={textLayer}
        renderAnnotationLayer={false}
        loading={<div className="skeleton" style={{ width, height: width * 1.3 }} />}
        customTextRenderer={hl ? ({ str }) => (matches(str) ? `<mark>${escapeHtml(str)}</mark>` : escapeHtml(str)) : undefined}
      />
    </Document>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
