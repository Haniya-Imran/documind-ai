import os
"""Compile the five DocuMind sample books into real PDFs from openly licensed
OpenStax CNXML sources (cloned from github.com/openstax).

Steps per book: read the collection XML -> pick chapters -> convert each module's
CNXML to HTML -> print to PDF with headless Chrome -> stamp page numbers ->
record metadata (title, authors, license, source, actual page count).
"""
import base64, html, json, mimetypes, os, re, subprocess, sys
import xml.etree.ElementTree as ET
from pathlib import Path

SRC = Path(os.environ.get("BOOKS_SRC", "booksrc"))  # cloned OpenStax source repos
OUT = Path(os.environ.get("BOOKS_OUT", "out"))
OUT.mkdir(parents=True, exist_ok=True)
CNX = "{http://cnx.rice.edu/cnxml}"
COL = "{http://cnx.rice.edu/collxml}"
MD = "{http://cnx.rice.edu/mdml}"
MATH = "{http://www.w3.org/1998/Math/MathML}"

BOOKS = [
    dict(slug="python-programming", title="Python Programming",
         subtitle="Selected chapters from OpenStax Introduction to Python Programming",
         topic="Programming", repo="osbooks-introduction-python-programming",
         col="introduction-python-programming",
         chapters=["Statements", "Expressions", "Objects", "Decisions", "Loops", "Functions"],
         authors="Udayan Das, Aubrey Lawson, Chris Mayfield, Narges Norouzi (OpenStax)",
         license="CC BY-NC-SA 4.0", license_url="https://creativecommons.org/licenses/by-nc-sa/4.0/",
         source_url="https://github.com/openstax/osbooks-introduction-python-programming",
         book_url="https://openstax.org/details/books/introduction-python-programming",
         target=100),
    dict(slug="machine-learning", title="Machine Learning",
         subtitle="Machine learning and deep learning chapters from OpenStax Principles of Data Science",
         topic="AI & ML", repo="osbooks-principles-data-science", col="principles-data-science",
         chapters=["Decision-Making Using Machine Learning Basics", "Deep Learning and AI Basics"],
         authors="Dr. Shaun V. Ault, Dr. Soohyun Nam Liao, Larry Musolino (OpenStax)",
         license="CC BY-NC-SA 4.0", license_url="https://creativecommons.org/licenses/by-nc-sa/4.0/",
         source_url="https://github.com/openstax/osbooks-principles-data-science",
         book_url="https://openstax.org/details/books/principles-data-science",
         target=120),
    dict(slug="data-science", title="Data Science",
         subtitle="Selected chapters from OpenStax Principles of Data Science",
         topic="Data Analytics", repo="osbooks-principles-data-science", col="principles-data-science",
         chapters=["What Are Data and Data Science?", "Collecting and Preparing Data",
                   "Descriptive Statistics: Statistical Measurements and Probability Distributions"],
         authors="Dr. Shaun V. Ault, Dr. Soohyun Nam Liao, Larry Musolino (OpenStax)",
         license="CC BY-NC-SA 4.0", license_url="https://creativecommons.org/licenses/by-nc-sa/4.0/",
         source_url="https://github.com/openstax/osbooks-principles-data-science",
         book_url="https://openstax.org/details/books/principles-data-science",
         target=100),
    dict(slug="business-management", title="Business & Management",
         subtitle="Management chapters from OpenStax Introduction to Business 2e",
         topic="Business", repo="osbooks-introduction-business", col="introduction-business-2e",
         chapters=["Management and Leadership in Today's Organizations", "Designing Organizational Structures"],
         authors="Lawrence J. Gitman, Carl McDaniel, Amit Shah, et al. (OpenStax)",
         license="CC BY 4.0", license_url="https://creativecommons.org/licenses/by/4.0/",
         source_url="https://github.com/openstax/osbooks-introduction-business",
         book_url="https://openstax.org/details/books/introduction-business-2e",
         target=80),
    dict(slug="environmental-science", title="Environmental Science",
         subtitle="Ecology chapters (Ecology and the Biosphere, Ecosystems) from OpenStax Biology 2e",
         topic="Environment", repo="osbooks-biology-bundle", col="biology-2e",
         chapters=["Ecology and the Biosphere", "Ecosystems"],
         authors="Mary Ann Clark, Matthew Douglas, Jung Choi (OpenStax)",
         license="CC BY-NC-SA 4.0 (as stated in the source repository)",
         license_url="https://creativecommons.org/licenses/by-nc-sa/4.0/",
         source_url="https://github.com/openstax/osbooks-biology-bundle",
         book_url="https://openstax.org/details/books/biology-2e",
         target=90),
]


