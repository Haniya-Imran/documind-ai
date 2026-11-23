"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Icon, Logo } from "@/components/Icon";
import { api } from "@/lib/client/api";
import type { Me } from "@/lib/client/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { FloatingChat } from "./FloatingChat";

const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx)!;

const NAV: { href: string; label: string; icon: string; exact?: boolean; sec?: string }[] = [
  { href: "/dashboard", label: "Overview", icon: "home", exact: true },
  { href: "/dashboard/library", label: "Library", icon: "book", sec: "Read" },
  { href: "/dashboard/documents", label: "My documents", icon: "file" },
  { href: "/chat?scope=library", label: "Chat with books", icon: "chat", sec: "Ask" },
  { href: "/chat?scope=mine", label: "Chat with my PDFs", icon: "upload" },
  { href: "/chat?scope=compare", label: "Compare documents", icon: "compare" },
  { href: "/dashboard/history", label: "History", icon: "history", sec: "Account" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export function Shell({ me, children }: { me: Me; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string | null>(null);
  const [askLogout, setAskLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => { setOpen(false); setScope(new URLSearchParams(window.location.search).get("scope")); }, [path]);

  const isActive = (n: (typeof NAV)[number]) => {
    const [p, q] = n.href.split("?");
    if (p === "/chat") return path.startsWith("/chat") && (q ? q === `scope=${scope ?? "library"}` : true);
    return n.exact ? path === p : path.startsWith(p);
  };

  async function logout() {
    setLoggingOut(true);
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* cookie is cleared either way */ }
    router.replace("/signin");
    router.refresh();
  }

  return (
    <MeCtx.Provider value={me}>
      <div className={`shell${open ? " open" : ""}`}>
        <aside className="side" aria-label="Sidebar">
          <Link className="brand" href="/"><Logo />DocuMind AI</Link>
          <nav aria-label="Dashboard">
            {NAV.map((n) => (
              <div key={n.href}>
                {n.sec && <div className="sec">{n.sec}</div>}
                <Link className="item" href={n.href} aria-current={isActive(n) ? "page" : undefined} onClick={() => setScope(n.href.split("scope=")[1] || null)}>
                  <Icon name={n.icon} />{n.label}
                </Link>
              </div>
            ))}
          </nav>
          <div className="me">
            <span className="avatar" aria-hidden="true">{me.name.trim()[0]?.toUpperCase() || "U"}</span>
            <div style={{ flex: 1, minWidth: 0 }}><b>{me.name}</b><span>{me.email}</span></div>
            <button className="item" style={{ width: "auto", padding: 8 }} onClick={() => setAskLogout(true)} aria-label="Log out" title="Log out"><Icon name="logout" /></button>
          </div>
        </aside>
        <div className="scrim" onClick={() => setOpen(false)} />
        <div className="main">
          <div className="topbar">
            <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
            <Link className="brand" href="/dashboard"><Logo size={24} />DocuMind AI</Link>
          </div>
          {children}
        </div>
      </div>
      <FloatingChat />
      <ConfirmDialog open={askLogout} title="Log out?" text="You'll need to sign in again to see your library, documents and chats." confirmLabel="Log out" busy={loggingOut} onConfirm={logout} onCancel={() => setAskLogout(false)} />
    </MeCtx.Provider>
  );
}
