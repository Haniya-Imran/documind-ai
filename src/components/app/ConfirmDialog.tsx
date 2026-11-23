"use client";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";

/** Small accessible confirmation dialog (used before logging out). */
export function ConfirmDialog({ open, title, text, confirmLabel, busy, onConfirm, onCancel }: {
  open: boolean; title: string; text: string; confirmLabel: string; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="dialog-scrim" onClick={() => !busy && onCancel()}>
      <div className="dialog card" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text" onClick={(e) => e.stopPropagation()}>
        <span className="dialog-ic"><Icon name="logout" size={22} /></span>
        <h2 id="dlg-title">{title}</h2>
        <p id="dlg-text">{text}</p>
        <div className="dialog-acts">
          <button ref={cancelRef} className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-ink" onClick={onConfirm} disabled={busy}>{busy ? <><span className="spinner" />Logging out…</> : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
