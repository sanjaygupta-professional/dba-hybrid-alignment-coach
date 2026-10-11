#!/usr/bin/env python3
"""Stagecraft eval suite (stdlib only).

    python3 evals/run.py            # static gates E1–E4, E7, E8 (+ cached Jev results)
    python3 evals/run.py --jev      # also (re)run the Jev typed checks (E5)

Writes evals/out/report.json, which tools/build.py bakes into the Quality page.
E6 (UX in a real browser) runs separately: node evals/ux.mjs, and writes evals/out/ux.json.
"""
import hashlib, json, pathlib, re, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
C = json.loads((ROOT / "content" / "content.json").read_text())
OUT = ROOT / "evals" / "out"
OUT.mkdir(parents=True, exist_ok=True)
CFG = json.loads((ROOT / "evals" / "config.json").read_text())
results = []


def gate(gid, name, ok, detail, warn=False):
    status = "pass" if ok else ("warn" if warn else "fail")
    results.append({"id": gid, "name": name, "status": status, "detail": detail})
    print(f"{gid:4} {status.upper():5} {name}: {detail}")


def slide_text(s):
    parts = [s.get("title", ""), s.get("subtitle", ""), s.get("note", "")]
    parts += s.get("bullets", []) or []
    for c in s.get("columns", []) or []:
        parts += [c["head"], *c["items"]]
    for r in s.get("table", []) or []:
        parts += r
    if s.get("cascade"):
        parts += s["cascade"]["right"] + [s["cascade"].get("interfaces", "")]
    for st in s.get("stats", []) or []:
        parts += [st["v"], st["t"], st["src"]]
    return " ".join(parts)


def spoken(s):
    return " ".join(s["script"] + ([s["transition"]] if s.get("transition") else []))


def words(t):
    return len(re.findall(r"[A-Za-z0-9’'–-]+", t))


def public_texts():
    """Every published prose field, labelled. The illustrative walk-through is listed separately."""
    for s in C["slides"]:
        yield f"slide{s['n']}.on-slide", slide_text(s)
        yield f"slide{s['n']}.script", spoken(s)
        yield f"slide{s['n']}.message", s["message"]
        for k in ("lens", "pitfalls", "anchors"):
            for i, t in enumerate(s.get(k, [])):
                yield f"slide{s['n']}.{k}{i}", t
    for q in C["questions"]:
        for k in ("q", "a", "e", "l", "trap"):
            if q.get(k):
                yield f"{q['id']}.{k}", q[k]
    for k in ("thesis", "purpose"):
        yield f"meta.{k}", C["meta"][k]
    for sec in C["craft"]["sections"]:
        for i, t in enumerate(sec["items"]):
            yield f"craft.{sec['tag']}{i}", t
    for st in C["stats"]:
        for k in ("label", "say"):
            yield f"stat.{st['id']}.{k}", st[k]


# ── E1 statistics fidelity ──────────────────────────────────────────────
def e1():
    allowed = set(CFG["allowed_percents"])
    bad = []
    for where, t in public_texts():
        if ".never" in where:
            continue
        for m in re.finditer(r"(\d+(?:\.\d+)?)\s?%|(\d+(?:\.\d+)?) per ?cent", t):
            v = m.group(1) or m.group(2)
            if v not in allowed:
                bad.append(f"{where}: {v}%")
    stat_ids = {s["id"] for s in C["stats"]}
    missing = [s for s in CFG["required_stats"] if s not in stat_ids]
    labels_ok = all(s["kind"] in ("peer-reviewed", "practitioner survey", "vendor survey", "forecast", "standard", "case")
                    for s in C["stats"])
    forecast_ok = all(("forecast" in s["say"].lower() or "predict" in s["say"].lower())
                      for s in C["stats"] if s["kind"] == "forecast")
    ok = not bad and not missing and labels_ok and forecast_ok
    gate("E1", "Statistics match the verified allow-list", ok,
         f"{len(bad)} unapproved percentages{(': ' + '; '.join(bad[:5])) if bad else ''}; "
         f"forecast labelled={forecast_ok}; kinds valid={labels_ok}")


