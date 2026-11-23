export type TocItem = { title: string; page: number };
export type Book = {
  id: string; slug: string; title: string; subtitle?: string | null; authors?: string | null; topic?: string | null; pages: number;
  license?: string | null; licenseUrl?: string | null; sourceUrl?: string | null; bookUrl?: string; toc: TocItem[] | null;
  status: string; progress: number; fileUrl?: string;
};
export type UserDoc = {
  id: string; title: string; pages: number | null; status: string; stage?: string; progress: number; error: string | null; usedOcr: boolean;
  fileBytes: number | null; createdAt: string;
};
export type Citation = { n: number; documentId: string; title: string; page: number; excerpt: string };
export type Step = { label: string; detail?: string; ms?: number };
export type Message = {
  id: string; role: "user" | "assistant"; content: string; status?: string | null; citations?: Citation[] | null; steps?: Step[] | null;
  createdAt: string; note?: string; pending?: boolean;
};
export type ConversationSummary = { id: string; title: string; documentIds: string[]; updatedAt: string };
export type Me = { id: string; name: string; email: string };
