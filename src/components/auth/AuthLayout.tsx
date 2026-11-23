import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Icon";
import { UNSPLASH } from "@/lib/site";
import { AuthForm } from "./AuthForm";
import "@/app/app.css";

export function AuthLayout({ mode }: { mode: "signin" | "signup" }) {
  return (
    <div className="auth">
      <aside className="auth-art" style={{ backgroundImage: `url(${UNSPLASH("1499447155021-4907f71b9ef5", 1600)})` }}>
        <Link className="brand" href="/"><Logo />DocuMind AI</Link>
        <blockquote>
          &ldquo;…span of control… is the number of employees the manager has the ability to supervise or control.&rdquo;
          <cite>Introduction to Business · page 68 — every answer comes with its page.</cite>
        </blockquote>
      </aside>
      <main className="auth-main">
        <Suspense fallback={<div className="spinner" />}>
          <AuthForm mode={mode} />
        </Suspense>
      </main>
    </div>
  );
}
