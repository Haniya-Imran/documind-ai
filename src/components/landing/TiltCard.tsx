"use client";
import { useRef } from "react";

export function TiltCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <article ref={ref} className={className}
      onPointerMove={(e) => {
        if (!ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = ref.current.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        ref.current.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
      }}
      onPointerLeave={() => { if (ref.current) ref.current.style.transform = ""; }}>
      {children}
    </article>
  );
}
