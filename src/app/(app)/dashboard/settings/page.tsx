"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/app/Shell";
import { api, ApiError } from "@/lib/client/api";

export default function SettingsPage() {
  const me = useMe();
  const router = useRouter();
  const [name, setName] = useState(me.name);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState<"name" | "pw" | "out" | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setNameMsg({ ok: false, t: "Enter at least 2 characters." });
    setBusy("name");
    try { await api("/api/auth/me", { method: "PATCH", body: { name: name.trim() } }); setNameMsg({ ok: true, t: "Name updated." }); router.refresh(); }
    catch (e) { setNameMsg({ ok: false, t: (e as ApiError).message }); }
    finally { setBusy(null); }
  }

  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return setPwMsg({ ok: false, t: "New password needs 8+ characters with a letter and a number." });
    setBusy("pw");
    try {
      await api("/api/auth/me", { method: "PATCH", body: { currentPassword: cur, newPassword: next } });
      setCur(""); setNext(""); setPwMsg({ ok: true, t: "Password changed. Other devices have been signed out." });
    } catch (e) { setPwMsg({ ok: false, t: (e as ApiError).message }); }
    finally { setBusy(null); }
  }

  async function logout() {
    setBusy("out");
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    router.replace("/signin"); router.refresh();
  }

  return (
    <div className="page">
      <div className="page-head"><div><h1>Settings</h1><p>Your profile and account security.</p></div></div>
      <div className="settings">
        <form className="card" onSubmit={saveName}>
          <h2>Profile</h2>
          <div className="field"><label htmlFor="nm">Name</label><input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
          <div className="field"><label htmlFor="em">Email</label><input id="em" className="input" value={me.email} disabled /><span className="hint">Email can&apos;t be changed.</span></div>
          {nameMsg && <div className={`banner ${nameMsg.ok ? "ok" : "bad"}`} role="status">{nameMsg.t}</div>}
          <div><button className="btn btn-ink" disabled={busy === "name"}>{busy === "name" ? <><span className="spinner" />Saving…</> : "Save name"}</button></div>
        </form>
        <form className="card" onSubmit={savePw}>
          <h2>Change password</h2>
          <div className="field"><label htmlFor="cp">Current password</label><input id="cp" className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="field"><label htmlFor="np">New password</label><input id="np" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /><span className="hint">At least 8 characters, with a letter and a number.</span></div>
          {pwMsg && <div className={`banner ${pwMsg.ok ? "ok" : "bad"}`} role="status">{pwMsg.t}</div>}
          <div><button className="btn btn-ink" disabled={busy === "pw" || !cur || !next}>{busy === "pw" ? <><span className="spinner" />Updating…</> : "Update password"}</button></div>
        </form>
        <div className="card">
          <h2>Session</h2>
          <p className="hint" style={{ fontSize: 14 }}>Signing out ends this session on this device.</p>
          <div><button className="btn btn-danger" onClick={logout} disabled={busy === "out"}><Icon name="logout" />Log out</button></div>
        </div>
      </div>
    </div>
  );
}
