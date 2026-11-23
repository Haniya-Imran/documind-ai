import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignIn() {
  if (await getCurrentUser().catch(() => null)) redirect("/dashboard");
  return <AuthLayout mode="signin" />;
}
