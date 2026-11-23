"use client";
import dynamic from "next/dynamic";

/** pdf.js needs browser APIs, so the page renderer is loaded on the client only. */
export const PdfPage = dynamic(() => import("./PdfPage"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ width: "100%", aspectRatio: "3/4" }} />,
});
