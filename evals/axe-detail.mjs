import { chromium } from "playwright"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const site=path.resolve("../site"); const T={".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2"};
const s=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split("?")[0]);if(p.endsWith("/"))p+="index.html";const f=path.join(site,p);if(!fs.existsSync(f)){console.log("404",p);r.writeHead(404);return r.end();}r.writeHead(200,{"Content-Type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
await new Promise(r=>s.listen(0,"127.0.0.1",r)); const base=`http://127.0.0.1:${s.address().port}/`;
const b=await chromium.launch({executablePath:"/usr/bin/chromium"}); const pg=await b.newPage({viewport:{width:process.argv[2]?+process.argv[2]:1280,height:900}});
for(const r of (process.argv[3]||"today,story,rehearse,viva,method,demo,evidence,craft,quality").split(",")){ await pg.goto(base+"#/"+r); await pg.waitForTimeout(250);
 await pg.addScriptTag({path:"node_modules/axe-core/axe.min.js"});
 const v=await pg.evaluate(async()=>(await axe.run(document.querySelector(".view.on"))).violations.filter(v=>["serious","critical"].includes(v.impact)).map(v=>v.id+" :: "+v.nodes.slice(0,2).map(n=>n.target.join(" ")+" | "+(n.any[0]?.message||"").slice(0,90)).join(" || ")));
 const ov=await pg.evaluate(()=>[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,3).map(e=>e.tagName+"."+e.className));
 console.log(r, v, ov.length?"OVERFLOW:"+ov:""); }
await b.close(); s.close();
