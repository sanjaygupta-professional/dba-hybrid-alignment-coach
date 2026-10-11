# Stagecraft — presenter coach for a DBA topic presentation

**Live site:** https://sanjaygupta-professional.github.io/dba-hybrid-alignment-coach/

Stagecraft coaches one talk: *Designing a Hybrid Alignment Diagnostic* (GGU DBA in Emerging Technologies, Immersion 1,
Singapore, Wednesday 14 October 2026). The study is a design science research (DSR) proposal. It asks whether managers
can judge, from evidence they can inspect, that a delegated AI agent's actions are warranted by enterprise strategy,
unit priorities and human mandates.

The site is both the deck and the coach.

| Page | What you do there |
|---|---|
| **Prepare** | See four honest status states (content, timing, defence, submission), your next action and the day plan |
| **Storyline** | Read each slide's message, script, transition, examiner lens and pitfalls |
| **Rehearse** | Run the talk against per-slide time budgets; optional pace and filler-word listening (Chrome) |
| **Defend** | Drill 30 examiner questions; model answers use Answer → Evidence → Limit |
| **Method** | Trace SP → RO → RQ → DP → data → test; DSRM, FEDS, the L1–L4 cascade and mechanisms M1–M6 |
| **Walk-through** | A leader uses the diagnostic on an *illustrative* workflow (invented data, no study results) |
| **Evidence · Craft · Quality** | Approved statistics, delivery practice, and the eval results behind the content |

Press **P** anywhere to present. In the deck: arrow keys, **F** full screen, **V** presenter view (second window), **Esc** exit.

## Attribution

The research method follows Dr Sumitra Padmanabhan's published
[Researcher's Journey](https://sumitrapiyer.github.io/Researchers-journey/) (DSR track). Stagecraft applies that method;
it does not speak for her and has no endorsement from her. Pacing, rehearsal and delivery advice is labelled
**coach practice**. No private course material is in this repository.

## Live Jev checks (optional, local)

[TypeSafe Jev](https://typesafe.ai) gives typed yes/no judgements. The API key must never ship to a browser, so live
checks run through a small server on your own laptop:

```bash
export TYPESAFE_API_KEY=...        # or keep it in ~/jev-omarchy-test-api-key.md
python3 tools/coach_server.py      # then open http://127.0.0.1:8823
```

In **Defend → Start drill**, type your answer and tick "Send my typed answer to Jev". Jev checks five things: a direct
answer, evidence, a real limit, no claimed results, and missing evidence kept as "unknown". You get one repair cue, not a
grade. Without the server, an offline keyword checklist runs instead and says so.

## Evals

```bash
python3 content/assemble.py        # content parts -> content/content.json
python3 evals/run.py --jev         # E1–E8 (+E5a Jev calibration); writes evals/out/report.json
cd evals && npm i && node ux.mjs   # E6 browser checks (desktop + 375 px phone, axe)
python3 tools/build.py             # bakes content + report into site/data/bundle.js
```

| Gate | Checks |
|---|---|
| E1 | Every percentage is on the verified statistics allow-list; forecasts and vendor surveys are labelled |
| E2 | Every in-text citation resolves to a reference with a DOI or URL |
| E3 | 10 slides, 720 s budget, each script fits its slide budget at 130 words per minute |
| E4 | Every examiner criterion (C01–C18) has a slide and a drill question; no empty traceability cells |
| E5a | Each Jev predicate decides labelled fixtures correctly (≥ 5 of 6); weak predicates go to human review |
| E5 | Jev typed checks over every slide, model answer and the storyline |
| E6 | Browser: no errors, no phone overflow, no slide overflow, keyboard deck, themes, axe serious/critical = 0 |
| E7 | Plain-language prose: sentences of 25 words or fewer |
| E8 | No private material, secrets or runtime third-party loads |

## Privacy

No analytics, no accounts. Runs, ratings and ticks stay in your browser's local storage. Speech recognition (optional)
uses the browser's own service; in Chrome that sends audio to Google for transcription.

## Licence

Content © 2026 Sanjay Gupta. Code MIT. Geist fonts under the SIL Open Font License (`site/fonts/OFL.txt`).
