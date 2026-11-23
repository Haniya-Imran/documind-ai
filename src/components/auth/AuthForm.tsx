"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { api, ApiError } from "@/lib/client/api";

function safeNext(n: string | null) {
  // only allow same-site relative paths (prevents open-redirects)
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw) || /[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  return s;
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (mode === "signup" && name.trim().length < 2) e.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Enter a valid email";
    if (mode === "signup") {
      if (password.length < 8) e.password = "Use at least 8 characters";
      else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = "Include at least one letter and one number";
    } else if (!password) e.password = "Enter your password";
    setFieldErr(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await api(`/api/auth/${mode}`, { body: mode === "signup" ? { name, email, password } : { email, password } });
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      if (err.field) setFieldErr({ [err.field]: err.message });
      else setError(err.message);
      setBusy(false);
    }
  }

  const s = strength(password);
  return (
    <div className="auth-card">
      <div>
        <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="sub" style={{ marginTop: 8 }}>{mode === "signup" ? "Free. Five books are ready to chat with as soon as you sign up." : "Sign in to your library, documents and conversations."}</p>
      </div>
      {error && <div className="banner bad" role="alert"><Icon name="alert" />{error}</div>}
      <form onSubmit={submit} noValidate>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErr.name} aria-describedby={fieldErr.name ? "name-err" : undefined} />
            {fieldErr.name && <span id="name-err" className="err">{fieldErr.name}</span>}
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErr.email} aria-describedby={fieldErr.email ? "email-err" : undefined} />
          {fieldErr.email && <span id="email-err" className="err">{fieldErr.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="pw-wrap">
            <input id="password" className="input" type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fieldErr.password} aria-describedby="pw-help" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}><Icon name="eye" /></button>
          </div>
          {mode === "signup" && (
            <div className={`pw-meter${s >= 3 ? " good" : ""}`} aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < s ? "on" : ""} />)}</div>
          )}
          <span id="pw-help" className={fieldErr.password ? "err" : "hint"}>{fieldErr.password || (mode === "signup" ? "At least 8 characters, with a letter and a number." : "")}</span>
        </div>
        <button className="btn btn-ink" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? <><span className="spinner" />{mode === "signup" ? "Creating account…" : "Signing in…"}</> : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="alt">
        {mode === "signup" ? <>Already have an account? <Link href={`/signin${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>Sign in</Link></>
          : <>New to DocuMind? <Link href={`/signup${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>Create an account</Link></>}
      </p>
    </div>
  );
}
