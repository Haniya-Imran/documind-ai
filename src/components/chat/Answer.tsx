"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/Icon";
import type { Citation, Message } from "@/lib/client/types";

const STATUS: Record<string, { label: string; cls: string }> = {
  answered: { label: "Answered from your documents", cls: "ok" },
  conflict: { label: "Sources disagree", cls: "warn" },
  insufficient: { label: "Not enough evidence — no answer given", cls: "warn" },
  unrelated: { label: "Outside these documents", cls: "warn" },
  injection: { label: "Unsafe instruction ignored", cls: "bad" },
  error: { label: "Something went wrong", cls: "bad" },
};

/** Turns [1], [2] markers into clickable citation chips. */
function linkCitations(text: string, known: Set<number>) {
  return text.replace(/\[(\d{1,2})\](?!\()/g, (m, n) => (known.has(Number(n)) ? `[${n}](#cite-${n})` : m));
}

export function Answer({ m, onCite }: { m: Message; onCite: (c: Citation) => void }) {
  const cites = m.citations || [];
  const byN = new Map(cites.map((c) => [c.n, c]));
  const st = STATUS[m.status || "answered"] || STATUS.answered;
  const refusal = ["insufficient", "unrelated", "injection"].includes(m.status || "");
  const totalMs = (m.steps || []).reduce((s, x) => s + (x.ms || 0), 0);
  return (
    <div className={`msg-a${refusal ? " refusal" : ""}${m.status === "error" ? " err" : ""}`}>
      <div className="status-line">
        <span className={`chip ${st.cls}`}>{m.status === "answered" ? <Icon name="check" size={13} /> : <Icon name={refusal ? "shield" : "alert"} size={13} />}{st.label}</span>
        {cites.length > 0 && <span>{cites.length} source{cites.length === 1 ? "" : "s"} verified</span>}
      </div>
      <div className="bubble md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          a: ({ href, children }) => {
            const n = href?.startsWith("#cite-") ? Number(href.slice(6)) : null;
            const c = n != null ? byN.get(n) : undefined;
            if (c) return <button className="cite-chip" onClick={() => onCite(c)} aria-label={`Source ${c.n}: ${c.title}, page ${c.page}`} title={`${c.title} · p.${c.page}`}>{c.n}</button>;
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
          },
        }}>{linkCitations(m.content, new Set(byN.keys()))}</ReactMarkdown>
      </div>
      {cites.length > 0 && (
        <div className="sources" aria-label="Sources">
          {cites.map((c) => (
            <button key={c.n} className="source" onClick={() => onCite(c)}>
              <span className="n">{c.n}</span>
              <span><b>{c.title}</b><p>&ldquo;{c.excerpt}&rdquo;</p></span>
              <span className="pg">p. {c.page} <Icon name="right" size={12} /></span>
            </button>
          ))}
        </div>
      )}
      {(m.steps?.length || 0) > 0 && (
        <details className="steps">
          <summary><Icon name="layers" size={14} />How this answer was made · {m.steps!.length} steps{totalMs ? ` · ${(totalMs / 1000).toFixed(1)}s` : ""}</summary>
          <ol>{m.steps!.map((s, i) => <li key={i}>{s.label}{s.detail ? <em> — {s.detail}</em> : null}{s.ms != null ? <em> ({s.ms} ms)</em> : null}</li>)}</ol>
        </details>
      )}
    </div>
  );
}
