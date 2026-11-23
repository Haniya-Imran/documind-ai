import Link from "next/link";
import { Icon } from "@/components/Icon";

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="banner bad" role="alert">
      <Icon name="alert" />
      <div style={{ flex: 1 }}>{message}</div>
      {onRetry && <button className="btn btn-quiet btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ icon = "file", title, text, action }: { icon?: string; title: string; text: string; action?: { href?: string; label: string; onClick?: () => void } }) {
  return (
    <div className="empty">
      <div style={{ width: 54, height: 54, borderRadius: 16, margin: "0 auto 14px", display: "grid", placeItems: "center", background: "var(--amberL)", color: "var(--amberD)" }}><Icon name={icon} size={24} /></div>
      <h3>{title}</h3><p>{text}</p>
      {action && (action.href
        ? <Link className="btn btn-ink" style={{ marginTop: 18 }} href={action.href}>{action.label}</Link>
        : <button className="btn btn-ink" style={{ marginTop: 18 }} onClick={action.onClick}>{action.label}</button>)}
    </div>
  );
}

export function SkeletonRows({ n = 3, h = 64 }: { n?: number; h?: number }) {
  return <div className="list" aria-busy="true" aria-label="Loading">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" style={{ height: h }} />)}</div>;
}
