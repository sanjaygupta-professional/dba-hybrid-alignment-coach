#!/usr/bin/env python3
"""Export the canonical slides to the official deck builder and copy the results into the site.

1. Writes ~/Projects/dba-immersion/sub-a/deck.json (backup kept as deck.v1.json) from content/content.json.
2. Runs the existing builder for topic 'a' -> out/a-deck.pptx and out/a-deck.pdf (speaker notes = full script).
3. Copies the .pptx into site/downloads/. The benchlm-style PDF comes from evals/export_pdf.mjs.
"""
import json, pathlib, shutil, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
DBA = pathlib.Path.home() / "Projects/dba-immersion"
c = json.loads((ROOT / "content/content.json").read_text())
deck_p = DBA / "sub-a/deck.json"
v1 = DBA / "sub-a/deck.v1.json"
if not v1.exists():
    shutil.copy2(deck_p, v1)

keep = ("kind", "eyebrow", "title", "subtitle", "bullets", "columns", "table", "widths", "cascade", "note")
slides = []
for s in c["slides"]:
    d = {k: s[k] for k in keep if k in s and s[k] not in (None, "", [])}
    if d.get("kind") != "title":
        d.pop("kind", None)
    if d.get("cascade"):
        d["cascade"] = {k: v for k, v in d["cascade"].items() if v}
    d["speaker"] = " ".join(s["script"] + ([s["transition"]] if s.get("transition") else []))
    slides.append(d)
deck = {"eyebrow": c["meta"]["eyebrow"], "footer": c["meta"]["footer"], "slides": slides}
deck_p.write_text(json.dumps(deck, ensure_ascii=False, indent=1))
print("wrote", deck_p)
subprocess.run(["uv", "run", "-q", "--with", "python-docx", "--with", "python-pptx", "--with", "markdown",
                "build/build.py", "a"], cwd=DBA, check=True)
dl = ROOT / "site/downloads"
dl.mkdir(exist_ok=True)
shutil.copy2(DBA / "out/a-deck.pptx", dl / "hybrid-alignment-deck.pptx")
print("copied pptx to site/downloads/")
