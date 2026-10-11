// Print the site's own slides (benchlm style) to a 16:9 PDF: site/downloads/stagecraft-deck.pdf
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const here = path.dirname(url.fileURLToPath(import.meta.url)); const site = path.resolve(here, "../site");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(site, p);
  if (!f.startsWith(site) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const exe = ["/usr/bin/chromium", "/usr/bin/google-chrome-stable"].find(p => fs.existsSync(p));
const b = await chromium.launch({ executablePath: exe });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem("sc.scheme", "light"); } catch (e) {} });
await page.goto(`http://127.0.0.1:${server.address().port}/#/deck`); await page.waitForTimeout(600);
await page.evaluate(() => document.fonts.ready);
fs.mkdirSync(path.join(site, "downloads"), { recursive: true });
await page.pdf({ path: path.join(site, "downloads/stagecraft-deck.pdf"), width: "16in", height: "9in", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await b.close(); server.close(); console.log("wrote site/downloads/stagecraft-deck.pdf");
