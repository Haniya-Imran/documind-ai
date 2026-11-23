import Link from "next/link";
import { Icon, Logo } from "@/components/Icon";
import { SITE, UNSPLASH } from "@/lib/site";
import { TiltCard } from "./TiltCard";

const STAGES = [
  { t: "Ingest", items: [["Upload gateway", "signed, size-checked browser uploads"], ["PDF validation", "real PDF signature, encryption, page limits"], ["Text extraction", "page by page, original numbers kept"], ["OCR", "vision model reads scanned pages"]] },
  { t: "Structure & store", items: [["Structure recognition", "headings and chapters detected"], ["Semantic chunking", "whole sentences, never across pages"], ["Metadata", "book, page, section on every chunk"], ["Embeddings + vector DB", "pgvector in Postgres, persistent"]] },
  { t: "Retrieve", items: [["Query understanding", "follow-ups, language, intent, chapter"], ["Hybrid retrieval", "vector + keyword search, fused (RRF)"], ["Reranking", "model scores each passage 0–3"], ["Evidence check", "too weak → no answer"]] },
  { t: "Answer safely", items: [["Grounded generation", "answers only from numbered evidence"], ["Citation verification", "every [n] checked against its passage"], ["Refusal logic", "absent, insufficient, conflicting, unrelated"], ["Injection guard", "document instructions are never obeyed"]] },
];