SKIP = ["key term", "summary", "review", "exercise", "working the net", "critical thinking", "hot link",
        "workplace skills", "ethics activity", "team activit", "case for", "address book", "glossary",
        "chapter review", "assessment", "projects", "references", "group project", "technology in everyday",
        "datasets", "ethics throughout", "key concepts", "challenge", "written", "visual connection",
        "art connection", "test prep", "critical thinking question", "science practice", "multiple choice", "quiz"]


def find_chapters(colfile, wanted):
    root = ET.parse(colfile).getroot()
    found = {}
    for sub in root.iter(COL + "subcollection"):
        t = sub.find(MD + "title")
        if t is None:
            continue
        title = t.text.strip()
        if title in wanted and title not in found:
            mods = [m.get("document") for m in sub.iter(COL + "module")]
            found[title] = mods
    missing = [w for w in wanted if w not in found]
    if missing:
        raise SystemExit(f"chapters not found: {missing}")
    return [(w, found[w]) for w in wanted]


def img_data(repo, src):
    p = (SRC / repo / "modules" / "x" / src).resolve() if src.startswith("..") else SRC / repo / "media" / src
    if not p.exists():
        p = SRC / repo / "media" / Path(src).name
    if not p.exists():
        return None
    try:
        from PIL import Image
        import io
        im = Image.open(p)
        im.thumbnail((1100, 1100))
        if im.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", im.size, "white")
            im = im.convert("RGBA"); bg.paste(im, mask=im.split()[-1]); im = bg
        else:
            im = im.convert("RGB")
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=68, optimize=True)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        mime = mimetypes.guess_type(p.name)[0] or "image/png"
        return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


def text(el):
    return html.escape(el.text or "")


def tail(el):
    return html.escape(el.tail or "")


