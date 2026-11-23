"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: "60dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ display: "grid", gap: 14, justifyItems: "center" }}>
        <h1 style={{ fontSize: 34 }}>Something went wrong</h1>
        <p style={{ color: "var(--soft)" }}>Please try again. If it keeps happening, refresh the page.</p>
        <button className="btn btn-ink" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