export function Pipeline() {
  return (
    <section className="lsec paper" id="how">
      <div className="wrap">
        <div className="lhead"><span className="tag">How it works</span><h2>A 16-step pipeline behind every answer.</h2><p>DocuMind doesn&apos;t just &ldquo;chat with a PDF&rdquo;. It reads, organises, searches, checks and only then answers — and it shows you the steps.</p></div>
        <div className="pipe">
          {STAGES.map((s, i) => (
            <div className="pstage" key={s.t}>
              <h3><span>{i + 1}</span>{s.t}</h3>
              <ol style={{ ["--start" as string]: i * 4 }}>{s.items.map(([a, b]) => <li key={a}><span><b>{a}</b> — {b}</span></li>)}</ol>
            </div>
          ))}
        </div>
        <div className="tech">
          <figure className="code"><figcaption>For technical visitors · evidence check and citation verification</figcaption><pre>{`hits = hybrid_search(query, k=24)      `}<span className="c"># vector + keyword, RRF</span>{`
ranked = rerank(question, hits)        `}<span className="c"># scores 0–3</span>{`
evidence = [h for h in ranked if h.score >= 2]

`}<span className="k">if not</span>{` evidence:
    `}<span className="k">return</span>{` refuse("insufficient evidence")

answer = llm(question, evidence)       `}<span className="c"># must cite [n]</span>{`
answer = verify_citations(answer, evidence)
`}<span className="k">if not</span>{` answer.citations:
    `}<span className="k">return</span>{` refuse("unverifiable")`}</pre></figure>
          <dl className="stack">
            <div><dt>Frontend</dt><dd>Next.js App Router, React, Three.js (React Three Fiber), PDF.js reader</dd></div>
            <div><dt>Backend</dt><dd>Next.js route handlers as Vercel serverless functions</dd></div>
            <div><dt>Database</dt><dd>Neon Postgres with pgvector (HNSW) + full-text search</dd></div>
            <div><dt>Storage</dt><dd>Vercel Blob for uploaded PDFs</dd></div>
            <div><dt>AI</dt><dd>Google Gemini for embeddings, reranking, OCR and answers</dd></div>
            <div><dt>Auth</dt><dd>bcrypt password hashing, signed httpOnly sessions stored server-side</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const f = [
    { img: "1741367637708-f448e4789e9c", chip: <>“A while loop runs… while a condition is true” · <b>Python p.71</b></>, h: "Every answer has a page", p: "Book title, page number and the supporting quote with each claim. Click it to open that page." },
    { img: "1761834520785-ca17a0275f6d", chip: <span style={{ color: "#7A2E1C" }}>Not in your documents. No guess made.</span>, h: "Honest when it doesn't know", p: "Missing, weak, conflicting or unrelated evidence gets an honest explanation instead of an invented answer." },
    { img: "1769092992573-d9b4f25b5c5d", chip: <>Compared 2 books · <b>each claim cited</b></>, h: "Many PDFs, one chat", p: "Ask across several books and your own uploads at once, and see which document answered." },
  ];
  return (
    <section className="lsec" id="features">
      <div className="wrap">
        <div className="lhead"><span className="tag">Why it&apos;s different</span><h2>Answers you can check, not just trust.</h2></div>
        <div className="feats">
          {f.map((x) => (
            <TiltCard key={x.h} className="ft">
              <div className="ph" style={{ backgroundImage: `url(${UNSPLASH(x.img, 1000)})` }} />
              <div className="chip2">{x.chip}</div>
              <h3>{x.h}</h3><p>{x.p}</p>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GitHubShowcase() {
  const gh = SITE.github;
  return (
    <section className="lsec paper" id="github">
      <div className="wrap gh">
        <div className="lhead" style={{ marginBottom: 0 }}>
          <span className="tag">Open source</span>
          <h2>See how it&apos;s built.</h2>
          <p>The full source — frontend, backend, RAG pipeline, tests and evaluation — is public on GitHub.</p>
        </div>
        <div className="ghcard">
          <div className="repo"><Icon name="github" size={24} />{gh.name || "Repository coming soon"}</div>
          <p>{gh.description}</p>
          <div className="topics">{gh.topics.map((t) => <span key={t}>{t}</span>)}</div>
          {gh.url ? (
            <a className="btn btn-ink" style={{ marginTop: 20 }} href={gh.url} target="_blank" rel="noreferrer"><Icon name="github" />View on GitHub</a>
          ) : (
            <p className="hint" style={{ marginTop: 16 }}>The repository link will appear here once it is published.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const items = [
    ["Do I need to upload anything to try it?", "No. Five real books are built in. Sign up, open the library and start asking — or read any book online."],
    ["What happens if the answer isn't in the documents?", "DocuMind refuses and explains why: the information is missing, the evidence is too weak, sources conflict, or the question is unrelated."],
    ["Can it read scanned PDFs?", "Yes. If a PDF has no text layer, its pages are read with OCR (up to the first 40 pages per file)."],
    ["Which languages can I ask in?", "English, Urdu and Roman Urdu. Answers come back in the language you used, still with page citations."],
    ["Are my documents private?", "Yes. Uploaded PDFs, their search index and your conversations belong to your account only. Other users can never search or open them."],
  ];
  return (
    <section className="lsec" id="faq">
      <div className="wrap">
        <div className="lhead"><span className="tag">FAQ</span><h2>Common questions</h2></div>
        <div className="faq">{items.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="final" style={{ marginTop: 72 }}>
          <h2>Ask your first question in under a minute.</h2>
          <Link className="btn btn-amber" href="/signup">Create a free account</Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="lfoot">
      <div className="wrap">
        <Link className="brand" href="/"><Logo size={24} />DocuMind AI</Link>
        <span>Built by <strong style={{ color: "#fff" }}>{SITE.author}</strong></span>
        <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {SITE.github.url && <a href={SITE.github.url} target="_blank" rel="noreferrer">GitHub</a>}
          <a href="#library">Library</a><Link href="/signin">Sign in</Link>
        </span>
        <span style={{ fontSize: 12, width: "100%" }}>Books: OpenStax (CC BY / CC BY-NC-SA 4.0). Photos: Unsplash — Aaron Burden, Alexander Grey, Ilya Semenov, CHUTTERSNAP, Omar Flores, Francesco Ungaro, Jonathan Borba, Zoshua Colah, Marwan Haidar, Karwin Luo.</span>
      </div>
    </footer>
  );
}
