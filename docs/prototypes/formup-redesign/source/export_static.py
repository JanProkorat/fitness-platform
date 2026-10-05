"""Export the canvas artboards as plain, standalone HTML plus a gallery index and a screenshot manifest.

Usage: python3 export_static.py <out_dir>
Reads project/canvas.json and project/*.dc.html next to this script.
"""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
canvas = json.load(open(os.path.join(HERE, "project", "canvas.json")))
FOLDERS = {"concepts": "concepts", "web": "web", "glass": "mobile-light", "glassdark": "mobile-dark", "coach": "coach-light", "coachdark": "coach-dark", "logo": "logo"}
PAGE_NAMES = {p["id"]: p["name"] for p in canvas["pages"]}


def to_static(src, title):
    helmet = re.search(r"<helmet>(.*?)</helmet>", src, re.S).group(1).strip()
    body = re.search(r"</helmet>(.*?)</x-dc>", src, re.S).group(1).strip()
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
{helmet}
</head>
<body>
{body}
</body>
</html>
"""


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


manifest, sections = [], {}
for page_id, folder in FOLDERS.items():
    boards = sorted(((k, b) for k, b in canvas["boards"].items() if b.get("page") == page_id), key=lambda kb: (kb[1]["y"], kb[1]["x"]))
    rows = sorted({b["y"] for _, b in boards})
    notes = {n["y"] + 300: n["text"] for n in canvas["notes"].values() if n.get("page") == page_id}
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    for key, b in boards:
        r = rows.index(b["y"]) + 1
        c = sorted(x["x"] for _, x in boards if x["y"] == b["y"]).index(b["x"]) + 1
        name = re.sub(r"^Glass|(Light|Dark)\.dc\.html$|\.dc\.html$", "", key)
        name = re.sub(r"(Light|Dark)$", "", name)
        base = f"{r:02d}-{c:02d}-{slug(re.sub(r'(?<!^)(?=[A-Z])', ' ', name))}"
        src = open(os.path.join(HERE, "project", key)).read()
        title = f"{PAGE_NAMES[page_id]} · {b.get('title', name)}"
        with open(os.path.join(OUT, folder, base + ".html"), "w") as f:
            f.write(to_static(src, title))
        manifest.append({"html": f"{folder}/{base}.html", "png": f"{folder}/{base}.png", "w": b["w"], "h": b["h"]})
        sections.setdefault(folder, []).append((notes.get(b["y"], ""), base, b.get("title", name), b["w"]))

with open(os.path.join(OUT, "screens.json"), "w") as f:
    json.dump(manifest, f, indent=1)

parts = []
for page_id, folder in FOLDERS.items():
    parts.append(f'<h2>{html.escape(PAGE_NAMES[page_id])}</h2>')
    last = None
    for row_title, base, title, w in sections.get(folder, []):
        if row_title != last:
            if last is not None:
                parts.append("</div>")
            parts.append(f'<h3>{html.escape(row_title)}</h3><div class="row">')
            last = row_title
        width = 220 if w < 600 else 480
        parts.append(f'<a href="{folder}/{base}.html" style="width:{width}px"><img src="{folder}/{base}.png" alt="{html.escape(title)}" loading="lazy"><span>{html.escape(title)}</span></a>')
    parts.append("</div>")
with open(os.path.join(OUT, "index.html"), "w") as f:
    f.write("""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Form Up redesign</title>
<style>
:root{--bg:#f6f5f2;--ink:#141414;--muted:#6b6863;--line:#e7e4de}
@media (prefers-color-scheme: dark){:root{--bg:#0e0e0f;--ink:#f4f2ee;--muted:#958f87;--line:#2a292c}}
body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--ink);font:15px/1.4 system-ui,sans-serif}
h1{margin:0 0 4px}h2{margin:48px 0 0;padding-top:16px;border-top:1px solid var(--line)}h3{margin:28px 0 12px;font-size:15px;color:var(--muted)}
.row{display:flex;flex-wrap:wrap;gap:16px}
.row a{display:flex;flex-direction:column;gap:6px;color:var(--ink);text-decoration:none;font-size:12px}
.row img{width:100%;border-radius:12px;border:1px solid var(--line);background:#fff}
</style></head><body>
<h1>Form Up redesign</h1><p style="color:var(--muted);margin:0">Static export of the design canvas. Click a screen to open its standalone HTML. <a href="interactive/index.html" style="color:var(--ink);font-weight:700">Open the clickable web-portal prototype →</a></p>
""" + "\n".join(parts) + "\n</body></html>\n")
print(len(manifest), "screens")