# ── E2 citations resolve ────────────────────────────────────────────────
def ref_index():
    idx = set()
    for r in C["refs"]:
        m = re.match(r"([^,(]+?),.*?\((\d{4})", r["apa"])
        if m:
            idx.add((m.group(1).strip().split()[-1].lower(), m.group(2)))
        for alias in r.get("aliases", []):
            a, y = alias.rsplit(" ", 1)
            idx.add((a.lower(), y))
    return idx


CIT = re.compile(r"([A-Z][A-Za-zçÄäöüé’'\-]+(?: (?:de|van|von) [A-Z][a-z]+)?)(?: et al\.?| (?:&|and) [A-Z][A-Za-zçé’'\-]+)?,? \(?((?:19|20)\d\d)")


def e2():
    idx, bad, n = ref_index(), [], 0
    skip = set(CFG["citation_false_positives"])
    for where, t in public_texts():
        for m in CIT.finditer(t):
            name, yr = re.sub(r"['’]s$", "", m.group(1).split()[-1].lower()), m.group(2)
            if name in skip:
                continue
            n += 1
            if (name, yr) not in idx:
                bad.append(f"{where}: {m.group(0)}")
    no_link = [r["apa"][:40] for r in C["refs"] if not r.get("url") and not r.get("book")]
    gate("E2", "Every citation resolves to a listed reference", not bad and not no_link,
         f"{n} citations checked, {len(bad)} unresolved{(': ' + '; '.join(bad[:5])) if bad else ''}; "
         f"{len(no_link)} references without DOI/URL")


# ── E3 timing ───────────────────────────────────────────────────────────
def e3():
    wpm = CFG["wpm"]
    total = sum(s["seconds"] for s in C["slides"])
    lo, hi = CFG["talk_seconds_range"]
    off = []
    for s in C["slides"]:
        need = words(spoken(s)) / wpm * 60
        r = need / s["seconds"]
        if not (CFG["slide_fit"][0] <= r <= CFG["slide_fit"][1]):
            off.append(f"slide {s['n']} script {need:.0f}s vs budget {s['seconds']}s")
    spoken_total = sum(words(spoken(s)) for s in C["slides"]) / wpm * 60
    ok = lo <= total <= hi and not off and len(C["slides"]) <= 10
    gate("E3", "Talk fits 15 minutes with Q&A", ok,
         f"{len(C['slides'])} slides; budget {total}s; script ≈{spoken_total:.0f}s at {wpm} wpm; "
         f"{len(off)} slides off budget{(': ' + '; '.join(off)) if off else ''}")


# ── E4 examiner-criteria coverage ───────────────────────────────────────
def e4():
    gaps = []
    for cr in C["criteria"]:
        sl = [s["n"] for s in C["slides"] if cr["id"] in s.get("crit", [])]
        qs = [q["id"] for q in C["questions"] if cr["id"] in q.get("crit", [])]
        if not sl or not qs:
            gaps.append(f"{cr['id']} (slides {sl or '–'}, questions {qs or '–'})")
    trace_cells = all(all(r.get(k) for k in ("sp", "ro", "rq", "dp", "data", "test")) for r in C["trace"])
    qn = len(C["questions"])
    ok = not gaps and trace_cells and qn >= CFG["min_questions"]
    gate("E4", "Every examiner criterion has a slide and a drill question", ok,
         f"{len(C['criteria'])} criteria, {len(gaps)} uncovered{(': ' + ', '.join(gaps)) if gaps else ''}; "
         f"{qn} questions; traceability cells complete={trace_cells}")


# ── E5a Jev calibration on labelled fixtures ─────────────────────────────
def jev_cached(state, qtexts, run, cache):
    key = hashlib.sha256((state + json.dumps(qtexts)).encode()).hexdigest()[:20]
    if key not in cache and run:
        sys.path.insert(0, str(ROOT / "tools"))
        from coach_server import jev
        qs = {f"c{i}": {"type": "noul", "instructions": q} for i, q in enumerate(qtexts)}
        for _ in range(3):
            try:
                ans = jev(state, qs)
                cache[key] = [ans[f"c{i}"]["noul"] for i in range(len(qtexts))]
                break
            except Exception as ex:
                print("  jev retry", ex); time.sleep(2)
    return cache.get(key)


