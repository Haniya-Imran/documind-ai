"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

/** Floating "New chat" button, bottom-right on every page except the chat itself. */
export function FloatingChat({ href = "/chat?scope=library" }: { href?: string }) {
  const path = usePathname();
  if (path.startsWith("/chat")) return null;
  return (
    <Link href={href} className="fab-chat" aria-label="Start a new chat">
      <Icon name="chat" size={20} />
      <span>New chat</span>
    </Link>
  );
}
