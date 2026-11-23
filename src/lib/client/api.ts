"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public field?: string) { super(message); }
}

/** fetch wrapper: JSON in/out, friendly errors, redirects to sign-in when the session expires. */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "You seem to be offline. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
      window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiError(res.status, data.error || "Something went wrong. Please try again.", data.code, data.field);
  }
  return data as T;
}

export const fmtBytes = (n?: number | null) => (!n ? "" : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const fmtAgo = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(d);
};