def e5a(run, cache):
    fx = json.loads((ROOT / "evals" / "jev_fixtures.json").read_text())["fixtures"]
    th = CFG["jev_threshold"]
    qtext = {c["label"]: c["q"] for k in ("slide", "answer", "deck") for c in C["jev_checks"][k]}
    per, missing = {}, 0
    for f in fx:
        ps = jev_cached(C["jev_context"] + f["state"], [qtext[f["check"]]], run, cache)
        if ps is None:
            missing += 1; continue
        p = float(ps[0])
        t = CFG.get("jev_thresholds", {}).get(f["check"], th)
        correct = (p >= t) if f["yes"] else (p <= 1 - t)
        per.setdefault(f["check"], []).append(correct)
    weak = {k: f"{sum(v)}/{len(v)}" for k, v in per.items() if sum(v) < len(v) - 1}
    n = sum(len(v) for v in per.values()); ok_n = sum(sum(v) for v in per.values())
    gate("E5a", "Jev predicates calibrated on labelled fixtures", per and not weak and not missing,
         f"{ok_n} of {n} fixtures decided correctly across {len(per)} predicates; {missing} not run; "
         f"predicates below 5/6: {weak or 'none'}")
    return set(weak)


# ── E5 Jev typed checks ─────────────────────────────────────────────────
def jev_jobs():
    th = CFG["jev_threshold"]
    jobs = []
    for s in C["slides"]:
        state = C["jev_context"] + f"Slide {s['n']} of a 15-minute doctoral topic presentation.\nOn-slide text: {slide_text(s)}\nSpoken script: {spoken(s)}"
        for ch in C["jev_checks"]["slide"]:
            if ch.get("only") and s["n"] not in ch["only"]:
                continue
            jobs.append((f"slide {s['n']}", ch, state))
    for q in C["questions"]:
        state = C["jev_context"] + f"Examiner question: {q['q']}\nModel answer: {q['a']}\nEvidence: {q['e']}\nLimit: {q['l']}"
        for ch in C["jev_checks"]["answer"]:
            jobs.append((q["id"], ch, state))
    deck = "\n".join(f"Slide {s['n']}: {s['title']} — {s['message']}" for s in C["slides"])
    for ch in C["jev_checks"]["deck"]:
        jobs.append(("deck", ch, C["jev_context"] + "Storyline of a 10-slide doctoral topic presentation (design science):\n" + deck))
    return jobs, th


def e5(run, cache, weak):
    cache_p = OUT / "jev-cache.json"
    jobs, th = jev_jobs()
    items, missing = [], 0
    sys.path.insert(0, str(ROOT / "tools"))
    # group per state to save calls
    groups = {}
    for target, ch, state in jobs:
        groups.setdefault((target, state), []).append(ch)
    for (target, state), chs in groups.items():
        key = hashlib.sha256((state + json.dumps([c["q"] for c in chs])).encode()).hexdigest()[:20]
        if key not in cache and run:
            from coach_server import jev
            qs = {f"c{i}": {"type": "noul", "instructions": c["q"]} for i, c in enumerate(chs)}
            for attempt in range(3):
                try:
                    ans = jev(state, qs)
                    cache[key] = [ans[f"c{i}"]["noul"] for i in range(len(chs))]
                    break
                except Exception as ex:  # network hiccup: retry, then leave missing
                    print("  jev retry", target, ex)
                    time.sleep(2)
            cache_p.write_text(json.dumps(cache, indent=0))
        ps = cache.get(key)
        for i, c in enumerate(chs):
            if ps is None:
                missing += 1
                continue
            p = float(ps[i])
            t = CFG.get("jev_thresholds", {}).get(c["label"], th)
            ok = p >= t if c.get("want", True) else p <= 1 - t
            if c["label"] in weak:
                ok = None  # uncalibrated predicate: human review, never auto-pass
            items.append({"target": target, "check": c["label"], "p": round(p, 3), "pass": ok, "want": c.get("want", True)})
    hr = json.loads((ROOT / "evals" / "human_review.json").read_text())["reviews"]
    for i in items:
        if i["pass"] is not True:
            rv = next((h for h in hr if h["target"] == i["target"] and h["check"] == i["check"]), None)
            if rv and rv["disposition"] == "pass":
                i["pass"] = True; i["reviewed"] = rv["reason"]
    reviewed = sum(1 for i in items if i.get("reviewed"))
    passed = sum(1 for i in items if i["pass"] is True)
    review = sum(1 for i in items if i["pass"] is None)
    total = len(items) - review
    rate = passed / total if total else 0
    ok = total > 0 and missing == 0 and review == 0 and rate >= CFG["jev_min_pass_rate"]
    fails = [f"{i['target']}: {i['check']} ({i['p']})" for i in items if i["pass"] is False]
    gate("E5", "Jev typed checks on slides, answers and storyline", ok,
         f"{passed} of {total} pass ({reviewed} after signed human review); {review} awaiting review; {missing} not yet scored"
         + (f"; failing: {'; '.join(fails[:6])}" if fails else ""))
    cache_p.write_text(json.dumps(cache, indent=0))
    return {"threshold": th, "passed": passed, "total": total, "review": review, "reviewed": reviewed, "items": items}


