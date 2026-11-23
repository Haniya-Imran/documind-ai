"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import library from "../../../data/library.json";

const Shelf = dynamic(() => import("./Shelf3D").then((m) => m.Shelf3D), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ position: "absolute", inset: 0, borderRadius: 0, opacity: .08 }} />,
});

import { BOOK_COLORS } from "@/lib/client/books";
export { BOOK_COLORS };

export function Library3D() {
  const [sel, setSel] = useState(0);
  const b = library[sel];
  return (
    <section className="lsec dark" id="library">
      <div className="wrap">
        <div className="lhead">
          <span className="tag">Built-in library</span>
          <h2>Five real books, ready to ask.</h2>
          <p>No upload needed to try DocuMind. Drag to turn the shelf, click a book to pull it out. Every book is an openly licensed OpenStax textbook — about 490 pages in total.</p>
        </div>
        <div className="lib3d">
          <div className="lib3d-stage">
            <Shelf selected={sel} onSelect={setSel} colors={BOOK_COLORS} titles={library.map((x) => x.title)} pages={library.map((x) => x.pages)} />
            <div className="lib3d-hint"><Icon name="sparkle" size={14} /> Drag to rotate · click a book</div>
          </div>
          <aside className="bookpanel" aria-live="polite">
            <div className="booktabs" role="tablist" aria-label="Books">
              {library.map((x, i) => (
                <button key={x.slug} role="tab" aria-selected={i === sel} className={i === sel ? "on" : ""} onClick={() => setSel(i)}>{x.title}</button>
              ))}
            </div>
            <h3>{b.title}</h3>
            <p className="sub">{b.subtitle}</p>
            <dl className="meta">
              <dt>Pages</dt><dd>{b.pages}</dd>
              <dt>Topic</dt><dd>{b.topic}</dd>
              <dt>Authors</dt><dd>{b.authors}</dd>
              <dt>License</dt><dd><a href={b.license_url} target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>{b.license}</a></dd>
            </dl>
            <div>
              <p style={{ color: "var(--onSoft)", fontSize: 13, marginBottom: 6 }}>Chapters</p>
              <ol>{b.toc.map((c) => <li key={c.title}>{c.title} <span style={{ color: "var(--onSoft)" }}>· p.{c.page}</span></li>)}</ol>
            </div>
            <div className="actions" style={{ marginTop: "auto" }}>
              <Link className="btn btn-amber" href="/signup">Read &amp; chat with this book</Link>
              <a className="btn btn-glass" href={b.book_url} target="_blank" rel="noreferrer">Original on OpenStax <Icon name="external" size={15} /></a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
