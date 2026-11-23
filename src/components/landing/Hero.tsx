"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { UNSPLASH } from "@/lib/site";

type Slide = {
  img: string; kind: string; meta: string; title: React.ReactNode; blurb: string; facts: string[];
  q: string; a: string; src: string; hl?: string; no?: boolean; short: string;
};

// Slides 1–5 use real questions, answers and quotes from the built-in library books.
const SLIDES: Slide[] = [
  { img: "1741367637708-f448e4789e9c", kind: "Python Programming", meta: "96 pages · built-in book", short: "Python",
    title: <>Learn Python<br /><em>by asking.</em></>, blurb: "Ask the built-in Python book anything and get a simple answer with the exact page — like a tutor who has read every chapter.",
    facts: ["Page-level citations", "Chapter summaries", "Follow-up questions"], q: "What is a while loop?",
    a: "A while loop runs a set of statements (the loop body) again and again while a condition stays true.", src: "Python Programming · p.71",
    hl: "“A while loop is a code construct that runs a set of statements… while a given condition… is true.”" },
  { img: "1562240020-ce31ccb0fa7d", kind: "Machine Learning", meta: "101 pages · built-in book", short: "Machine Learning",
    title: <>Machine learning,<br /><em>explained simply.</em></>, blurb: "From k-means to neural networks — ask for an explanation in plain words and see the page it came from.",
    facts: ["Concept explanations", "Exact quotes", "No made-up facts"], q: "What is a confusion matrix used for?",
    a: "It measures how well a classification model works by showing its correct and incorrect predictions.", src: "Machine Learning · p.24",
    hl: "“The confusion matrix is one way of quantifying and visualizing the effectiveness of a classification model.”" },
  { img: "1769092992573-d9b4f25b5c5d", kind: "Data Science", meta: "111 pages · built-in book", short: "Data Science",
    title: <>Statistics,<br /><em>with receipts.</em></>, blurb: "Means, medians, data cleaning, distributions — every answer points to the page so you can check it yourself.",
    facts: ["Cited answers", "Search inside the book", "Read online"], q: "Why use the median when there are outliers?",
    a: "Because the median looks at the middle value, extreme values don't pull it the way they pull the mean.", src: "Data Science · p.80",
    hl: "“The median is generally a better measure of the central tendency when there are outliers…”" },
  { img: "1499447155021-4907f71b9ef5", kind: "Business & Management", meta: "91 pages · built-in book", short: "Business",
    title: <>Management,<br /><em>in plain words.</em></>, blurb: "Planning, organizing, leading, controlling — ask the management book and get the definition with its page.",
    facts: ["Definitions", "Chapter summaries", "Compare books"], q: "What is span of control?",
    a: "It's the number of employees a manager is able to supervise or control.", src: "Business & Management · p.68",
    hl: "“…span of control… is the number of employees the manager has the ability to supervise or control.”" },
  { img: "1558244662-0f555a954f11", kind: "Environmental Science", meta: "90 pages · built-in book", short: "Environment",
    title: <>Ecology,<br /><em>answered back.</em></>, blurb: "Biomes, food webs, nutrient cycles — ask in English, Urdu or Roman Urdu and get the page that supports the answer.",
    facts: ["Urdu & English", "Exact page", "Online reader"], q: "Net primary productivity kya measure karti hai?",
    a: "Ye batati hai ke koi biome kitna biomass paida karta hai.", src: "Environmental Science · p.21",
    hl: "“Net primary productivity is a measure of the amount of biomass produced by a biome.”" },
  { img: "1577035474912-ea9375d9318d", kind: "Your own PDFs", meta: "Upload up to 20 MB each", short: "Your PDFs",
    title: <>Your files,<br /><em>your answers.</em></>, blurb: "Upload reports, notes or contracts. Scanned PDFs are read with OCR. Your documents stay private to your account.",
    facts: ["Multiple uploads", "OCR for scans", "Private to you"], q: "What does my uploaded policy say about travel?",
    a: "Answers come only from the files you upload, with the page of each fact.", src: "Example — your document" },
  { img: "1660188100972-4f7f9fef60d2", kind: "Compare books", meta: "Up to 6 documents at once", short: "Compare",
    title: <>Many books.<br /><em>One answer.</em></>, blurb: "Select several books or PDFs and ask a question that compares them — each claim says which book and page it came from.",
    facts: ["Multi-document search", "Book + page per claim", "Balanced evidence"], q: "Compare planning in Business with planning code in Python",
    a: "Each point in the comparison is cited to its own book and page.", src: "Example — multi-book answer" },
  { img: "1741795822895-efe35bad6761", kind: "Chapter summaries", meta: "Grounded in that chapter only", short: "Summaries",
    title: <>Whole chapters,<br /><em>in a minute.</em></>, blurb: "Ask for a summary of any chapter. DocuMind reads the pages of that chapter only and cites them.",
    facts: ["Chapter-aware", "Bullet summaries", "Cited pages"], q: "Summarise the Ecosystems chapter",
    a: "A structured summary drawn only from the chapter’s own pages, with citations.", src: "Example — chapter summary" },
  { img: "1630147351247-8d7b39d7e681", kind: "Hybrid search", meta: "Meaning + keywords + reranking", short: "Search",
    title: <>Finds the right<br /><em>passage first.</em></>, blurb: "Vector search for meaning, keyword search for exact terms, then reranking — so the evidence is the most relevant, not just similar.",
    facts: ["Semantic search", "Keyword search", "Reranking"], q: "Where does the book define accountability?",
    a: "Exact terms and meaning are both matched before an answer is written.", src: "Example — retrieval" },
  { img: "1761834520785-ca17a0275f6d", kind: "Honest by design", meta: "Evidence check before answering", short: "Refusal", no: true,
    title: <>And when it&rsquo;s<br /><em>not there?</em></>, blurb: "It says so. If the documents don't contain the answer — or a document tries to trick the AI — you get an honest refusal, not a guess.",
    facts: ["Refusal logic", "Prompt-injection guard", "Citation verification"], q: "Who won the 2022 World Cup?",
    a: "This isn't in the selected documents, so I won't guess.", src: "No evidence found" },
];

