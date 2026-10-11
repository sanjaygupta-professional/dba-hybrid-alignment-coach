/* Stagecraft — presenter coach. Vanilla JS, no dependencies. All personal progress stays in this browser. */
(function(){
"use strict";
const D = window.DATA;
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/`(.+?)`/g,"<code>$1</code>");
const fmt = sec => { sec=Math.max(0,Math.round(sec)); return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0"); };
const words = s => (String(s).match(/[A-Za-z0-9’'–-]+/g)||[]).length;
const SLIDES = D.slides, N = SLIDES.length;
const TALK = SLIDES.reduce((a,s)=>a+s.seconds,0);

/* ── storage (never throws) ── */
const store = {
  get(k, d){ try{ const v=localStorage.getItem("sc."+k); return v==null?d:JSON.parse(v);}catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem("sc."+k, JSON.stringify(v)); }catch(e){} }
};
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("on"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("on"),2200); }

/* ── theme ── */
function setScheme(s){
  if(s) document.documentElement.setAttribute("data-scheme", s); else document.documentElement.removeAttribute("data-scheme");
  store.set("scheme", s); try{ localStorage.setItem("sc.scheme", s||""); }catch(e){}
  const cur = s || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  $$(".seg.theme button").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.scheme===cur)));
}
$$(".seg.theme button").forEach(b=>b.addEventListener("click",()=>{ setScheme(b.dataset.scheme); }));
setScheme((()=>{ try{ return localStorage.getItem("sc.scheme")||""; }catch(e){ return ""; } })());

/* ── time to the talk ── */
function talkTime(){ const o=store.get("slot",null); return new Date(o || D.meta.date_iso); }
function untilTalk(){ return talkTime() - new Date(); }
function tickChip(){
  const c=$("#chip"), d=daysToTalk();
  c.innerHTML = d>1 ? `<b>${d} days</b> to stage` : d===1 ? "<b>Tomorrow</b> is stage day" : d===0 ? "<b>Stage day</b>" : "after the talk";
}

/* ── status model: four separate states, never one readiness score ── */
function status(){
  const runs=store.get("runs",[]), conf=store.get("conf",{}), checks=store.get("checks",{});
  const fulls=runs.filter(r=>r.full), last=fulls[fulls.length-1];
  const inBudget=fulls.filter(r=>r.total>=TALK-30&&r.total<=TALK+30);
  const Q=D.quality, gp=Q.evals.filter(e=>e.status==="pass").length;
  const strong=D.questions.filter(q=>conf[q.id]>=4).length, tried=Object.keys(conf).length;
  const open=D.confirm.filter(c=>!checks[c.id]);
  return [
    {k:"Content checked", cls:gp===Q.evals.length&&Q.evals.length?"ok":"warn", val:Q.evals.length?`${gp} of ${Q.evals.length} gates pass`:"not checked", sub:`Quality gate run ${Q.generated}`, href:"#/quality"},
    {k:"Timing observed", cls:!last?"bad":inBudget.length?"ok":"warn", val:!last?"no full run yet":`last run ${fmt(last.total)}`, sub:!last?"A plan is not evidence. Do one timed run.":`${inBudget.length} of ${fulls.length} full runs inside ${fmt(TALK-30)}–${fmt(TALK+30)}`, href:"#/rehearse"},
    {k:"Defence practised", cls:strong>=20?"ok":tried?"warn":"bad", val:tried?`${strong} of ${D.questions.length} rated 4–5`:"not practised", sub:tried?`${tried} questions tried. Self-ratings show practice, not proof.`:"Start a drill: weakest questions come first.", href:"#/viva"},
    {k:"Submission open", cls:open.length?"warn":"ok", val:open.length?`${open.length} of ${D.confirm.length} items open`:"all items confirmed", sub:"Only you can close these.", href:"#/today?go=confirm"}
  ];
}
function nextAction(){
  const runs=store.get("runs",[]), conf=store.get("conf",{}), checks=store.get("checks",{});
  const fulls=runs.filter(r=>r.full);
  if(!store.get("tasks",{}).p1) return {t:"Read the storyline aloud once, slide by slide.", href:"#/story", b:"Open storyline"};
  if(!fulls.length) return {t:"Do one full timed run. Do not stop when you stumble.", href:"#/rehearse", b:"Start a timed run"};
  const last=fulls[fulls.length-1];
  if(Math.abs(last.total-TALK)>30){ const worst=last.splits.reduce((a,x)=>x.dt-SLIDES[x.i].seconds>a.v?{v:x.dt-SLIDES[x.i].seconds,i:x.i}:a,{v:-1e9,i:0});
    return {t:`Your last run was ${fmt(last.total)}. Repair slide ${worst.i+1} (${SLIDES[worst.i].short}), which ran ${Math.round(worst.v)} s over.`, href:"#/rehearse", b:"Drill that slide"}; }
  const weak=D.questions.filter(q=>(conf[q.id]||0)<4);
  if(weak.length>10) return {t:`Drill 5 questions. ${weak.length} are not yet rated 4 or 5.`, href:"#/viva", b:"Start drill"};
  const open=D.confirm.filter(c=>!checks[c.id]);
  if(open.length) return {t:`Close an open item: ${open[0].item.replace(/\*\*/g,"")}.`, href:"#/today?go=confirm", b:"See items"};
  return {t:"Do one more full run, standing, then rest.", href:"#/rehearse", b:"Final run"};
}
function daysToTalk(){ const t=talkTime(), n=new Date(); const f=d=>d.toLocaleDateString("en-CA",{timeZone:"Asia/Singapore"}); return Math.round((new Date(f(t))-new Date(f(n)))/864e5); }

