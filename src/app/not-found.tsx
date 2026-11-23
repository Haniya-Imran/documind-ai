import Link from "next/link";
import { Logo } from "@/components/Icon";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ display: "grid", gap: 14, justifyItems: "center" }}>
        <Logo size={48} />
        <h1 style={{ fontSize: 40 }}>Page not found</h1>
        <p style={{ color: "var(--soft)" }}>This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <div style={{ display: "flex", gap: 10 }}><Link className="btn btn-ink" href="/">Home</Link><Link className="btn btn-quiet" href="/dashboard">Dashboard</Link></div>
      </div>
    </main>
  );
}
