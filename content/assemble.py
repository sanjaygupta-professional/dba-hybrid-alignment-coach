#!/usr/bin/env python3
"""Assemble content/content.json from the authored parts.

  main.json       Claude: meta, plan, evidence, method, walk-through, craft, checks
  slides.json     Codex:  the canonical 10 slides with scripts and coaching
  questions.json  Codex:  the 30 examiner questions (Answer → Evidence → Limit)
  criteria.json   shared: examiner criteria from the Researcher's Journey
  references      parsed from the topic paper (single source of truth)
"""
import json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
PAPER = pathlib.Path.home() / "Projects/dba-immersion/sub-a/paper.md"

c = json.loads((HERE / "main.json").read_text())
c["slides"] = json.loads((HERE / "slides.json").read_text())
c["questions"] = json.loads((HERE / "questions.json").read_text())
c["criteria"] = json.loads((HERE / "criteria.json").read_text())

# ── references from the paper ──
text = PAPER.read_text()
block = text.split("## References", 1)[1]
refs = []
for line in [l.strip() for l in block.splitlines() if l.strip()]:
    m = re.search(r"https?://\S+", line)
    url = m.group(0).rstrip(".") if m else ""
    years = re.findall(r"\((\d{4})", line)
    head = line.split("(", 1)[0]
    first = head.split(",")[0].strip().rstrip(".")
    surname = first.split()[-1] if "," in head.split("(")[0] else first.split()[0]
    aliases = {f"{surname} {y}" for y in years}
    orig = re.search(r"Original work published (\d{4})", line)
    if orig:
        aliases.add(f"{surname} {orig.group(1)}")
    refs.append({"apa": line, "url": url, "aliases": sorted(aliases), "book": not url})
extra = json.loads((HERE / "refs-extra.json").read_text())
for r in refs:
    for e in extra.get("aliases", {}).get(r["aliases"][0], []):
        r["aliases"].append(e)
refs += extra.get("refs", [])
c["refs"] = refs

(HERE / "content.json").write_text(json.dumps(c, ensure_ascii=False, indent=1))
print(f"content.json: {len(c['slides'])} slides, {len(c['questions'])} questions, {len(refs)} refs")
