"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Answer } from "@/components/chat/Answer";
import { CitationPanel } from "@/components/chat/CitationPanel";
import { ErrorBox } from "@/components/app/States";
import { api, ApiError } from "@/lib/client/api";
import { shortFor } from "@/lib/client/books";
import type { Book, Citation, Message, UserDoc } from "@/lib/client/types";

type Doc = { id: string; title: string; slug?: string; ready: boolean; kind: "library" | "upload"; progress: number };

const BOOK_PROMPTS: Record<string, string[]> = {
  "python-programming": ["How does a while loop work?", "Summarise the chapter \"Functions\"", "for loop aur while loop mein kya farq hai?"],
  "machine-learning": ["What is a confusion matrix?", "Explain overfitting in simple words", "Summarise the chapter \"Deep Learning and AI Basics\""],
  "data-science": ["What is the median and when is it better than the mean?", "How do you handle missing data?", "Summarise the chapter \"Collecting and Preparing Data\""],
  "business-management": ["What is span of control?", "Compare tall and flat organisational structures", "Leadership styles kaun kaun se hain?"],
  "environmental-science": ["What is net primary productivity?", "How does energy flow through a food web?", "Summarise the chapter \"Ecosystems\""],
};

function suggestions(sel: Doc[]): { tag: string; q: string }[] {
  if (sel.length > 1) return [
    { tag: "Compare", q: "Compare the main ideas of these documents." },
    { tag: "Compare", q: "What does each document say about data, and how do they differ?" },
    { tag: "Find", q: "Which document explains decision-making, and on which page?" },
    { tag: "Try a refusal", q: "Who won the 2022 football World Cup?" },
  ];
  const d = sel[0];
  if (!d) return [];
  const qs = (d.slug && BOOK_PROMPTS[d.slug]) || ["Summarise this document", "What are the key points, with pages?", "Is ko aasaan alfaaz mein samjhao"];
  return [...qs.map((q) => ({ tag: /summar/i.test(q) ? "Summary" : /[a-z]+ (mein|kya|ko|kaun)/i.test(q) ? "Roman Urdu" : "Ask", q })), { tag: "Try a refusal", q: "What is the capital of Australia?" }];
}

