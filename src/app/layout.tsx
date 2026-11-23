import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://documind-ai.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "DocuMind AI — Ask your documents, get answers with proof", template: "%s · DocuMind AI" },
  description: "Chat with books and PDFs. DocuMind AI answers only from your documents, cites the exact page, and refuses when the evidence isn't there.",
  authors: [{ name: "Haniya Imran" }],
  creator: "Haniya Imran",
  openGraph: {
    type: "website", siteName: "DocuMind AI", title: "DocuMind AI — Evidence-based answers from your documents",
    description: "Advanced RAG: multi-PDF chat, page-level citations, refusal logic and a built-in library of five books.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "DocuMind AI" }],
  },
  twitter: { card: "summary_large_image", title: "DocuMind AI", description: "Ask your documents. Get answers you can prove.", images: ["/og-image.jpg"] },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#1C1712", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
