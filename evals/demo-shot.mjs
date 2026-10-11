import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:8823/#/demo"); await p.waitForTimeout(400);
await p.click('[data-w="2"]'); await p.waitForTimeout(300); await p.screenshot({ path: "out/shots/demo-3.png" });
await p.click('[data-w="5"]'); await p.waitForTimeout(300); await p.screenshot({ path: "out/shots/demo-6.png" });
await b.close();
