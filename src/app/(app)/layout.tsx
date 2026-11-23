import "../app.css";
import { redirect } from "next/navigation";
import { Shell } from "@/components/app/Shell";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return <Shell me={{ id: user.id, name: user.name, email: user.email }}>{children}</Shell>;
}
