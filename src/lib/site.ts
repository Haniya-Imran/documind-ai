/** Public project details shown on the website. */
export const SITE = {
  name: "DocuMind AI",
  author: "Haniya Imran",
  // Filled in only after the repository really exists — never a guessed link.
  github: {
    url: process.env.NEXT_PUBLIC_GITHUB_REPO_URL || "",
    name: process.env.NEXT_PUBLIC_GITHUB_REPO_NAME || "",
    description: "DocuMind AI — an advanced RAG document-intelligence platform: chat with multiple PDFs, page-level citations, evidence-based refusals, hybrid search with reranking, and a built-in five-book library. Next.js + Postgres/pgvector + Gemini, deployed on Vercel.",
    topics: ["rag", "retrieval-augmented-generation", "nextjs", "pgvector", "gemini", "semantic-search", "pdf-chat", "vercel"],
  },
};

export const UNSPLASH = (id: string, w = 2200) => `https://images.unsplash.com/photo-${id}?fm=jpg&q=72&w=${w}&auto=format&fit=crop`;
