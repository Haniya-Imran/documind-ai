"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Empty, ErrorBox, SkeletonRows } from "@/components/app/States";
import { api, ApiError, fmtAgo } from "@/lib/client/api";
import type { Book, ConversationSummary, UserDoc } from "@/lib/client/types";
import { useApi } from "@/lib/client/useApi";

export default function HistoryPage() {
  const { data, error, reload, setData } = useApi<{ conversations: ConversationSummary[] }>("/api/conversations");
  const lib = useApi<{ books: Book[] }>("/api/library");
  const mine = useApi<{ documents: UserDoc[] }>("/api/documents");
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const names = useMemo(() => new Map<string, string>([
    ...(lib.data?.books ?? []).map((b) => [b.id, b.title] as [string, string]),
    ...(mine.data?.documents ?? []).map((d) => [d.id, d.title] as [string, string]),
  ]), [lib.data, mine.data]);

  const list = (data?.conversations ?? []).filter((c) => c.title.toLowerCase().includes(filter.toLowerCase()));

  async function remove(c: ConversationSummary) {
    if (!confirm(`Delete the conversation "${c.title}"?`)) return;
    const before = data;
    setData((d) => d && { conversations: d.conversations.filter((x) => x.id !== c.id) });
    try { await api(`/api/conversations/${c.id}`, { method: "DELETE" }); }
    catch (e) { setData(before); setNotice((e as ApiError).message); }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>History</h1><p>Every conversation is saved to your account, with its answers and citations.</p></div>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search conversations" aria-label="Search conversations" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {notice && <div style={{ marginBottom: 14 }}><ErrorBox message={notice} /></div>}
      {error ? <ErrorBox message={error} onRetry={() => reload()} /> : !data ? <SkeletonRows n={5} /> : data.conversations.length === 0 ? (
        <Empty icon="history" title="No conversations yet" text="Ask your first question and it will be saved here." action={{ href: "/chat?scope=library", label: "Start a chat" }} />
      ) : list.length === 0 ? <p className="hint">No conversations match &ldquo;{filter}&rdquo;.</p> : (
        <div className="list">
          {list.map((c) => (
            <div key={c.id} className="card row">
              <Icon name="chat" />
              <Link className="grow" href={`/chat?c=${c.id}`}>
                <b>{c.title}</b>
                <span>{c.documentIds.map((id) => names.get(id) || "Deleted document").join(" · ")} · {fmtAgo(c.updatedAt)}</span>
              </Link>
              <button className="icon-btn" onClick={() => remove(c)} aria-label={`Delete conversation ${c.title}`} title="Delete"><Icon name="trash" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