# ── E6 UX (browser) — read result written by evals/ux.mjs ───────────────
def e6():
    p = OUT / "ux.json"
    if not p.exists():
        gate("E6", "UX in a real browser (desktop + 375 px phone)", False, "not run yet: node evals/ux.mjs")
        return
    u = json.loads(p.read_text())
    fails = [c["name"] for c in u["checks"] if not c["ok"]]
    gate("E6", "UX in a real browser (desktop + 375 px phone)", not fails,
         f"{len(u['checks']) - len(fails)} of {len(u['checks'])} browser checks pass"
         + (f"; failing: {', '.join(fails)}" if fails else "") + f" ({u['when']})")


# ── E7 plain-language prose ──────────────────────────────────────────────
def e7():
    limit = CFG["max_sentence_words"]
    long_ = []
    for where, t in public_texts():
        if ".on-slide" in where:
            continue
        clean = re.sub(r"\([^)]*\)", "", t)
        for sent in re.split(r"(?<=[.!?])\s+(?=[A-Z“\"])", clean):
            if words(sent) > limit:
                long_.append(f"{where} ({words(sent)})")
    gate("E7", f"Sentences of {limit} words or fewer", not long_,
         f"{len(long_)} long sentences{(': ' + ', '.join(long_[:8])) if long_ else ''}")


# ── E8 privacy and publication hygiene ───────────────────────────────────
def e8():
    site = ROOT / "site"
    blob = ""
    for p in site.rglob("*"):
        if p.suffix in (".html", ".js", ".css", ".json", ".md", ".txt", ".svg"):
            blob += p.read_text(errors="ignore")
    blob += (ROOT / "content" / "content.json").read_text()
    pats = {k: re.compile(v, re.I) for k, v in CFG["forbidden_patterns"].items()}
    hits = [k for k, rx in pats.items() if rx.search(blob)]
    ext = set(re.findall(r"https?://([a-z0-9.-]+)", blob, re.I))
    idx = (site / "index.html").read_text()
    runtime = re.findall(r"""src=["'](https?://[^"']+)""", idx) + re.findall(r"""<link[^>]+href=["'](https?://[^"']+)""", idx)
    gate("E8", "No private material, secrets or runtime third-party loads", not hits and not runtime,
         f"forbidden patterns hit: {hits or 'none'}; runtime external loads in index.html: {runtime or 'none'}; "
         f"{len(ext)} external link domains")


if __name__ == "__main__":
    run_jev = "--jev" in sys.argv
    e1(); e2(); e3(); e4()
    cache_p = OUT / "jev-cache.json"
    cache = json.loads(cache_p.read_text()) if cache_p.exists() else {}
    weak = e5a(run_jev, cache)
    cache_p.write_text(json.dumps(cache, indent=0))
    jevres = e5(run_jev, cache, weak)
    e6(); e7(); e8()
    rep = {"generated": time.strftime("%Y-%m-%d %H:%M"), "evals": results, "jev": jevres}
    (OUT / "report.json").write_text(json.dumps(rep, indent=1))
    bad = [r for r in results if r["status"] == "fail"]
    print(f"\n{len(results) - len(bad)} of {len(results)} gates pass")
    sys.exit(1 if bad else 0)
