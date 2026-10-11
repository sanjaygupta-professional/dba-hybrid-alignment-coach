#!/usr/bin/env python3
"""RR-M04 regression test: a signed review must not survive a change to content, question, polarity or threshold."""
import copy, importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location("run", pathlib.Path(__file__).with_name("run.py"))
run = importlib.util.module_from_spec(spec); sys.argv = ["run.py"]; spec.loader.exec_module(run)
check = {"label": "Problem stated without naming the fix", "q": "Does the slide state the business problem without naming the proposed diagnostic as the solution?", "want": True}
base = run.review_fingerprint("STATE", check, 0.7)
cases = {
 "same inputs match": (run.review_fingerprint("STATE", copy.deepcopy(check), 0.7) == base, True),
 "content change voids": (run.review_fingerprint("STATE + one sentence", check, 0.7) == base, False),
 "question change voids": (run.review_fingerprint("STATE", {**check, "q": "Does slide 2 explicitly name the proposed diagnostic as its solution?"}, 0.7) == base, False),
 "polarity change voids": (run.review_fingerprint("STATE", {**check, "want": False}, 0.7) == base, False),
 "threshold change voids": (run.review_fingerprint("STATE", check, 0.5) == base, False),
}
bad = [k for k, (got, want) in cases.items() if got != want]
for k, (got, want) in cases.items():
    print(("PASS " if got == want else "FAIL ") + k)
sys.exit(1 if bad else 0)