def conv(el, repo, depth=2):
    """Convert one CNXML element (and children) to HTML."""
    tag = el.tag.replace(CNX, "")
    if el.tag.startswith(MATH):
        return ET.tostring(el, encoding="unicode").replace("ns0:", "").replace(":ns0", "") + tail(el)
    inner = text(el) + "".join(conv(c, repo, depth + (1 if tag == "section" else 0)) for c in el)
    T = tail(el)
    if tag in ("metadata", "glossary"):
        return T
    if tag == "para":
        return f"<p>{inner}</p>{T}"
    if tag == "title":
        h = min(depth + 1, 5)
        return f"<h{h}>{inner}</h{h}>{T}"
    if tag == "section":
        return f"<section>{inner}</section>{T}"
    if tag == "emphasis":
        eff = el.get("effect", "bold")
        t = {"italics": "em", "underline": "u"}.get(eff, "strong")
        return f"<{t}>{inner}</{t}>{T}"
    if tag == "term":
        return f"<strong class='term'>{inner}</strong>{T}"
    if tag == "list":
        t = "ol" if el.get("list-type") == "enumerated" else "ul"
        return f"<{t}>{inner}</{t}>{T}"
    if tag == "item":
        return f"<li>{inner}</li>{T}"
    if tag == "figure":
        return f"<figure>{inner}</figure>{T}"
    if tag == "caption":
        return f"<figcaption>{inner}</figcaption>{T}"
    if tag == "media":
        return inner + T
    if tag == "image":
        d = img_data(repo, el.get("src", ""))
        alt = html.escape(el.getparent().get("alt", "") if hasattr(el, "getparent") else "")
        return (f"<img src='{d}' alt=''>" if d else "") + T
    if tag == "note":
        if el.get("class") in ("learning-questions", "guided-slides", "download-file"):
            return T
        return f"<aside class='note'>{inner}</aside>{T}"
    if tag == "example":
        return f"<div class='example'>{inner}</div>{T}"
    if tag == "exercise" and not re.sub(r"<[^>]+>|\s", "", inner):
        return T
    if tag in ("exercise", "problem", "solution", "commentary"):
        return f"<div class='{tag}'>{inner}</div>{T}"
    if tag == "code":
        if el.get("display") == "block" or "\n" in (el.text or ""):
            return f"<pre><code>{inner}</code></pre>{T}"
        return f"<code>{inner}</code>{T}"
    if tag == "preformat":
        return f"<pre>{inner}</pre>{T}"
    if tag == "quote":
        return f"<blockquote>{inner}</blockquote>{T}"
    if tag == "table":
        return f"<table>{inner}</table>{T}"
    if tag in ("tgroup", "colspec"):
        return inner + T
    if tag == "thead":
        return f"<thead>{inner}</thead>{T}"
    if tag == "tbody":
        return f"<tbody>{inner}</tbody>{T}"
    if tag == "row":
        return f"<tr>{inner}</tr>{T}"
    if tag == "entry":
        return f"<td>{inner}</td>{T}"
    if tag in ("sup", "sub"):
        return f"<{tag}>{inner}</{tag}>{T}"
    if tag == "newline":
        return "<br>" + T
    if tag == "link":
        return inner + T
    if tag == "equation":
        return f"<div class='eq'>{inner}</div>{T}"
    if tag in ("definition", "meaning", "seealso", "cite", "cite-title", "label", "foreign", "span", "div", "content", "document", "footnote"):
        return inner + T
    return inner + T


CSS = """
@page{size:A4;margin:22mm 20mm 24mm 20mm}
body{font-family:'DejaVu Serif',Georgia,serif;font-size:10.5pt;line-height:1.5;color:#1d1a16}
h1,h2,h3,h4,h5{font-family:'DejaVu Sans',Arial,sans-serif;line-height:1.2;color:#1d1a16}
h1.chapter{font-size:26pt;margin:0 0 6mm;break-before:page;border-bottom:3px solid #E8A33D;padding-bottom:4mm}
h2{font-size:16pt;margin-top:9mm;break-after:avoid}h3{font-size:13pt;break-after:avoid}h4,h5{font-size:11.5pt;break-after:avoid}
figure{margin:5mm 0;break-inside:avoid;text-align:center}img{max-width:85%;max-height:85mm}
figcaption{font-size:9pt;color:#555;text-align:left;margin-top:2mm}
table{border-collapse:collapse;width:100%;font-size:9pt;margin:4mm 0;break-inside:avoid}td{border:1px solid #bbb;padding:3px 5px;vertical-align:top}
aside.note,.example{border-left:3px solid #E8A33D;background:#faf5ea;padding:3mm 4mm;margin:4mm 0;break-inside:avoid}
pre{background:#f4f1ea;padding:3mm;font-size:9pt;white-space:pre-wrap;break-inside:avoid}code{font-family:'DejaVu Sans Mono',monospace;font-size:9.5pt}
.exercise,.problem{margin:2mm 0}.solution{display:none}
.cover{height:250mm;display:flex;flex-direction:column;justify-content:center;break-after:page}
.cover .t{font-family:'DejaVu Sans',sans-serif;font-size:40pt;font-weight:bold;margin:0}
.cover .s{font-size:14pt;color:#555;margin-top:6mm}.cover .bar{width:40mm;height:4mm;background:#E8A33D;margin-bottom:10mm}
.cover .meta{margin-top:30mm;font-size:10pt;color:#444}
.lic{break-after:page;font-size:10pt}.toc li{margin:2mm 0}
"""


