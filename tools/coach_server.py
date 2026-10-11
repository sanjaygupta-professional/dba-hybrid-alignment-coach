#!/usr/bin/env python3
"""Stagecraft local coach server.

Serves the site on http://127.0.0.1:8823 and adds live Jev scoring for Viva Gym answers.
The TypeSafe API key stays on this laptop: it is read from the TYPESAFE_API_KEY environment
variable (or ~/jev-omarchy-test-api-key.md) and never sent to the browser.

    python3 tools/coach_server.py            # then open http://127.0.0.1:8823
"""
import json, os, pathlib, re, sys, time, urllib.error, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
CONTENT = ROOT / "content" / "content.json"
API = "https://api.typesafe.ai/v1/systemone"
PORT = int(os.environ.get("STAGECRAFT_PORT", "8823"))
ALLOWED_ORIGINS = {f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}",
                   "https://sanjaygupta-professional.github.io"}


def api_key():
    k = os.environ.get("TYPESAFE_API_KEY")
    if k:
        return k
    p = pathlib.Path.home() / "jev-omarchy-test-api-key.md"
    m = re.search(r"apikey_[A-Za-z0-9_]+", p.read_text()) if p.exists() else None
    return m.group(0) if m else None


def load_content():
    return json.loads(CONTENT.read_text())


def jev(state, questions, timeout=20):
    body = json.dumps({"state": state, "model": "jev-latest", "questions": questions}).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "Authorization": f"Bearer {api_key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)["answers"]


def score(qid, answer):
    c = load_content()
    q = next((x for x in c["questions"] if x["id"] == qid), None)
    if q is None:
        raise ValueError("unknown question")
    state = (f"An examiner asked a doctoral candidate this question at a topic presentation:\n{q['q']}\n\n"
             f"Reference points a strong answer would use (not required verbatim):\n"
             f"- Answer: {q['a']}\n- Evidence: {q['e']}\n- Limit: {q['l']}\n\n"
             f"The candidate's answer:\n{answer.strip()[:2500]}")
    checks = {ch["id"]: {"type": "noul", "instructions": ch["jev"]} for ch in c["answer_checks"]}
    t0 = time.time()
    out = jev(state, checks)
    items = []
    for ch in c["answer_checks"]:
        p = float(out[ch["id"]]["noul"])
        items.append({"id": ch["id"], "label": ch["label"], "p": round(1 - p if ch.get("invert") else p, 3)})
    return {"items": items, "ms": int((time.time() - t0) * 1000)}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(SITE), **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("  " + fmt % args + "\n")

    def _cors(self):
        o = self.headers.get("Origin")
        if o in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/health"):
            return self._json(200, {"ok": True, "jev": bool(api_key())})
        return super().do_GET()

    def do_POST(self):
        if not self.path.startswith("/api/score"):
            return self._json(404, {"error": "not found"})
        try:
            n = min(int(self.headers.get("Content-Length", "0")), 20000)
            body = json.loads(self.rfile.read(n) or b"{}")
            return self._json(200, score(str(body.get("qid", "")), str(body.get("answer", ""))))
        except ValueError as e:
            return self._json(400, {"error": str(e)})
        except (urllib.error.URLError, TimeoutError, KeyError) as e:
            return self._json(502, {"error": f"Jev unavailable: {e}"})


if __name__ == "__main__":
    if not api_key():
        print("No TYPESAFE_API_KEY found: the site works, live Jev scoring is off.")
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Stagecraft coach: http://127.0.0.1:{PORT}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