/* ══════════ SLIDE RENDERER (shared by thumbnails, stage, presenter) ══════════ */
function slideHTML(s){
  const foot = `<div class="s-foot"><span>${esc(D.meta.footer)}</span><span>${s.n} / ${N}</span></div>`;
  if(s.kind==="title"){
    return `<div class="in title-slide"><div class="grid-bg"></div>
      <div class="s-eyebrow">${esc(D.meta.eyebrow)}</div>
      <div class="s-title">${md(s.title)}</div>
      <div class="sub">${md(s.subtitle||"")}</div>
      <div style="margin-top:3cqw;font:500 1.5cqw var(--mono);color:var(--muted)">${esc(D.meta.presenter)} · ${esc(D.meta.programme)}</div>
      <div style="flex:1"></div>${foot}</div>`;
  }
  let body="";
  if(s.stats){
    body=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:2cqw 3cqw">${s.stats.map(x=>`<div class="stat"><span class="v">${esc(x.v)}</span><span><span class="t">${md(x.t)}</span><br><span class="src">${esc(x.src)}</span></span></div>`).join("")}</div>`;
    if(s.bullets) body+=`<ul style="margin-top:2cqw">${s.bullets.map(b=>`<li>${md(b)}</li>`).join("")}</ul>`;
  } else if(s.bullets && s.table){
    body=`<div style="display:grid;grid-template-columns:38% 1fr;gap:2.4cqw;align-items:start"><ul>${s.bullets.map(b=>`<li>${md(b)}</li>`).join("")}</ul>${tableHTML(s)}</div>`;
  } else if(s.bullets){
    body=`<ul>${s.bullets.map(b=>`<li>${md(b)}</li>`).join("")}</ul>`;
  } else if(s.columns){
    body=`<div class="cols" style="--n:${s.columns.length}">${s.columns.map(c=>`<div class="col"><h5>${esc(c.head)}</h5><ul>${c.items.map(i=>`<li>${md(i)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  } else if(s.table){
    body=tableHTML(s);
  } else if(s.cascade){
    body=`<div class="cascade"><div>${D.levels.map(l=>`<div class="lv ${l.id==="L4"?"l4":""}"><b>${l.id}</b>${esc(l.name)}</div>`).join("")}
      <div style="font-size:.72em;color:var(--muted);margin-top:1.2cqw">${esc(s.cascade.interfaces||"")}</div></div>
      <div><div style="font:600 .78em var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent-ink);margin-bottom:1cqw">${esc(s.cascade.right_head)}</div>
      <ul style="font-size:.95em">${s.cascade.right.map(i=>`<li>${md(i)}</li>`).join("")}</ul></div></div>`;
  }
  return `<div class="in"><div class="s-eyebrow">${esc(s.eyebrow||"")}</div><div class="s-title">${md(s.title)}</div>
    <div class="s-body">${body}</div>${s.note?`<div class="s-note">${md(s.note)}</div>`:""}${foot}</div>`;
}
function tableHTML(s){
  const [hd,...rows]=s.table, tot=(s.widths||[]).reduce((a,b)=>a+b,0);
  const cols = s.widths ? `<colgroup>${s.widths.map(w=>`<col style="width:${(100*w/tot).toFixed(1)}%">`).join("")}</colgroup>` : "";
  return `<table class="${rows.length>3||hd.length>4?"dense":""}">${cols}<thead><tr>${hd.map(x=>`<th>${md(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${md(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function slideEl(s, cls=""){ return `<div class="sl ${cls}" role="img" aria-label="Slide ${s.n}: ${esc(s.title.replace(/\*/g,""))}">${slideHTML(s)}</div>`; }

/* auto-fit: shrink a slide's body type until it fits (never below 72%) */
function fitSlides(root=document){
  $$(".sl .s-body",root).forEach(b=>{
    if(!b.offsetParent) return;
    b.style.fontSize=""; let k=1;
    const base=parseFloat(getComputedStyle(b).fontSize);
    while(b.scrollHeight>b.clientHeight+1 && k>0.72){ k-=0.04; b.style.fontSize=(base*k)+"px"; }
  });
}
window.addEventListener("resize",()=>{ clearTimeout(fitSlides._t); fitSlides._t=setTimeout(()=>fitSlides(),120); });

/* ══════════ VIEWS ══════════ */
const V = {};

/* ── Today ── */
V.today = (el, q) => {
  const st=status(), na=nextAction(), tasks=store.get("tasks",{}), slot=store.get("slot",null), dleft=daysToTalk();
  const todayISO=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Singapore"});
  const nextRule = D.coach_tips[Math.floor(Date.now()/864e5)%D.coach_tips.length];
  el.innerHTML = `
  <div class="hero">
    <div class="card main">
      <span class="eyebrow">Wednesday 14 October · Immersion 1 · Singapore</span>
      <h1 id="h-today" style="margin-top:8px">${esc(D.meta.title)}</h1>
      <p class="thesis">${md(D.meta.thesis)}</p>
      <div class="row">
        <button class="btn primary" data-go="present">▶ Present the deck</button>
        <a class="btn" href="#/rehearse">Start a timed run</a>
        <a class="btn" href="#/viva">Drill 5 questions</a>
      </div>
      <div class="hr"></div>
      <div class="row between small"><span class="muted">One-breath purpose</span><button class="btn ghost sm" id="sayPurpose" title="Read aloud">Hear it</button></div>
      <p style="font-weight:550;margin-top:4px">${md(D.meta.purpose)}</p>
    </div>
    <div class="card">
      <span class="kicker">Time to stage</span>
      <div class="clock"><div><b>${dleft<0?"–":dleft}</b><span>${dleft===1?"day":"days"}</span></div><div style="flex:2.2;text-align:left;padding-left:12px"><b style="font-size:16px;font-family:var(--sans)">${esc(D.meta.date_label)}</b><span>${slot?"your slot · "+talkTime().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Singapore"})+" SGT":"slot time not set"}</span></div></div>
      <div class="row" style="margin-top:8px"><button class="btn sm" id="setSlot">${slot?"Change slot time":"Set your slot time"}</button><span class="tiny muted">Stored only in this browser.</span></div>
      <div class="hr"></div>
      <span class="kicker">The 15 minutes</span>
      ${timelineBar()}
      <p class="tiny muted" style="margin-top:6px">${fmt(TALK)} talk · ${fmt(D.meta.qa_seconds)} questions · aim for ${D.meta.wpm[0]}–${D.meta.wpm[1]} words per minute (coach practice)</p>
      <div class="hr"></div>
      <div class="row"><a class="btn sm" href="#/cards">Cue cards</a><a class="btn sm" href="${esc(D.meta.deck_pdf)}" target="_blank" rel="noopener">Deck PDF</a><a class="btn sm" href="${esc(D.meta.deck_pptx||D.meta.deck_pdf)}">Deck PPTX</a></div>
    </div>
  </div>

  <div class="status" style="margin-top:14px">${st.map(x=>`<a class="st ${x.cls}" href="${x.href}" style="text-decoration:none;color:inherit"><span class="lab"><span class="dot"></span>${esc(x.k)}</span><div class="val">${esc(x.val)}</div><div class="tiny muted">${esc(x.sub)}</div></a>`).join("")}</div>
  <div class="next"><div style="flex:1"><span class="eyebrow">Your next action</span><p>${esc(na.t)}</p></div><a class="btn primary" href="${na.href}">${esc(na.b)} →</a></div>

  <div class="section">
    <h2>Your plan to Wednesday <span class="badge">coach practice</span></h2>
    <div class="grid g4">${D.plan.map(d=>`
      <div class="day ${d.date===todayISO?"today":""}"><header><b>${esc(d.label)}</b><span class="mono tiny muted">${esc(d.date.slice(5))}</span></header>
      <ul>${d.tasks.map(t=>`<li class="task ${tasks[t.id]?"done":""}"><label class="check"><input type="checkbox" data-task="${t.id}" ${tasks[t.id]?"checked":""}><span>${md(t.t)}${t.link?` <a href="${t.link}">→</a>`:""} <span class="mono tiny muted">${t.mins}m</span></span></label></li>`).join("")}</ul></div>`).join("")}
    </div>
  </div>

  <div class="section grid g-side">
    <div class="card" id="confirm">
      <h3>Confirm before Wednesday</h3>
      <p class="small muted">Only you can close these. The examiner can ask about each one.</p>
      <div class="stack" style="margin-top:10px">${D.confirm.map(c=>`<label class="check"><input type="checkbox" data-confirm="${c.id}" ${store.get("checks",{})[c.id]?"checked":""}><span><b>${md(c.item)}</b><br><span class="small muted">${md(c.why)}</span></span></label>`).join("")}</div>
    </div>
    <div class="card flat">
      <span class="kicker">Coach tip of the day</span>
      <p style="font-size:15px">${md(nextRule.text)}</p>
      <p class="tiny muted">${esc(nextRule.src)}</p>
      <div class="hr"></div>
      <span class="kicker">What Stagecraft is, and is not</span>
      <p class="small ink2">Stagecraft coaches your <b>proposal presentation</b>. It is not the Hybrid Alignment Diagnostic, and nothing here is evidence for DP1–DP6. Jev checks the coaching content and your practice answers only.</p>
    </div>
  </div>`;
  $("#sayPurpose").onclick=()=>speak(D.meta.purpose.replace(/\*/g,""));
  $("#setSlot").onclick=()=>{
    const cur=talkTime(); const def=cur.toLocaleString("sv-SE",{timeZone:"Asia/Singapore"}).slice(0,16);
    const v=prompt("Your slot in Singapore time (YYYY-MM-DD HH:MM)", def);
    if(!v) return; const m=v.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/);
    if(!m){ toast("Use the form 2026-10-14 10:30"); return; }
    store.set("slot", `${m[1]}T${m[2]}:00+08:00`); render(); tickChip(); toast("Slot time saved");
  };
  bindChecks(el);
  if(q.go) setTimeout(()=>$("#"+q.go)?.scrollIntoView({behavior:"smooth",block:"start"}),80);
};
function timelineBar(){
  return `<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;border:1px solid var(--rule)">${SLIDES.map(s=>`<a href="#/story?s=${s.n}" title="Slide ${s.n}: ${esc(s.short)} · ${s.seconds}s" style="flex:${s.seconds};background:var(--accent-soft);border-right:1px solid var(--raised);display:flex;align-items:center;justify-content:center;font:600 10px var(--mono);color:var(--accent-ink);text-decoration:none">${s.n}</a>`).join("")}<span title="Questions" style="flex:${D.meta.qa_seconds};background:var(--slate-soft);display:flex;align-items:center;justify-content:center;font:600 10px var(--mono);color:var(--slate)">Q&amp;A</span></div>`;
}
function bindChecks(el){
  $$("[data-task]",el).forEach(i=>i.onchange=()=>{ const t=store.get("tasks",{}); t[i.dataset.task]=i.checked; store.set("tasks",t); i.closest(".task")?.classList.toggle("done",i.checked); refreshRing(); });
  $$("[data-confirm]",el).forEach(i=>i.onchange=()=>{ const t=store.get("checks",{}); t[i.dataset.confirm]=i.checked; store.set("checks",t); refreshRing(); });
}
function refreshRing(){ if(route().name==="today"){ const y=scrollY; render(); scrollTo(0,y); } }

/* ── Storyline ── */
V.story = (el, q) => {
  const maxS=Math.max(...SLIDES.map(s=>s.seconds));
  el.innerHTML = `
  <div class="head"><div><span class="eyebrow">Storyline · ${N} slides · ${fmt(TALK)}</span><h1 id="h-story">One argument, ten beats</h1>
    <p>Each slide has one message, a script you can say in its time budget, and the examiner lens it must pass. Bar height shows the time each slide gets.</p></div>
    <div class="row"><a class="btn" href="#/cards">Cue cards</a><button class="btn primary" data-go="present">▶ Present</button></div></div>
  <div class="arc" role="list">${SLIDES.map(s=>`<button role="listitem" style="--w:${s.seconds};--h:${Math.round(35+65*s.seconds/maxS)}%" data-jump="${s.n}" title="${esc(s.short)} · ${s.seconds}s" aria-label="Go to slide ${s.n}, ${esc(s.short)}"><span>${s.n}</span></button>`).join("")}</div>
  <div class="arc-legend">${D.acts.map(a=>`<span>${esc(a)}</span>`).join("")}</div>
  ${SLIDES.map(s=>`
  <article class="slide-row" id="slide-${s.n}">
    <div>
      ${slideEl(s)}
      <div class="slide-meta"><button class="btn sm" data-present="${s.n}">▶ Present from here</button><span class="badge ok">${fmt(s.seconds)}</span><span class="badge">${words(s.script.join(" "))} words</span><span class="badge slate">${esc(s.act)}</span></div>
    </div>
    <div>
      <span class="eyebrow">Slide ${s.n} · ${esc(s.short)}</span>
      <p class="message">${md(s.message)}</p>
      <div class="script">${s.script.map(p=>`<p>${md(p)}</p>`).join("")}</div>
      ${s.transition?`<div class="transition">→ ${md(s.transition)}</div>`:""}
      <div class="grid g2" style="margin-top:10px">
        <div class="lens"><h4>Examiner lens</h4><ul class="small" style="margin:0">${s.lens.map(r=>`<li>${md(r)}</li>`).join("")}</ul></div>
        <div class="lens"><h4 style="color:var(--amber)">Do not</h4><ul class="small" style="margin:0">${s.pitfalls.map(r=>`<li>${md(r)}</li>`).join("")}</ul></div>
      </div>
      ${s.likely_q?.length?`<details class="more" style="margin-top:10px"><summary>Questions this slide invites (${s.likely_q.length})</summary><ul class="small">${s.likely_q.map(id=>{const qq=D.questions.find(x=>x.id===id);return qq?`<li><a href="#/viva?q=${qq.id}">${esc(qq.q)}</a></li>`:"";}).join("")}</ul></details>`:""}
    </div>
  </article>`).join("")}`;
  $$("[data-jump]",el).forEach(b=>b.onclick=()=>{ $("#slide-"+b.dataset.jump).scrollIntoView({behavior:"smooth"}); });
  $$("[data-present]",el).forEach(b=>b.onclick=()=>Stage.open(+b.dataset.present-1));
  if(q.s) setTimeout(()=>$("#slide-"+q.s)?.scrollIntoView(),60);
};

/* ── Cue cards (print) ── */
V.cards = el => {
  el.innerHTML = `<div class="head no-print"><div><span class="eyebrow">Cue cards</span><h1 id="h-cards">Pocket cards, one per slide</h1>
    <p>Print these (Ctrl+P). Each card holds the message, three spoken anchors and the hand-off line. Do not read them on stage. Glance, then look up.</p></div>
    <button class="btn primary" onclick="window.print()">Print</button></div>
  ${SLIDES.map(s=>`<div class="card cue" style="margin-bottom:12px"><div class="row between"><span class="eyebrow">Slide ${s.n} · ${esc(s.short)}</span><span class="mono small">${fmt(s.seconds)} · ends by ${fmt(SLIDES.slice(0,s.n).reduce((a,x)=>a+x.seconds,0))}</span></div>
    <p class="message">${md(s.message)}</p><ol class="small">${s.anchors.map(a=>`<li>${md(a)}</li>`).join("")}</ol>${s.transition?`<div class="transition small">→ ${md(s.transition)}</div>`:""}</div>`).join("")}`;
  el.classList.add("print-target");
};

/* ── Deck print view (used by evals/export_pdf.mjs and Ctrl+P) ── */
V.deck = el => {
  el.innerHTML = `<div class="head no-print"><div><span class="eyebrow">Deck</span><h1 id="h-deck">All ten slides</h1><p>Print to PDF at 16:9 (Ctrl+P, landscape, no margins).</p></div><button class="btn primary" onclick="window.print()">Print</button></div>
  <div class="deckprint">${SLIDES.map(s=>slideEl(s)).join("")}</div>`;
  el.classList.add("print-target");
};

/* ── Rehearse ── */
const R = { on:false, i:0, t0:0, slideT0:0, splits:[], rec:null, heard:"", interim:"", fillers:0, timer:null, mode:"full" };
V.rehearse = el => {
  const runs=store.get("runs",[]);
  el.innerHTML = `
  <div class="head"><div><span class="eyebrow">Rehearse · coach practice</span><h1 id="h-rehearse">Timed run-through</h1>
    <p>Speak the talk out loud. Press <kbd>Space</kbd> or <kbd>→</kbd> to move to the next slide. Stagecraft records your time per slide. In Chrome, it can also listen and count your pace and filler words. The audio stays in your browser.</p></div>
    <div class="row"><div class="seg" role="group" aria-label="Run mode"><button data-mode="full" aria-pressed="${R.mode==="full"}">Full talk</button><button data-mode="one" aria-pressed="${R.mode==="one"}">One slide</button></div>
      <select id="oneSlide" aria-label="Slide to rehearse" style="width:auto;${R.mode==="one"?"":"display:none"}">${SLIDES.map(s=>`<option value="${s.n-1}">${s.n}. ${esc(s.short)}</option>`).join("")}</select></div></div>
  <div class="grid g-side">
    <div class="card" style="padding:0;overflow:hidden">
      <div class="row between" style="padding:10px 14px;border-bottom:1px solid var(--rule)">
        <span class="small"><b id="rhSlide">Slide 1</b> <span class="muted" id="rhShort"></span></span>
        <span class="row"><label class="check small"><input type="checkbox" id="rhListen" ${store.get("listen",true)?"checked":""}> Listen for pace</label>
        <label class="check small"><input type="checkbox" id="rhScript" ${store.get("showScript",true)?"checked":""}> Show script</label></span>
      </div>
      <div class="prompter" id="prompter" aria-live="off" tabindex="0" aria-label="Script for the current slide"></div>
      <div class="row between" style="padding:10px 14px;border-top:1px solid var(--rule)">
        <span class="row"><button class="btn primary" id="rhGo">Start</button><button class="btn" id="rhNext" disabled>Next slide →</button><button class="btn ghost" id="rhStop" disabled>Stop</button></span>
        <span class="mono small muted" id="rhHint">Tip: stand up and speak at full volume.</span>
      </div>
    </div>
    <div class="stack">
      <div class="card"><div class="row between"><span class="kicker" style="margin:0">This slide</span><span class="mono tiny muted" id="rhBudgetTxt"></span></div>
        <div class="timer" id="rhTimer">00:00</div><div class="budget" id="rhBudget" style="margin-top:8px"><i style="width:0"></i></div>
        <div class="row between" style="margin-top:12px"><span class="kicker" style="margin:0">Whole talk</span><span class="mono small" id="rhTotal">00:00 / ${fmt(TALK)}</span></div>
        <div class="splits" id="rhSplits">${SLIDES.map(s=>`<div title="Slide ${s.n}"><i style="height:0"></i><span>${s.n}</span></div>`).join("")}</div>
      </div>
      <div class="pace"><div class="card"><span class="kicker">Pace</span><b id="rhWpm">–</b><span class="tiny muted">words / min</span><div class="gauge"><i id="rhGauge"></i></div></div>
        <div class="card"><span class="kicker">Fillers</span><b id="rhFill">0</b><span class="tiny muted">um · uh · like · basically · you know</span></div></div>
      <div class="card flat small" id="rhSpeechNote"></div>
    </div>
  </div>
  <div class="section"><h2>Run history</h2>
    ${runs.length?`<div class="tbl-wrap"><table class="history"><thead><tr><th>When</th><th>Mode</th><th class="num">Total</th><th class="num">vs plan</th><th class="num">Avg pace</th><th class="num">Fillers</th><th>Slowest slide</th></tr></thead><tbody>
    ${runs.slice().reverse().slice(0,12).map(r=>{const d=r.total-(r.full?TALK:r.plan); const worst=r.splits.reduce((a,x,i)=>x.dt-(SLIDES[x.i].seconds)>a.v?{v:x.dt-SLIDES[x.i].seconds,i:x.i}:a,{v:-1e9,i:0});
      return `<tr><td>${new Date(r.at).toLocaleString("en-GB",{weekday:"short",hour:"2-digit",minute:"2-digit"})}</td><td>${r.full?"Full":"Slide "+(r.splits[0]?.i+1)}</td><td class="num">${fmt(r.total)}</td><td class="num" style="color:${Math.abs(d)<=60?"var(--accent-ink)":"var(--red)"}">${d>=0?"+":"−"}${fmt(Math.abs(d))}</td><td class="num">${r.wpm||"–"}</td><td class="num">${r.fillers??"–"}</td><td>${worst.v>0?`${worst.i+1}. ${esc(SLIDES[worst.i].short)} (+${Math.round(worst.v)}s)`:"none over"}</td></tr>`;}).join("")}
    </tbody></table></div><div class="row" style="margin-top:8px"><button class="btn ghost sm" id="clearRuns">Clear history</button></div>`
    :`<div class="card flat small muted">No runs yet. Your first full run sets the baseline. Most first runs are 2–3 minutes long; that is normal.</div>`}
  </div>`;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  $("#rhSpeechNote").innerHTML = SR ? "Pace listening uses the browser's speech recognition. In Chrome, the audio goes to Google's speech service for transcription; nothing is stored by Stagecraft. Turn it off if the venue Wi-Fi is weak."
    : "This browser has no speech recognition, so pace and fillers are off. The timer still works. Use Chrome or Edge for pace.";
  if(!SR) $("#rhListen").disabled=true;
  $$("[data-mode]",el).forEach(b=>b.onclick=()=>{ if(R.on) return; R.mode=b.dataset.mode; render(); });
  $("#rhListen").onchange=e=>store.set("listen",e.target.checked);
  $("#rhScript").onchange=e=>{ store.set("showScript",e.target.checked); showPrompter(); };
  $("#rhGo").onclick=rhStart; $("#rhNext").onclick=rhNext; $("#rhStop").onclick=()=>rhEnd(true);
  $("#clearRuns")?.addEventListener("click",()=>{ if(confirm("Delete all run history in this browser?")){ store.set("runs",[]); render(); }});
  $("#oneSlide").onchange=e=>{ R.i=+e.target.value; showPrompter(); };
  R.i = R.mode==="one" ? +$("#oneSlide").value : 0; showPrompter();
};
function showPrompter(){
  const s=SLIDES[R.i], show=store.get("showScript",true);
  $("#rhSlide").textContent=`Slide ${s.n} of ${N}`; $("#rhShort").textContent="· "+s.short;
  $("#rhBudgetTxt").textContent=`budget ${fmt(s.seconds)}`;
  $("#prompter").innerHTML = show ? s.script.map((p,k)=>`<p class="${k===0?"cur":""}">${md(p)}</p>`).join("") + (s.transition?`<p class="cur" style="color:var(--accent-ink);font-style:italic">→ ${md(s.transition)}</p>`:"")
    : `<p class="cur" style="font-size:1.3em">${md(s.message)}</p>${s.anchors.map(a=>`<p class="cur">• ${md(a)}</p>`).join("")}`;
}
function rhStart(){
  R.on=true; R.splits=[]; R.heard=""; R.fillers=0; R.t0=R.slideT0=performance.now(); R.words0=0;
  if(R.mode==="full") R.i=0;
  showPrompter(); $("#rhGo").disabled=true; $("#rhNext").disabled=false; $("#rhStop").disabled=false;
  $("#rhHint").innerHTML='<span class="live-dot"></span> Running · <kbd>Space</kbd> next · <kbd>Esc</kbd> stop';
  R.timer=setInterval(rhTick,200);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SR && store.get("listen",true)){
    try{
      const rec=new SR(); rec.continuous=true; rec.interimResults=true; rec.lang="en-IN";
      rec.onresult=e=>{ let fin="",inter=""; for(let k=e.resultIndex;k<e.results.length;k++){ const t=e.results[k][0].transcript; if(e.results[k].isFinal) fin+=t+" "; else inter+=t; }
        if(fin){ R.heard+=fin; R.fillers+=(fin.toLowerCase().match(/\b(um+|uh+|erm|like|basically|you know|actually|sort of|kind of)\b/g)||[]).length; }
        R.interim=inter; };
      rec.onend=()=>{ if(R.on && R.rec===rec) try{ rec.start(); }catch(e){} };
      rec.onerror=ev=>{ if(ev.error==="not-allowed"){ toast("Microphone blocked; timing only"); R.rec=null; } };
      rec.start(); R.rec=rec;
    }catch(e){ R.rec=null; }
  }
}
function rhTick(){
  const now=performance.now(), s=SLIDES[R.i], dt=(now-R.slideT0)/1000, tot=(now-R.t0)/1000;
  const tm=$("#rhTimer"); if(!tm) return;
  tm.textContent=fmt(dt); tm.className="timer"+(dt>s.seconds*1.15?" over":dt>s.seconds*.9?" warn":"");
  const b=$("#rhBudget"); b.className="budget"+(dt>s.seconds*1.15?" over":dt>s.seconds*.9?" warn":""); b.firstElementChild.style.width=Math.min(100,100*dt/s.seconds)+"%";
  $("#rhTotal").textContent=`${fmt(tot)} / ${fmt(R.mode==="full"?TALK:s.seconds)}`;
  const w=words(R.heard+" "+(R.interim||""));
  if(R.rec && tot>8){ const wpm=Math.round(w/(tot/60)); $("#rhWpm").textContent=wpm; const lo=90,hi=180; $("#rhGauge").style.left=Math.max(0,Math.min(100,100*(wpm-lo)/(hi-lo)))+"%"; R.wpm=wpm; }
  $("#rhFill").textContent=R.fillers;
}
function rhNext(){
  const now=performance.now(); const dt=(now-R.slideT0)/1000;
  R.splits.push({i:R.i,dt}); paintSplit(R.i,dt);
  if(R.mode==="one" || R.i===N-1){ rhEnd(false); return; }
  R.i++; R.slideT0=now; showPrompter();
}
function paintSplit(i,dt){ const d=$$("#rhSplits > div")[i]; if(!d) return; const s=SLIDES[i]; d.className=dt>s.seconds*1.15?"over":dt<s.seconds*.7?"short":""; d.firstElementChild.style.height=Math.min(100,100*dt/(s.seconds*1.5))+"%"; d.title=`Slide ${i+1}: ${fmt(dt)} of ${fmt(s.seconds)}`; }
function rhEnd(aborted){
  if(!R.on) return; R.on=false; clearInterval(R.timer);
  if(R.rec){ const r=R.rec; R.rec=null; try{ r.stop(); }catch(e){} }
  if(aborted && R.splits.length===0){ render(); return; }
  if(aborted){ const dt=(performance.now()-R.slideT0)/1000; R.splits.push({i:R.i,dt}); }
  const total=R.splits.reduce((a,x)=>a+x.dt,0);
  const full=R.mode==="full" && R.splits.length===N;
  const runs=store.get("runs",[]); runs.push({at:Date.now(),full,total:Math.round(total),plan:R.splits.reduce((a,x)=>a+SLIDES[x.i].seconds,0),splits:R.splits.map(x=>({i:x.i,dt:Math.round(x.dt)})),wpm:R.wpm||null,fillers:R.wpm?R.fillers:null});
  store.set("runs",runs.slice(-60)); R.wpm=null;
  const d=total-(full?TALK:SLIDES[R.splits[0].i].seconds);
  toast(full?`Full run: ${fmt(total)} (${d>=0?"+":"−"}${fmt(Math.abs(d))} vs plan)`:`Saved: ${fmt(total)}`);
  render();
}

/* ── Viva Gym ── */
const G = { cat:"All", drill:null, t0:0, timer:null };
let JEV = null; // {ok:true} when local coach server is reachable
const ON_COACH = location.protocol==="http:" && ["127.0.0.1","localhost"].includes(location.hostname) && location.port==="8823";
async function probeJev(force){
  if(JEV!==null && !force) return JEV;
  if(!ON_COACH && !force){ return false; }   // never probe the laptop from the public site unless asked
  JEV=false;
  const base = ON_COACH ? location.origin : "http://127.0.0.1:8823";
  try{ const ctl=new AbortController(); setTimeout(()=>ctl.abort(),1500); const r=await fetch(base+"/api/health",{signal:ctl.signal}); if(r.ok){ const j=await r.json(); JEV = j.jev ? {base} : false; } }catch(e){}
  return JEV;
}
V.viva = async (el, q) => {
  const conf=store.get("conf",{});
  const cats=["All",...D.qcats];
  const list=D.questions.filter(x=>G.cat==="All"||x.cat===G.cat);
  el.innerHTML = `
  <div class="head"><div><span class="eyebrow">Viva Gym · ${D.questions.length} questions</span><h1 id="h-viva">Answer like a researcher</h1>
    <p>Every model answer has three parts: <b>Answer</b> in one sentence, the <b>Evidence</b> behind it, and the <b>Limit</b> you admit before anyone asks. Rate yourself after each one. Drill mode serves your weakest questions first.</p></div>
    <div class="row"><button class="btn primary" id="drillBtn">Start drill</button></div></div>
  <div id="drillBox"></div>
  <div class="qcat" role="group" aria-label="Filter by category">${cats.map(c=>`<button class="chip" data-cat="${esc(c)}" aria-pressed="${G.cat===c}">${esc(c)}<span class="n">${c==="All"?D.questions.length:D.questions.filter(x=>x.cat===c).length}</span></button>`).join("")}</div>
  <div class="qlist">${list.map(x=>`
    <details class="q" id="q-${x.id}" ${q.q===x.id?"open":""}><summary><span class="qn">${x.id.toUpperCase()}</span><span class="qt">${esc(x.q)}</span>
      <span class="row" style="gap:6px;flex-wrap:nowrap">${"●".repeat(x.hard).padEnd(3,"○").split("").map(c=>`<span class="tiny" style="color:${c==="●"?"var(--amber)":"var(--grid-strong)"}">${c}</span>`).join("")}<span class="badge ${conf[x.id]>=4?"ok":conf[x.id]?"warn":""}">${conf[x.id]?"rated "+conf[x.id]:esc(x.cat)}</span></span></summary>
      <div class="ans">
        <div class="aelt a"><span>Answer</span><div>${md(x.a)}</div></div>
        <div class="aelt e"><span>Evidence</span><div>${md(x.e)}</div></div>
        <div class="aelt l"><span>Limit</span><div>${md(x.l)}</div></div>
        ${x.trap?`<div class="aelt"><span style="color:var(--red)">Trap</span><div class="small">${md(x.trap)}</div></div>`:""}
        <div class="row between small"><span class="muted">${x.slide?`Linked to slide ${x.slide} · `:""}${words(x.a+" "+x.e+" "+x.l)} words ≈ ${Math.round(words(x.a+" "+x.e+" "+x.l)/2.2)} s spoken</span>
          <span class="row">How ready are you? <span class="conf" role="group" aria-label="Confidence">${[1,2,3,4,5].map(v=>`<button data-rate="${x.id}" data-v="${v}" aria-pressed="${conf[x.id]===v}" aria-label="${v} of 5">${v}</button>`).join("")}</span></span></div>
      </div></details>`).join("")}</div>`;
  $$("[data-cat]",el).forEach(b=>b.onclick=()=>{ G.cat=b.dataset.cat; render(); });
  $$("[data-rate]",el).forEach(b=>b.onclick=e=>{ e.preventDefault(); const c=store.get("conf",{}); c[b.dataset.rate]=+b.dataset.v; store.set("conf",c);
    $$(`[data-rate="${b.dataset.rate}"]`).forEach(x=>x.setAttribute("aria-pressed",String(x===b))); toast("Saved"); });
  $("#drillBtn").onclick=()=>startDrill();
  if(q.q) setTimeout(()=>$("#q-"+q.q)?.scrollIntoView({block:"center"}),60);
  if(G.drill) drawDrill();
  probeJev();
};
function pickDrill(){
  const conf=store.get("conf",{}), seen=store.get("seen",{});
  const pool=D.questions.map(x=>({x,w:(6-(conf[x.id]||1))*(1+x.hard*.4)/(1+(seen[x.id]||0)*.3)}));
  let r=Math.random()*pool.reduce((a,p)=>a+p.w,0); for(const p of pool){ r-=p.w; if(r<=0) return p.x; } return pool[0].x;
}
function startDrill(){ G.drill={q:pickDrill(),phase:"ask",answer:"",result:null,count:(G.drill?.count||0)+1}; drawDrill(); $("#drillBox").scrollIntoView({behavior:"smooth",block:"start"}); }
function drawDrill(){
  const box=$("#drillBox"); if(!box) return; const d=G.drill, x=d.q;
  clearInterval(G.timer);
  box.innerHTML = `<div class="drill section" style="margin-top:0;margin-bottom:22px">
    <div class="card" style="padding:20px">
      <div class="row between"><span class="eyebrow">Question ${d.count} · ${esc(x.cat)}</span><span class="timer" id="dTimer" style="font-size:26px">01:30</span></div>
      <p class="qbig">${esc(x.q)}</p>
      ${d.phase==="ask"?`
        <p class="small muted">Say your answer out loud first, in 60–90 seconds. Then type its key points to check them.</p>
        <textarea id="dAns" placeholder="Answer → Evidence → Limit">${esc(d.answer)}</textarea>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="dCheck">Check my answer</button><button class="btn" id="dReveal">Show model answer</button><button class="btn ghost" id="dSkip">Next question</button><button class="btn ghost" id="dStop">End drill</button></div>`
      :`
        <div class="ans" style="padding:0;display:grid;gap:10px">
          <div class="aelt a"><span>Answer</span><div>${md(x.a)}</div></div>
          <div class="aelt e"><span>Evidence</span><div>${md(x.e)}</div></div>
          <div class="aelt l"><span>Limit</span><div>${md(x.l)}</div></div></div>
        <div class="row between" style="margin-top:14px"><span class="row small">Rate yourself <span class="conf">${[1,2,3,4,5].map(v=>`<button data-drate="${v}" aria-label="${v} of 5">${v}</button>`).join("")}</span></span>
        <span class="row"><button class="btn primary" id="dNext">Next question</button><button class="btn ghost" id="dStop">End drill</button></span></div>`}
    </div>
    <div class="card"><span class="kicker">Answer check</span><div id="dResult">${d.result?resultHTML(d.result):`${JEV?`<label class="check small" style="margin-bottom:8px"><input type="checkbox" id="liveJev" ${store.get("liveJev",false)?"checked":""}> Send my typed answer to Jev through the local coach server</label>`:`<p class="small muted">Live Jev checks need the coach server on your laptop: <code>python3 tools/coach_server.py</code>, then open <a href="http://127.0.0.1:8823/#/viva">127.0.0.1:8823</a>. The offline checklist works without it.</p>${ON_COACH?"":`<button class="btn sm" id="connectJev">Connect to a running coach server</button>`}`}
      <ul class="small">${D.answer_checks.map(c=>`<li>${esc(c.label)}</li>`).join("")}</ul>`}</div></div>
  </div>`;
  let left=90; const tEl=$("#dTimer");
  if(d.phase==="ask"){ G.timer=setInterval(()=>{ left--; if(!tEl.isConnected){clearInterval(G.timer);return;} tEl.textContent=fmt(Math.abs(left)); tEl.className="timer"+(left<0?" over":left<20?" warn":""); },1000); }
  $("#dAns")?.addEventListener("input",e=>d.answer=e.target.value);
  $("#liveJev")?.addEventListener("change",e=>store.set("liveJev",e.target.checked));
  $("#connectJev")?.addEventListener("click",async()=>{ const j=await probeJev(true); toast(j?"Connected to the local coach":"No coach server found on 127.0.0.1:8823"); if(j){ store.set("liveJev",true); drawDrill(); } });
  $("#dReveal")?.addEventListener("click",()=>{ d.phase="reveal"; markSeen(x.id); drawDrill(); });
  $("#dSkip")?.addEventListener("click",()=>{ markSeen(x.id); startDrill(); });
  $$("#dStop").forEach(b=>b.addEventListener("click",()=>{ G.drill=null; clearInterval(G.timer); box.innerHTML=""; }));
  $("#dNext")?.addEventListener("click",startDrill);
  $$("[data-drate]",box).forEach(b=>b.onclick=()=>{ const c=store.get("conf",{}); c[x.id]=+b.dataset.drate; store.set("conf",c); $$("[data-drate]",box).forEach(y=>y.setAttribute("aria-pressed",String(y===b))); toast("Saved"); });
  $("#dCheck")?.addEventListener("click",async()=>{
    const ans=d.answer.trim(); if(words(ans)<8){ toast("Type at least one full sentence"); return; }
    $("#dResult").innerHTML='<p class="small muted">Checking…</p>';
    d.result = await scoreAnswer(x, ans); d.phase="reveal"; markSeen(x.id); drawDrill();
  });
}
function markSeen(id){ const s=store.get("seen",{}); s[id]=(s[id]||0)+1; store.set("seen",s); }
async function scoreAnswer(x, ans){
  const j=await probeJev();
  if(j && store.get("liveJev",false)){
    try{ const r=await fetch(j.base+"/api/score",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({qid:x.id,answer:ans})});
      if(r.ok){ const o=await r.json(); return {by:"Jev",items:o.items,ms:o.ms}; } }catch(e){}
  }
  // offline heuristic, clearly labelled
  const lw=ans.toLowerCase(), n=words(ans);
  const items=D.answer_checks.map(c=>{
    let p=0;
    if(c.id==="direct") p = n>=8 ? .6 : .2;
    if(c.id==="evidence") p = /\(\w|et al|\b(19|20)\d\d\b|hevner|peffers|venable|nist|issa|baird|mckinsey|gartner|capgemini|sull|diab|kapoor|vaccaro|buçinca|bucinca|santoni|murray|henderson/.test(lw)?.85:.15;
    if(c.id==="limit") p = /\b(limit|cannot|can't|not yet|unknown|only|however|but|risk|small|bounded|does not)\b/.test(lw)?.8:.15;
    if(c.id==="noclaim") p = /\b(prove[sd]?|guarantee|always|never fails|will show|first ever|nobody has)\b/.test(lw)?.15:.8;
    if(c.id==="length") p = n<=170 ? .9 : .3;
    if(c.id==="ontopic") p = (x.keys||[]).some(k=>lw.includes(k)) ? .8 : .35;
    return {id:c.id,label:c.label,p};
  });
  return {by:"offline",items};
}
function verdict(p){ return p>=.7?{c:"y",t:"yes"}:p<=.3?{c:"n",t:"not yet"}:{c:"u",t:"unclear"}; }
function resultHTML(r){
  const miss=r.items.filter(i=>i.p<.7);
  const fix=miss.length?D.answer_checks.find(c=>c.id===miss[0].id):null;
  return `<p class="tiny muted">${r.by==="Jev"?`Checked by Jev, typed yes/no judgements (${r.ms||"?"} ms). A practice signal, not a grade.`:"Offline keyword estimate. Start the local coach server for Jev checks."}</p>
  ${r.items.map(i=>{const v=verdict(i.p);return `<div class="score-row"><span>${esc(i.label)}</span><span class="verdict ${v.c}">${v.t}</span></div>`;}).join("")}
  ${fix?`<div class="repair"><b>One repair:</b> ${md(fix.repair)}</div>`:`<div class="repair" style="border-color:var(--accent);background:var(--accent-soft)"><b>Solid.</b> Now say it aloud in under 90 seconds.</div>`}`;
}

/* ── Method ── */
V.method = el => {
  el.innerHTML = `
  <div class="head"><div><span class="eyebrow">Method spine · design science research</span><h1 id="h-method">Can you trace every line?</h1>
    <p>${md(D.method.intro)}</p></div></div>
  <div class="card"><div class="row between"><h3>Traceability: sub-problem → objective → question → proposition → data → test</h3><span class="badge ok">no empty cells</span></div>
    <p class="small muted">Select any cell to follow its row. This is the "give me a map" view.</p>
    <div class="trace" id="trace" style="margin-top:10px">
      ${["Sub-problem","Objective (t0 = IRB)","Research question","Design proposition","Data","Test / decision rule"].map(h=>`<div class="th">${h}</div>`).join("")}
      ${D.trace.map((r,i)=>["sp","ro","rq","dp","data","test"].map(k=>`<div class="cell" data-row="${i}" tabindex="0"><b>${esc(r[k+"_id"]||"")}</b>${md(r[k])}</div>`).join("")).join("")}
    </div></div>
  <div class="section"><h2>DSRM: six activities, each with an output</h2>
    <div class="dsrm">${D.dsrm.map(a=>`<div><b>${a.n}. ${esc(a.name)}</b>${md(a.output)}</div>`).join("")}</div>
    <p class="small muted" style="margin-top:6px">${md(D.method.dsrm_note)}</p></div>
  <div class="section grid g2">
    ${D.feds.map(c=>`<div class="card"><span class="kicker">${esc(c.tag)}</span><h3>${esc(c.name)}</h3><ul class="small">${c.items.map(i=>`<li>${md(i)}</li>`).join("")}</ul></div>`).join("")}
  </div>
  <div class="section"><h2>The alignment cascade and six mechanisms</h2>
    <p class="small muted" style="margin-bottom:10px">Select a mechanism. The levels it affects light up, with its evidence rule.</p>
    <div class="casc"><div>${D.levels.map(l=>`<div class="lvl" data-lvl="${l.id}"><b>${l.id}</b>${esc(l.name)}<div class="small muted">${md(l.desc)}</div></div>`).join("")}
      <p class="tiny muted" style="margin-top:10px">${md(D.method.interfaces)}</p></div>
      <div><div class="mech">${D.mechanisms.map(m=>`<button data-m="${m.id}" aria-pressed="false"><b>${m.id}</b>${esc(m.name)}</button>`).join("")}</div>
      <div class="card flat" id="mechBox" style="margin-top:10px;min-height:150px"><p class="small muted">No mechanism selected.</p></div></div></div></div>
  <div class="section grid g2">
    <div class="card"><h3>Kernel theories → what each one informs</h3><div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Kernel theory</th><th>Informs</th></tr></thead><tbody>${D.kernels.map(k=>`<tr><td><b>${esc(k.theory)}</b><br><span class="tiny muted">${esc(k.ref)}</span></td><td>${md(k.informs)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><h3>Why design science, and not…</h3><div class="stack" style="margin-top:8px">${D.alternatives.map(a=>`<div><b>${esc(a.alt)}</b> <span class="ink2">${md(a.why)}</span></div>`).join("")}</div>
      <div class="hr"></div><p class="small"><b>Paradigm:</b> ${md(D.method.paradigm)}</p></div>
  </div>
  <div class="section"><h2>Six self-tests before you present <span class="badge">from the Researcher's Journey</span></h2>
    <div class="grid g3">${D.selftests.map(t=>`<label class="card check" style="align-items:flex-start"><input type="checkbox" data-st="${t.id}" ${store.get("st",{})[t.id]?"checked":""}><span><b>${esc(t.name)}</b><br><span class="small ink2">${md(t.how)}</span><br><span class="tiny muted">${esc(t.src)}</span></span></label>`).join("")}</div></div>`;
  const tr=$("#trace");
  $$(".cell",tr).forEach(c=>{ const f=()=>{ const on=c.classList.contains("hit")&&tr.classList.contains("focus"); $$(".cell",tr).forEach(x=>x.classList.toggle("hit",!on&&x.dataset.row===c.dataset.row)); tr.classList.toggle("focus",!on); };
    c.onclick=f; c.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); f(); } }; });
  $$("[data-m]",el).forEach(b=>b.onclick=()=>{
    const m=D.mechanisms.find(x=>x.id===b.dataset.m), on=b.getAttribute("aria-pressed")!=="true";
    $$("[data-m]",el).forEach(x=>x.setAttribute("aria-pressed",String(on&&x===b)));
    $$(".lvl",el).forEach(l=>l.classList.toggle("lit",on&&m.levels.includes(l.dataset.lvl)));
    $("#mechBox").innerHTML = on ? `<span class="kicker" style="color:var(--amber)">${m.id} · ${esc(m.name)}</span><p><b>Evidence rule:</b> ${md(m.rule)}</p><p class="small"><b>Design requirement:</b> ${md(m.requirement)}</p><p class="small ink2"><b>Illustration:</b> ${md(m.example)}</p>` : '<p class="small muted">No mechanism selected.</p>';
  });
  $$("[data-st]",el).forEach(i=>i.onchange=()=>{ const s=store.get("st",{}); s[i.dataset.st]=i.checked; store.set("st",s); });
};

/* ── Walk-through (illustrative demo) ── */
const W = { step:0 };
V.demo = el => {
  const d=D.demo, st=d.steps[W.step];
  el.innerHTML = `
  <div class="head"><div><span class="eyebrow">Walk-through · illustrative data only</span><h1 id="h-demo">${esc(d.title)}</h1>
    <p>${md(d.intro)}</p></div><span class="badge warn">Illustrative · not a result</span></div>
  <div class="grid g-side">
    <div class="card" style="padding:20px">
      <div class="row between"><span class="eyebrow">Step ${W.step+1} of ${d.steps.length} · ${esc(st.phase)}</span>
        <span class="row"><button class="btn sm" id="wPrev" ${W.step===0?"disabled":""}>← Back</button><button class="btn primary sm" id="wNext" ${W.step===d.steps.length-1?"disabled":""}>Next →</button></span></div>
      <h2 style="margin:10px 0 8px">${esc(st.title)}</h2>
      <p class="ink2">${md(st.text)}</p>
      ${st.table?`<div class="tbl-wrap" style="margin-top:12px"><table><thead><tr>${st.table[0].map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${st.table.slice(1).map(r=>`<tr>${r.map(c=>`<td>${statusify(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:""}
      ${st.callout?`<div class="lens" style="margin-top:12px"><h4>What the leader does</h4><p class="small" style="margin:0">${md(st.callout)}</p></div>`:""}
    </div>
    <div class="stack">
      <div class="card"><span class="kicker">The workflow</span><p class="small">${md(d.workflow)}</p>
        <div class="stack small" style="margin-top:8px">${d.chain.map(c=>`<div class="row" style="gap:8px;flex-wrap:nowrap"><span class="badge ${c.level==="L4"?"ok":"slate"}">${c.level}</span><span>${md(c.text)}</span></div>`).join("")}</div></div>
      <div class="card flat"><span class="kicker">How to use this on Wednesday</span><p class="small">${md(d.use)}</p></div>
    </div>
  </div>
  <div class="row" style="margin-top:14px;gap:6px">${d.steps.map((s,i)=>`<button class="chip" data-w="${i}" aria-pressed="${i===W.step}">${i+1}. ${esc(s.phase)}</button>`).join("")}</div>`;
  $("#wPrev").onclick=()=>{ W.step--; render(); }; $("#wNext").onclick=()=>{ W.step++; render(); };
  $$("[data-w]",el).forEach(b=>b.onclick=()=>{ W.step=+b.dataset.w; render(); });
};
function statusify(c){
  const m={"Aligned":"ok","Misaligned":"bad","Unknown":"warn","Disputed":"slate","Met":"ok","Unmet":"bad","Open":"warn"};
  return m[c] ? `<span class="badge ${m[c]}">${esc(c)}</span>` : md(c);
}

/* ── Evidence ── */
V.evidence = (el) => {
  el.innerHTML = `
  <div class="head"><div><span class="eyebrow">Evidence locker</span><h1 id="h-evidence">Say every number exactly right</h1>
    <p>Only these statistics are approved for the talk. Each card gives the safe wording and the wording that an examiner would challenge.</p></div></div>
  <div class="grid g2">${D.stats.map(s=>`<div class="card stat-card"><div class="row between"><span class="v">${esc(s.value)}</span><span class="badge ${s.kind==="forecast"?"warn":s.kind==="vendor survey"?"slate":"ok"}">${esc(s.kind)}</span></div>
    <p style="margin-top:8px">${md(s.label)}</p><div class="say small"><b>Say:</b> ${md(s.say)}</div><div class="never small"><b>Never say:</b> ${md(s.never)}</div><p class="tiny muted" style="margin-top:8px">${esc(s.src)}</p></div>`).join("")}</div>
  <div class="section"><div class="row between"><h2>References in the talk (${D.refs.length})</h2><input type="search" id="refQ" placeholder="Filter references" style="max-width:260px" aria-label="Filter references"></div>
    <div class="card" id="refList">${refsHTML("")}</div></div>`;
  $("#refQ").oninput=e=>{ $("#refList").innerHTML=refsHTML(e.target.value.toLowerCase()); };
};
function refsHTML(q){ return D.refs.filter(r=>!q||r.apa.toLowerCase().includes(q)).map(r=>`<div class="ref">${md(r.apa)} ${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener" class="mono tiny">${esc(r.url.replace(/^https?:\/\//,"").slice(0,48))}</a>`:""}</div>`).join("") || '<p class="small muted">No match.</p>'; }

/* ── Craft ── */
V.craft = el => {
  el.innerHTML = `
  <div class="head"><div><span class="eyebrow">Presenter craft · coach practice</span><h1 id="h-craft">How to own the room for 15 minutes</h1>
    <p>${md(D.craft.intro)}</p></div></div>
  <div class="grid g2">${D.craft.sections.map(s=>`<div class="card"><span class="kicker">${esc(s.tag)}</span><h3>${esc(s.title)}</h3>${s.lead?`<p class="small ink2">${md(s.lead)}</p>`:""}<ul class="small">${s.items.map(i=>`<li>${md(i)}</li>`).join("")}</ul></div>`).join("")}</div>
  <div class="section"><h2>Day-of checklist</h2><div class="grid g3">${D.craft.dayof.map(g=>`<div class="card"><h3>${esc(g.when)}</h3><div class="stack small" style="margin-top:8px">${g.items.map((it,k)=>{const id=g.when+"-"+k; return `<label class="check"><input type="checkbox" data-do="${esc(id)}" ${store.get("dayof",{})[id]?"checked":""}><span>${md(it)}</span></label>`;}).join("")}</div></div>`).join("")}</div></div>`;
  $$("[data-do]",el).forEach(i=>i.onchange=()=>{ const s=store.get("dayof",{}); s[i.dataset.do]=i.checked; store.set("dayof",s); });
};

/* ── Quality ── */
let showAllJev=false;
V.quality = el => {
  const Q=D.quality;
  const pass=Q.evals.filter(e=>e.status==="pass").length;
  el.innerHTML = `
  <div class="head"><div><span class="eyebrow">Quality gate · built ${esc(Q.generated)}</span><h1 id="h-quality">Why you can trust this content</h1>
    <p>Before publication, automated checks and Jev typed judgements ran over every slide, script line and model answer. This page shows the results, including any that did not pass.</p></div>
    <span class="badge ${pass===Q.evals.length?"ok":"warn"}">${pass} of ${Q.evals.length} gates pass</span></div>
  <div class="card" style="padding:4px 4px">${Q.evals.map(e=>`<div class="gate"><span class="id">${esc(e.id)}</span><span class="nm"><b>${esc(e.name)}</b><br><span class="small muted">${md(e.detail)}</span></span><span class="badge ${e.status==="pass"?"ok":e.status==="warn"?"warn":"bad"}">${esc(e.status)}</span></div>`).join("")}</div>
  ${Q.jev?`<div class="section"><h2>Jev typed checks <span class="badge slate">${Q.jev.passed} of ${Q.jev.total} pass</span></h2>
    <p class="small muted">Jev (TypeSafe System One) answers each yes/no question with a probability. Before any check could gate content, each question was calibrated on invented fixtures with known answers (gate E5a). Items that pass only after a signed human review are listed first, with the reason.</p>
    <div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Target</th><th>Check</th><th class="num">p(yes)</th><th>Result</th></tr></thead><tbody>
    ${Q.jev.items.slice().sort((x,y)=>(y.reviewed?1:0)-(x.reviewed?1:0)).slice(0,showAllJev?999:14).map(i=>`<tr><td class="mono tiny">${esc(i.target)}</td><td class="small">${esc(i.check)}${i.reviewed?`<br><span class="tiny muted">Human review: ${esc(i.reviewed)}</span>`:""}</td><td class="num">${i.p.toFixed(2)}</td><td><span class="badge ${i.reviewed?"slate":i.pass?"ok":"bad"}">${i.reviewed?"reviewed":i.pass?"pass":"fail"}</span></td></tr>`).join("")}</tbody></table></div>
    ${showAllJev?"":`<button class="btn sm" id="allJev" style="margin-top:8px">Show all ${Q.jev.items.length} checks</button>`}</div>`:""}
  <div class="section card flat small"><b>Privacy.</b> Stagecraft has no analytics and no account. Your runs, ratings and ticks stay in this browser's local storage. The optional live Jev scoring runs through a server on your own laptop; the API key never reaches this website.</div>`;
  $("#allJev")?.addEventListener("click",()=>{ showAllJev=true; render(); });
};

/* ── Presenter view (second window) ── */
V.presenter = el => {
  el.innerHTML = `<div class="row between" style="margin-bottom:10px"><div><span class="eyebrow">Presenter view</span><h2 id="h-presenter">Notes, timer and next slide</h2></div>
    <span class="row"><button class="btn" id="pvPrev">←</button><button class="btn" id="pvNext">→</button><button class="btn" id="pvReset">Reset timer</button></span></div>
    <div class="pv"><div class="now"><div id="pvCur"></div><div class="card notes" id="pvNotes" style="flex:1"></div></div>
      <div class="card"><div class="row between"><span class="kicker" style="margin:0">Elapsed</span><span class="mono small muted" id="pvPlan"></span></div><div class="timer" id="pvClock">00:00</div>
        <div class="row between" style="margin-top:8px"><span class="kicker" style="margin:0">This slide</span><span class="mono small" id="pvSlideT"></span></div><div class="budget" id="pvBudget"><i></i></div>
        <div class="hr"></div><span class="kicker">Next</span><div id="pvNext2"></div></div>
      <div class="card flat small" id="pvAnchors"></div></div>`;
  Stage.attachPresenter();
};

/* ══════════ STAGE (deck) ══════════ */
const Stage = {
  i:0, t0:null, slideT0:null, ch:null, isPresenter:false,
  init(){
    try{ this.ch=new BroadcastChannel("stagecraft"); this.ch.onmessage=e=>this.onMsg(e.data); }catch(e){}
    $("#stPrev").onclick=()=>this.go(this.i-1); $("#stNext").onclick=()=>this.go(this.i+1);
    $("#stClose").onclick=()=>this.close(); $("#stFull").onclick=()=>this.full();
    $("#stPresenter").onclick=()=>this.openPresenter();
    $("#stageCanvas").onclick=e=>{ if(e.target.closest("a,button")) return; this.go(this.i+1); };
    setInterval(()=>this.tick(),500);
  },
  open(i=0){ this.i=Math.max(0,Math.min(N-1,i)); if(!this.t0) this.t0=Date.now(); this.slideT0=Date.now(); $("#stage").classList.add("on","clean"); document.body.style.overflow="hidden"; this.paint(); this.send(); },
  close(){ $("#stage").classList.remove("on"); document.body.style.overflow=""; if(document.fullscreenElement) document.exitFullscreen?.(); },
  full(){ const s=$("#stage"); if(!document.fullscreenElement) s.requestFullscreen?.().catch(()=>{}); else document.exitFullscreen?.(); },
  go(i){ if(i<0||i>=N) return; this.i=i; this.slideT0=Date.now(); this.paint(); this.send(); },
  paint(){
    const s=SLIDES[this.i];
    if($("#stage").classList.contains("on")){ $("#stageCanvas").innerHTML=`<div class="sl slide-anim">${slideHTML(s)}</div>`; $("#stNum").textContent=`${this.i+1} / ${N}`; $("#stProg").style.width=(100*(this.i+1)/N)+"%"; fitSlides($("#stageCanvas")); }
    if(this.isPresenter) this.paintPresenter();
  },
  tick(){
    if(!this.t0) return; const e=(Date.now()-this.t0)/1000;
    if($("#stage").classList.contains("on")) $("#stClock").textContent=fmt(e);
    if(this.isPresenter && $("#pvClock")){
      const s=SLIDES[this.i], st=(Date.now()-this.slideT0)/1000, plan=SLIDES.slice(0,this.i).reduce((a,x)=>a+x.seconds,0);
      $("#pvClock").textContent=fmt(e); $("#pvClock").className="timer"+(e>TALK+60?" over":e>TALK?" warn":"");
      $("#pvPlan").textContent=`plan at this slide ${fmt(plan)} · ${e-plan>=0?"+":"−"}${fmt(Math.abs(e-plan))}`;
      $("#pvSlideT").textContent=`${fmt(st)} / ${fmt(s.seconds)}`;
      const b=$("#pvBudget"); b.className="budget"+(st>s.seconds*1.15?" over":st>s.seconds*.9?" warn":""); b.firstElementChild.style.width=Math.min(100,100*st/s.seconds)+"%";
    }
  },
  send(){ this.ch?.postMessage({t:"goto",i:this.i,t0:this.t0}); },
  onMsg(m){
    if(m.t==="goto"){ this.i=m.i; if(m.t0) this.t0=m.t0; this.slideT0=Date.now(); this.paint(); }
    if(m.t==="hello" && !this.isPresenter) this.send();
    if(m.t==="reset"){ this.t0=Date.now(); this.slideT0=Date.now(); }
  },
  openPresenter(){ const u=location.href.split("#")[0]+"#/presenter"; window.open(u,"stagecraft-presenter","width=1200,height=780"); },
  attachPresenter(){
    this.isPresenter=true; if(!this.t0) this.t0=Date.now(); this.slideT0=this.slideT0||Date.now();
    this.ch?.postMessage({t:"hello"});
    $("#pvPrev").onclick=()=>this.go(this.i-1); $("#pvNext").onclick=()=>this.go(this.i+1);
    $("#pvReset").onclick=()=>{ this.t0=Date.now(); this.slideT0=Date.now(); this.ch?.postMessage({t:"reset"}); };
    this.paintPresenter();
  },
  paintPresenter(){
    const s=SLIDES[this.i], nx=SLIDES[this.i+1];
    if(!$("#pvCur")) return;
    $("#pvCur").innerHTML=slideEl(s); requestAnimationFrame(()=>fitSlides($("#v-presenter")));
    $("#pvNotes").innerHTML=`<p class="eyebrow">Slide ${s.n} · say this</p><p style="font-weight:600">${md(s.message)}</p>${s.script.map(p=>`<p>${md(p)}</p>`).join("")}${s.transition?`<p style="color:var(--accent-ink);font-style:italic">→ ${md(s.transition)}</p>`:""}`;
    $("#pvNext2").innerHTML= nx ? slideEl(nx) : '<p class="small muted">Last slide. Then questions.</p>';
    $("#pvAnchors").innerHTML=`<span class="kicker">Anchors</span><ol>${s.anchors.map(a=>`<li>${md(a)}</li>`).join("")}</ol>`;
  }
};

/* ══════════ ROUTER ══════════ */
function route(){
  const h=location.hash.replace(/^#\/?/,""); const [name,qs]=h.split("?");
  const q={}; (qs||"").split("&").filter(Boolean).forEach(p=>{ const [k,v]=p.split("="); q[k]=decodeURIComponent(v||""); });
  return {name: V[name] ? name : "today", q};
}
function render(){
  const {name,q}=route();
  $$(".view").forEach(v=>v.classList.remove("on","print-target"));
  const el=$("#v-"+name); el.classList.add("on");
  V[name](el,q);
  requestAnimationFrame(()=>fitSlides(el));
  $$(".nav a").forEach(a=>a.setAttribute("aria-current", a.getAttribute("href")==="#/"+name ? "page" : "false"));
  $$("[data-go=present]",el).forEach(b=>b.onclick=()=>Stage.open(0));
  document.title = (name==="today"?"":({story:"Storyline",rehearse:"Rehearse",viva:"Viva Gym",method:"Method",demo:"Walk-through",evidence:"Evidence",craft:"Craft",quality:"Quality",presenter:"Presenter view",cards:"Cue cards",deck:"Deck"}[name]+" · "))+"Stagecraft";
}
let lastRoute="";
window.addEventListener("hashchange",()=>{ const r=route().name; render(); if(r!==lastRoute) window.scrollTo(0,0); lastRoute=r; $("#nav").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded","false"); });

/* ── keyboard ── */
document.addEventListener("keydown",e=>{
  const tag=(e.target.tagName||"").toLowerCase(); if(tag==="input"||tag==="textarea"||tag==="select"||e.metaKey||e.ctrlKey||e.altKey) return;
  const stageOn=$("#stage").classList.contains("on"), pres=route().name==="presenter";
  if(stageOn||pres){
    if(["ArrowRight","PageDown"," ","Enter"].includes(e.key)){ e.preventDefault(); Stage.go(Stage.i+1); }
    else if(["ArrowLeft","PageUp","Backspace"].includes(e.key)){ e.preventDefault(); Stage.go(Stage.i-1); }
    else if(e.key==="Home") Stage.go(0); else if(e.key==="End") Stage.go(N-1);
    else if(e.key==="Escape" && stageOn) Stage.close();
    else if(e.key.toLowerCase()==="f" && stageOn) Stage.full();
    else if(e.key.toLowerCase()==="v" && stageOn) Stage.openPresenter();
    else if(/^[0-9]$/.test(e.key)){ Stage.go(e.key==="0"?9:+e.key-1); }
    return;
  }
  if(route().name==="rehearse" && R.on){ if(e.key===" "||e.key==="ArrowRight"){ e.preventDefault(); rhNext(); } if(e.key==="Escape") rhEnd(true); return; }
  if(e.key.toLowerCase()==="p" && !e.shiftKey){ Stage.open(0); }
});
$("#presentBtn").onclick=()=>Stage.open(0);
$("#menuBtn").onclick=()=>{ const n=$("#nav"), o=!n.classList.contains("open"); n.classList.toggle("open",o); $("#menuBtn").setAttribute("aria-expanded",String(o)); };

function speak(t){ try{ const u=new SpeechSynthesisUtterance(t); u.rate=.95; u.lang="en-GB"; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){ toast("Speech is not available here"); } }

$("#buildStamp").textContent = "build " + D.quality.generated;
Stage.init(); render(); tickChip(); setInterval(tickChip,30000);
})();
