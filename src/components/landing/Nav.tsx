"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Icon";

export function Nav({ signedIn }: { signedIn: boolean }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > window.innerHeight - 90);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`lnav${solid ? " solid" : ""}`}>
      <div className="wrap lnav-in">
        <Link className="brand" href="/"><Logo />DocuMind AI</Link>
        <nav className="lnav-links" aria-label="Main">
          <a href="#library">Library</a><a href="#how">How it works</a><a href="#features">Features</a><a href="#github">GitHub</a><a href="#faq">FAQ</a>
        </nav>
        <div className="lnav-cta" style={{ marginLeft: "auto" }}>
          {signedIn ? (
            <Link className="btn btn-amber btn-sm" href="/dashboard">Open dashboard</Link>
          ) : (
            <><Link className="signin" href="/signin">Sign in</Link><Link className="btn btn-amber btn-sm" href="/signup">Start free</Link></>
          )}
        </div>
      </div>
    </header>
  );
}
