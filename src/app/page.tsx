import "./landing.css";
import { cookies } from "next/headers";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Library3D } from "@/components/landing/Library3D";
import { Pipeline, Features, GitHubShowcase, Faq, Footer } from "@/components/landing/Sections";
import { FloatingChat } from "@/components/app/FloatingChat";

export default async function Home() {
  // Only checks whether a session cookie exists, to switch "Sign in" to "Open dashboard".
  const signedIn = Boolean((await cookies()).get("dm_session")?.value);
  return (
    <>
      <Nav signedIn={signedIn} />
      <main>
        <Hero />
        <Library3D />
        <Pipeline />
        <Features />
        <GitHubShowcase />
        <Faq />
      </main>
      <Footer />
      <FloatingChat href={signedIn ? "/chat?scope=library" : "/signup?next=%2Fchat%3Fscope%3Dlibrary"} />
    </>
  );
}
