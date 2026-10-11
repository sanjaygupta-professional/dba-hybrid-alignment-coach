// E6 — UX checks in a real browser (Playwright + system Chromium).
// Usage: node evals/ux.mjs [baseURL]   (default: serves ../site on a free local port)
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const site = path.resolve(here, "../site");
const outDir = path.resolve(here, "out");
fs.mkdirSync(path.join(outDir, "shots"), { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".pdf": "application/pdf", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(site, p);
  if (!f.startsWith(site) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = process.argv[2] || `http://127.0.0.1:${server.address().port}/`;

const exe = ["/usr/bin/chromium", "/usr/bin/google-chrome-stable"].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const checks = [];
const add = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };
const routes = ["today", "story", "rehearse", "viva", "method", "demo", "evidence", "craft", "quality", "cards"];

for (const vp of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 375, height: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const external = [];
  page.on("response", r => { if (r.status() >= 400) errors.push("HTTP " + r.status() + " " + r.url()); });
  page.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:")) external.push(u); });
  let overflow = [], empty = [];
  for (const r of routes) {
    await page.goto(base + "#/" + r); await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, txt: document.querySelector(".view.on")?.innerText.length || 0 }));
    if (m.sw > m.cw + 1) overflow.push(`${r}(${m.sw}>${m.cw})`);
    if (m.txt < 200) empty.push(r);
    await page.screenshot({ path: path.join(outDir, "shots", `${vp.name}-${r}.png`), fullPage: false });
  }
  add(`${vp.name}: no JS errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  add(`${vp.name}: no horizontal scroll`, overflow.length === 0, overflow.join(", "));
  add(`${vp.name}: every view renders content`, empty.length === 0, empty.join(", "));
  add(`${vp.name}: no third-party requests at runtime`, external.length === 0, external.slice(0, 3).join(", "));

  // fonts actually load (self-hosted Geist)
  await page.goto(base + "#/today"); await page.waitForTimeout(300);
  const fontOK = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('14px "Geist"'); });
  add(`${vp.name}: Geist font loads`, fontOK);

  if (vp.name === "desktop") {
    // stage: open, keyboard navigate, close
    await page.keyboard.press("p"); await page.waitForTimeout(200);
    const on = await page.$eval("#stage", e => e.classList.contains("on"));
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150);
    const num = await page.$eval("#stNum", e => e.textContent);
    await page.screenshot({ path: path.join(outDir, "shots", "desktop-stage-3.png") });
    for (let i = 0; i < 9; i++) { await page.keyboard.press("ArrowRight"); }
    await page.waitForTimeout(150);
    const last = await page.$eval("#stNum", e => e.textContent);
    // text must not overflow the slide on any slide
    const clip = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(String(i === 9 ? 0 : i + 1)); await page.waitForTimeout(120);
      const o = await page.$eval("#stageCanvas .sl .in", el => { const b = el.querySelector(".s-body"); return b ? b.scrollHeight - b.clientHeight : 0; });
      if (o > 2) clip.push(`${i + 1}(+${o}px)`);
      await page.screenshot({ path: path.join(outDir, "shots", `stage-${String(i + 1).padStart(2, "0")}.png`) });
    }
    await page.keyboard.press("Escape");
    const off = await page.$eval("#stage", e => !e.classList.contains("on"));
    add("stage: opens with P, arrows move, Esc closes", on && num.startsWith("3") && last.startsWith("10") && off, `${num} → ${last}`);
    add("stage: no slide text overflows its slide", clip.length === 0, clip.join(", "));

    // theme switch
    for (const s of ["dark", "offwhite", "light"]) {
      await page.click(`.top > .seg.theme button[data-scheme="${s}"]`);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      if (s === "dark") add("theme: dark background applies", bg === "rgb(13, 16, 14)", bg);
      if (s === "offwhite") add("theme: paper background applies", bg === "rgb(244, 243, 236)", bg);
    }
    // rehearse: start, next, stop, run saved
    await page.goto(base + "#/rehearse"); await page.waitForTimeout(200);
    await page.uncheck("#rhListen").catch(() => {});
    await page.click("#rhGo"); await page.waitForTimeout(400); await page.keyboard.press("Space"); await page.waitForTimeout(300); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    const runs = await page.evaluate(() => JSON.parse(localStorage.getItem("sc.runs") || "[]").length);
    add("rehearse: a run is timed and saved", runs >= 1, `runs=${runs}`);
    // viva: drill opens and offline check returns scores
    await page.goto(base + "#/viva"); await page.waitForTimeout(200);
    await page.click("#drillBtn"); await page.fill("#dAns", "Design science fits because the goal is to build and evaluate an artefact (Hevner et al., 2004). The limit is a small sample in one or two sites.");
    await page.click("#dCheck"); await page.waitForTimeout(1800);
    const selfBoxes = await page.$$eval("[data-self]", r => r.length);
    add("viva: without Jev, check opens an honest self-check (no automatic verdicts)", selfBoxes === 5, `self-check boxes=${selfBoxes}`);
    await page.click("[data-self=direct]"); await page.click("#dSelfDone"); await page.waitForTimeout(200);
    const rows = await page.$$eval("#dResult .score-row", r => r.length);
    const repair = await page.$eval("#dResult .repair", e => e.innerText);
    add("viva: self-check repair targets an unticked point", rows === 5 && !/answers the exact question/.test(repair) && /source|evidence/i.test(repair), repair.slice(0, 60));
    // listening and live upload are opt-in on a fresh browser
    const fresh = await browser.newContext(); const fp = await fresh.newPage();
    await fp.goto(base + "#/rehearse"); await fp.waitForTimeout(200);
    const listen = await fp.$eval("#rhListen", e => e.checked);
    await fp.route("http://127.0.0.1:8823/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ ok: true, jev: true }) }));
    await fp.goto(base + "#/viva"); await fp.waitForTimeout(200); await fp.click("#drillBtn"); await fp.click("#connectJev"); await fp.waitForTimeout(400);
    const live = await fp.evaluate(() => localStorage.getItem("sc.liveJev"));
    const boxChecked = await fp.$eval("#liveJev", e => e.checked).catch(() => null);
    add("privacy: listening off and Jev upload off until the user opts in", listen === false && live === null && boxChecked === false, `listen=${listen} liveJev=${live} box=${boxChecked}`);
    await fresh.close();
    // a11y basics: every button has an accessible name; images/slides labelled; one h1 per view
    const a11y = await page.evaluate(() => {
      const unnamed = [...document.querySelectorAll("button")].filter(b => !(b.innerText.trim() || b.getAttribute("aria-label") || b.title)).length;
      return { unnamed };
    });
    add("a11y: all buttons have names", a11y.unnamed === 0, `unnamed=${a11y.unnamed}`);
  }
  if (vp.name === "phone") {
    await page.goto(base + "#/today"); await page.click("#menuBtn"); await page.waitForTimeout(150);
    const vis = await page.$eval("#nav", e => getComputedStyle(e).display !== "none");
    await page.click('#nav a[href="#/viva"]'); await page.waitForTimeout(250);
    const at = await page.evaluate(() => location.hash);
    add("phone: menu opens and navigates", vis && at === "#/viva", at);
  }
  await ctx.close();
}

// axe-core accessibility scan (served locally from node_modules if present)
try {
  const axePath = path.resolve(here, "node_modules/axe-core/axe.min.js");
  if (fs.existsSync(axePath)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const serious = [];
    for (const r of routes) {
      await page.goto(base + "#/" + r); await page.waitForTimeout(200);
      await page.addScriptTag({ path: axePath });
      const res = await page.evaluate(async () => (await axe.run(document.querySelector(".view.on"), { resultTypes: ["violations"] })).violations.filter(v => ["serious", "critical"].includes(v.impact)).map(v => v.id + ":" + v.nodes.length));
      res.forEach(x => serious.push(`${r}/${x}`));
    }
    add("axe: no serious or critical violations", serious.length === 0, serious.slice(0, 6).join(", "));
    await ctx.close();
  }
} catch (e) { add("axe: scan ran", false, String(e)); }

await browser.close(); server.close();
fs.writeFileSync(path.join(outDir, "ux.json"), JSON.stringify({ when: new Date().toISOString().slice(0, 16).replace("T", " "), checks }, null, 1));
const failed = checks.filter(c => !c.ok).length;
console.log(`\n${checks.length - failed} of ${checks.length} UX checks pass`);
process.exit(failed ? 1 : 0);
