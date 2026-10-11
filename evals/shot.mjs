import { chromium } from "playwright";
const [,, url, out, w="1440", h="900", scheme=""] = process.argv;
const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
if (scheme) await p.addInitScript(s => { localStorage.setItem("sc.scheme", s); }, scheme);
await p.goto(url); await p.waitForTimeout(700);
await p.screenshot({ path: out, fullPage: process.argv[7] === "full" });
await b.close();