export function Hero() {
  const [cur, setCur] = useState(0);
  const [tick, setTick] = useState(0);
  const qaRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const go = useCallback((n: number) => { setCur((n + SLIDES.length) % SLIDES.length); setTick((t) => t + 1); }, []);
  const s = SLIDES[cur];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const r = heroRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0) return;
      if (e.key === "ArrowRight") go(cur + 1);
      if (e.key === "ArrowLeft") go(cur - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, go]);

  useEffect(() => { // golden dust
    const c = heroRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!c) return;
    const g = c.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, raf = 0;
    const P = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + .5, s: Math.random() * .001 + .0003, o: Math.random() * 6 }));
    const rs = () => { W = c.width = c.clientWidth * devicePixelRatio; H = c.height = c.clientHeight * devicePixelRatio; };
    const ro = new ResizeObserver(rs); ro.observe(c); rs();
    const draw = () => {
      g.clearRect(0, 0, W, H);
      for (const p of P) {
        if (!reduce) { p.y -= p.s; p.x += Math.sin(p.y * 18 + p.o) * .0003; if (p.y < -.05) { p.y = 1.05; p.x = Math.random(); } }
        const a = Math.sin(p.y * Math.PI) * .7, x = p.x * W, y = p.y * H, r = p.r * devicePixelRatio * 4;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,214,150,${a})`); gr.addColorStop(1, "rgba(255,214,150,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const onMove = (e: React.PointerEvent) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !qaRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    qaRef.current.style.transform = `rotateY(${x * -14}deg) rotateX(${y * 10}deg)`;
  };
  const deck = [1, 2, 3].map((k) => (cur + k) % SLIDES.length);

  return (
    <section ref={heroRef} className="hero" id="top" aria-roledescription="carousel" aria-label="What DocuMind AI can do"
      onPointerMove={onMove} onPointerLeave={() => qaRef.current && (qaRef.current.style.transform = "")}>
      {SLIDES.map((sl, i) => (
        <div key={sl.img} className={`slide-bg${i === cur ? " on" : ""}`} aria-hidden="true">
          <div style={{ backgroundImage: `url(${UNSPLASH(sl.img)})` }} />
        </div>
      ))}
      <div className="shade" />
      <canvas className="dust" aria-hidden="true" />
      <div className="wrap hero-in">
        <div className="hero-copy" key={`c${tick}`} aria-live="polite">
          <p className="eyebrow rise"><Icon name="book" />{s.kind}<small>{s.meta}</small></p>
          <h1 className="htitle rise d1">{s.title}</h1>
          <p className="blurb rise d2">{s.blurb}</p>
          <ul className="facts rise d3">{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>
          <div className="actions rise d3">
            <Link className="btn btn-amber" href="/signup">Start free — try the library</Link>
            <a className="btn btn-glass" href="#how">How it works</a>
          </div>
        </div>
        <div className="hright">
          <div ref={qaRef} key={`q${tick}`} className={`qa rise${s.no ? " no" : ""}`}>
            <div className="q"><i>Q</i>{s.q}</div>
            <div className="a">{s.a}{s.hl && <span className="hl">{s.hl}</span>}</div>
            <div className="src">Source <b>{s.src}</b></div>
          </div>
          <div className="deck" key={`d${tick}`}>
            {deck.map((j, k) => (
              <button key={j} className="dcard" style={{ "--k": k } as React.CSSProperties} onClick={() => go(j)} aria-label={`Show ${SLIDES[j].short}`}>
                <span style={{ backgroundImage: `url(${UNSPLASH(SLIDES[j].img, 500)})` }} />
                <strong>{SLIDES[j].short}<small>{SLIDES[j].meta.split(" · ")[0]}</small></strong>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="wrap controls">
        <button className="round" onClick={() => go(cur - 1)} aria-label="Previous slide"><Icon name="left" size={20} /></button>
        <button className="round" onClick={() => go(cur + 1)} aria-label="Next slide"><Icon name="right" size={20} /></button>
        <div className="prog" aria-hidden="true">
          {SLIDES.map((sl, i) => (
            <span key={sl.img} className={i < cur ? "past" : ""}>
              <i key={i === cur ? `r${tick}` : "x"} className={i === cur ? "run" : ""} onAnimationEnd={() => i === cur && go(cur + 1)} />
            </span>
          ))}
        </div>
        <div className="count"><strong>{String(cur + 1).padStart(2, "0")}</strong> / {String(SLIDES.length).padStart(2, "0")}</div>
      </div>
    </section>
  );
}