function ChatInner() {
  const params = useSearchParams();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [convId, setConvId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [cite, setCite] = useState<Citation | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [convLoading, setConvLoading] = useState(!!params.get("c"));
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const autoSent = useRef(false);
  const skipUrl = useRef(false); // set when we update the URL ourselves
  const scope = params.get("scope") || "library";

  // load every document the user may chat with
  const loadDocs = useCallback(async () => {
    setLoadErr(null);
    try {
      const [lib, mine] = await Promise.all([api<{ books: Book[] }>("/api/library"), api<{ documents: UserDoc[] }>("/api/documents")]);
      setDocs([
        ...lib.books.map((b) => ({ id: b.id, title: b.title, slug: b.slug, ready: b.status === "ready", kind: "library" as const, progress: b.progress })),
        ...mine.documents.map((d) => ({ id: d.id, title: d.title, ready: d.status === "ready", kind: "upload" as const, progress: d.progress })),
      ]);
    } catch (e) { setLoadErr((e as ApiError).message); }
  }, []);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  // pick the starting selection from the URL, an existing conversation, or the scope
  const urlKey = params.toString();
  useEffect(() => {
    if (!docs) return;
    if (skipUrl.current) { skipUrl.current = false; return; }
    const c = params.get("c");
    const fromUrl = (params.get("docs") || "").split(",").filter((id) => docs.some((d) => d.id === id));
    setCite(null); setSendErr(null);
    if (c) {
      setConvId(c); setConvLoading(true);
      api<{ conversation: { documentIds: string[] }; messages: Message[] }>(`/api/conversations/${c}`)
        .then((r) => { setMessages(r.messages); setSel(r.conversation.documentIds.filter((id) => docs.some((d) => d.id === id))); })
        .catch((e) => setSendErr((e as ApiError).message))
        .finally(() => setConvLoading(false));
      return;
    }
    setConvId(null); setMessages([]);
    if (fromUrl.length) { setSel(fromUrl.slice(0, 6)); return; }
    const ready = docs.filter((d) => d.ready);
    if (scope === "mine") setSel(ready.filter((d) => d.kind === "upload").slice(0, 6).map((d) => d.id));
    else if (scope === "compare") setSel(ready.filter((d) => d.kind === "library").slice(1, 3).map((d) => d.id));
    else setSel(ready.filter((d) => d.kind === "library").slice(0, 1).map((d) => d.id));
  }, [docs, urlKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, busy]);

  const selDocs = useMemo(() => (docs || []).filter((d) => sel.includes(d.id)), [docs, sel]);

  const send = useCallback(async (q: string) => {
    const message = q.trim();
    if (!message || busy) return;
    if (!sel.length) { setSendErr("Choose at least one book or document first."); setPickOpen(true); return; }
    setSendErr(null); setBusy(true); setText("");
    const tmp: Message = { id: `tmp-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, tmp]);
    try {
      const r = await api<{ conversationId: string; message: Message }>("/api/chat", { body: { conversationId: convId || undefined, documentIds: sel, message } });
      setMessages((m) => [...m, r.message]);
      if (!convId) {
        setConvId(r.conversationId);
        skipUrl.current = true;
        window.history.replaceState(null, "", `/chat?c=${r.conversationId}`);
      }
    } catch (e) {
      const err = e as ApiError;
      setMessages((m) => m.filter((x) => x.id !== tmp.id));
      setText(message);
      setSendErr(err.status === 429 ? "You're asking very quickly — please wait a minute and try again." : err.message);
    } finally { setBusy(false); taRef.current?.focus(); }
  }, [busy, sel, convId]);

  // one-click actions from the library (e.g. "Summarise chapter") arrive as ?q=
  useEffect(() => {
    const q = params.get("q");
    if (q && docs && sel.length && !autoSent.current && !params.get("c")) { autoSent.current = true; send(q); }
  }, [docs, sel, params, send]);

  function toggle(d: Doc) {
    if (!d.ready) return;
    setSel((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : s.length >= 6 ? s : [...s, d.id]));
  }

  function newChat() {
    autoSent.current = true;
    setMessages([]); setConvId(null); setCite(null);
    skipUrl.current = true;
    window.history.replaceState(null, "", `/chat?docs=${sel.join(",")}`);
  }

  const title = selDocs.length === 0 ? "Choose documents" : selDocs.length === 1 ? selDocs[0].title : `${selDocs.length} documents`;
  const uploads = (docs || []).filter((d) => d.kind === "upload");

  return (
    <div className={`chat${cite ? " with-panel" : ""}`}>
      <div className="chat-col">
        <div className="chat-head">
          <h1>{messages.length ? (messages[0].content.length > 60 ? messages[0].content.slice(0, 57) + "…" : messages[0].content) : "New conversation"}</h1>
          <div className="picker">
            <button className="btn btn-quiet btn-sm picker-btn" onClick={() => setPickOpen(!pickOpen)} aria-expanded={pickOpen} aria-haspopup="true">
              <Icon name={selDocs.length > 1 ? "compare" : "book"} /><span>{title}</span><Icon name="down" />
            </button>
            {pickOpen && (
              <div className="card picker-pop" role="dialog" aria-label="Choose documents">
                <p className="hint" style={{ padding: "4px 8px 6px" }}>Pick up to 6. Choose two or more to compare.</p>
                <h4>Library</h4>
                {(docs || []).filter((d) => d.kind === "library").map((d) => (
                  <label key={d.id} className={`pick${d.ready ? "" : " dis"}`}>
                    <input type="checkbox" checked={sel.includes(d.id)} onChange={() => toggle(d)} disabled={!d.ready} />
                    <span style={{ flex: 1 }}>{d.title}</span>{!d.ready && <span className="hint">indexing {d.progress}%</span>}
                  </label>
                ))}
                <h4>My documents</h4>
                {uploads.length === 0 ? <p className="hint" style={{ padding: "2px 8px 8px" }}>No uploads yet. <Link href="/dashboard/documents">Upload a PDF</Link></p> :
                  uploads.map((d) => (
                    <label key={d.id} className={`pick${d.ready ? "" : " dis"}`}>
                      <input type="checkbox" checked={sel.includes(d.id)} onChange={() => toggle(d)} disabled={!d.ready} />
                      <span style={{ flex: 1 }}>{d.title}</span>{!d.ready && <span className="hint">{d.progress}%</span>}
                    </label>
                  ))}
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 4px 2px" }}><button className="btn btn-ink btn-sm" onClick={() => setPickOpen(false)}>Done</button></div>
              </div>
            )}
          </div>
          {messages.length > 0 && <button className="btn btn-quiet btn-sm" onClick={newChat}><Icon name="plus" />New</button>}
        </div>

        <div className="msgs" onClick={() => pickOpen && setPickOpen(false)}>
          <div className="msgs-in">
            {loadErr && <ErrorBox message={loadErr} onRetry={loadDocs} />}
            {(convLoading || (!docs && !loadErr)) && <div className="thinking"><span className="spinner" />Loading…</div>}
            {docs && !convLoading && messages.length === 0 && (
              <div className="welcome">
                <h2>{selDocs.length > 1 ? "Ask across your documents" : selDocs[0] ? `Ask ${shortFor(selDocs[0].slug)}` : "Choose what to ask"}</h2>
                <p>{selDocs.length ? "Answers come only from the selected documents, with page citations. If the answer isn't there, DocuMind says so." :
                  scope === "mine" && !uploads.some((d) => d.ready) ? "You don't have a ready PDF yet." : "Pick one or more books or PDFs from the menu above."}</p>
                {scope === "mine" && !uploads.some((d) => d.ready) && <Link className="btn btn-ink" style={{ marginTop: 16 }} href="/dashboard/documents"><Icon name="upload" />Upload a PDF</Link>}
                {selDocs.length > 0 && (
                  <div className="suggest">{suggestions(selDocs).map((s) => <button key={s.q} onClick={() => send(s.q)} disabled={busy}><small>{s.tag}</small>{s.q}</button>)}</div>
                )}
              </div>
            )}
            {messages.map((m) => m.role === "user" ? <div key={m.id} className="msg-u">{m.content}</div> : <Answer key={m.id} m={m} onCite={setCite} />)}
            {busy && <div className="thinking" role="status"><span className="dot-pulse" />Searching {selDocs.length > 1 ? `${selDocs.length} documents` : "the document"}, checking evidence and citations…</div>}
            {sendErr && <ErrorBox message={sendErr} />}
            <div ref={endRef} />
          </div>
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <div className="composer-in">
            <label htmlFor="q" className="sr-only">Your question</label>
            <textarea id="q" ref={taRef} rows={1} value={text} maxLength={2000} placeholder={selDocs.length ? `Ask ${selDocs.length > 1 ? "these documents" : shortFor(selDocs[0].slug)} anything…` : "Choose a document first"}
              onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(180, e.target.scrollHeight)}px`; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
            <button className="send" type="submit" disabled={busy || !text.trim() || !sel.length} aria-label="Send question">{busy ? <span className="spinner" /> : <Icon name="send" />}</button>
          </div>
          <p className="hint">English, Urdu or Roman Urdu · Enter to send · click a number to see the page</p>
        </form>
      </div>
      {cite && <CitationPanel c={cite} onClose={() => setCite(null)} />}
    </div>
  );
}

export default function ChatPage() {
  return <Suspense fallback={<div className="page"><div className="thinking"><span className="spinner" />Loading…</div></div>}><ChatInner /></Suspense>;
}