def build(b):
    repo = b["repo"]
    chapters = find_chapters(SRC / repo / "collections" / f"{b['col']}.collection.xml", b["chapters"])
    parts = []
    toc = []
    for ci, (ctitle, mods) in enumerate(chapters, 1):
        toc.append(f"<li>Chapter {ci}: {html.escape(ctitle)}</li>")
        parts.append(f"<h1 class='chapter'>Chapter {ci}<br>{html.escape(ctitle)}</h1>")
        for mid in mods:
            f = SRC / repo / "modules" / mid / "index.cnxml"
            root = ET.parse(f).getroot()
            title = root.find(CNX + "title")
            content = root.find(CNX + "content")
            tt = (title.text or "").strip().lower() if title is not None else ""
            if any(k in tt for k in SKIP):
                continue
            if title is not None and title.text and title.text.strip().lower() not in ("introduction",):
                parts.append(f"<h2>{html.escape(title.text.strip())}</h2>")
            if content is not None:
                parts.append("".join(conv(c, repo) for c in content))
    cover = (f"<div class='cover'><div class='bar'></div><p class='t'>{html.escape(b['title'])}</p>"
             f"<p class='s'>{html.escape(b['subtitle'])}</p>"
             f"<div class='meta'>Authors: {html.escape(b['authors'])}<br>License: {html.escape(b['license'])}<br>"
             f"Source: {b['source_url']}<br>DocuMind AI sample library edition</div></div>")
    lic = (f"<div class='lic'><h2>About this edition</h2><p>This PDF was compiled for the DocuMind AI sample library "
           f"from the openly licensed OpenStax source files at {b['source_url']} (original book: {b['book_url']}). "
           f"Text and images are by {html.escape(b['authors'])} and are used under the {html.escape(b['license'])} license "
           f"({b['license_url']}). Changes: selected chapters only, reformatted into a single PDF; end-of-chapter answer keys removed. "
           f"This edition is shared under the same license. Download the original for free at openstax.org.</p>"
           f"<h2>Contents</h2><ol class='toc'>{''.join(toc)}</ol></div>")
    doc = f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{cover}{lic}{''.join(parts)}</body></html>"
    hp = OUT / f"{b['slug']}.html"
    hp.write_text(doc, encoding="utf-8")
    raw = OUT / f"{b['slug']}.raw.pdf"
    subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={raw}", hp.as_uri()], check=True, capture_output=True, timeout=600)
    return raw, len(chapters)


def stamp(raw, final):
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas
    import io
    r = PdfReader(str(raw)); w = PdfWriter()
    for i, page in enumerate(r.pages, 1):
        if i > 1:
            W = float(page.mediabox.width); buf = io.BytesIO()
            c = canvas.Canvas(buf, pagesize=(W, float(page.mediabox.height)))
            c.setFont("Helvetica", 9); c.setFillGray(0.35)
            c.drawCentredString(W / 2, 28, f"Page {i}")
            c.save(); buf.seek(0)
            page.merge_page(PdfReader(buf).pages[0])
        w.add_page(page)
    w.add_metadata({"/Title": "DocuMind sample library", "/Producer": "DocuMind AI"})
    with open(final, "wb") as f:
        w.write(f)
    return len(r.pages)


if __name__ == "__main__":
    only = sys.argv[1:]
    for b in BOOKS:
        if only and b["slug"] not in only:
            continue
        raw, n = build(b)
        final = OUT / f"{b['slug']}.pdf"
        pages = stamp(raw, final)
        from pypdf import PdfReader
        assert len(PdfReader(str(final)).pages) == pages
        meta = {k: b[k] for k in ("slug", "title", "subtitle", "topic", "authors", "license", "license_url", "source_url", "book_url", "chapters")}
        meta.update(pages=pages, file=final.name, bytes=os.path.getsize(final))
        (OUT / f"{b['slug']}.json").write_text(json.dumps(meta, indent=2))
        print(b["slug"], pages, "pages", os.path.getsize(final) // 1024, "KB")
