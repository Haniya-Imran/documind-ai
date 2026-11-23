"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

/** Loads JSON from an API route with loading / error / reload state. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const ctl = useRef<AbortController | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!url) return;
    ctl.current?.abort();
    const c = new AbortController(); ctl.current = c;
    if (!quiet) setLoading(true);
    try {
      const d = await api<T>(url, { signal: c.signal });
      setData(d); setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as ApiError).message);
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); return () => ctl.current?.abort(); }, [load]);
  return { data, error, loading, reload: load, setData };
}
