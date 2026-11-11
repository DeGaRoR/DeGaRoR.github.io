// gallery2.js - the PHYSICS-PAGES gallery, built with the game's own module (src/viewer/fiche_physics.js): the four chosen
// pages for the three official planes, the printable cream sheet and the dark screen version
'use strict';
let window_ref = '';
const fs = require('fs'), path = require('path');
const FP = require('/workspace/pp-wt/flyDiy/src/viewer/fiche_physics.js');
const { pics } = require('./fp_try.js');
const KEYS = ['cub', 'c172', 'twin'], SHORT = { cub: 'Piper Cub', c172: 'Metal Cessna', twin: 'Twin busher' };
const R = {}; for (const k of KEYS) R[k] = pics(k);
const WHAT = {
  load: 'The certification bench as the game runs it, at the limit load, every member coloured by the share of its own yield force it carries; below, the same bench carried on until a part lets go, and the scale of what happened when.',
  drag: 'The drag the solver flies with: each disc is a flat plate with the same drag, to scale, with its cost in km/h at cruise. The ranked list beside it is the tuning view: what to fair first.',
  xray: 'The electrics as a real wiring diagram draws them: the battery through its master, the starter through its contactor, the alternator through its field breaker, one bus bar, every load through its own breaker and the radios behind their avionics master. Wires are coloured by circuit and weighted by current, the same on the plan, where every lamp is numbered. The fuel bay and the power budget at night complete the page.',
  model: 'Everything the simulation computes and nothing else, large from above and small from the side: masses, members, lifting panels with their control surfaces, the body\'s two drag points, the propeller disc, the contacts. The rendered plane is the ghost behind it.',
};
let figs = '';
// THE REFERENCE PAGE (prototype): REAL-FIGURES' measurement drawn as a fiche page, one per plane it validated
{ const RP = require('./refpage.js'), RR = require('/workspace/pp-wt/flyDiy/tools/real_refs.js');
  const KS = ['c172v2', 'carboncubss', 'cub160', 'jodel', 'pa18f160', 'chinook', 'c172rf', 'dc3', 'stearman', 'tigermoth', 'camel', 'petrelL'];
  let opts = '', ff = '';
  KS.forEach((k, i) => { const P = RR.PLANES[k] || {}, t = (P.short || P.label || k).split(' (')[0], sv = RP.page(k, t); if (!sv) return;
    opts += `<option value="${k}">${t}</option>`; ff += `<figure class="rfig" data-r="${k}"${i ? ' hidden' : ''}><div class="scroll">${sv}</div></figure>`; });
  window_ref = `<section class="page" id="reference"><div class="head"><h2>Reference <span class="tag">prototype</span></h2><p class="what">A plane against the real one it stands for, drawn from REAL-FIGURES' own measurement and sources. Every published figure sits on one axis of percent from the book. The grey band is the book's own scatter. The coloured bar is ours, from the lightest to the heaviest load the book's figure could have been stated at. Figures measured more than one way (the airframe, the handbook's technique, the game's pilot) get a row each. The real dimensions are beside the chart.</p><label class="pick">Plane <select id="refpick">${opts}</select></label></div>${ff}</section>`; }
// MASS & BALANCE: prototypes for AIRCRAFT-LOOKS' page (theirs to build in the game): the sunburst the user picked, the treemap beside it
{ const MP = require('./massproto.js');
  figs += `<section class="page" id="mass"><div class="head"><h2>Mass &amp; balance <span class="tag">prototype for AIRCRAFT-LOOKS</span></h2><p class="what">Where every kilogram is. The inner ring holds the categories, named along their arcs. The outer ring holds each part of the plane, called out with its kilograms. Hatching marks what the plane carries rather than what it is. Beside it is the weight-and-balance envelope a handbook draws: the CG's good range (the game's own margin bands) up to the maximum take-off weight, the loading walked from empty, and the fuel burnt back out. Below the sunburst is the treemap, for comparison.</p></div>`;
  for (const k of KEYS) { const Dm = MP.data(k);
    figs += `<figure class="fig" data-k="${k}" data-th="sheet"${k === 'cub' ? '' : ' hidden'}><div class="scroll">${MP.page(Dm, 'sunburst')}</div></figure>`;
    figs += `<figure class="fig" data-k="${k}" data-th="screen" hidden><div class="scroll">${MP.page(Dm, 'sunburst')}</div></figure>`;
    figs += `<figure class="fig alt" data-k="${k}" data-th="sheet"${k === 'cub' ? '' : ' hidden'}><div class="scroll">${MP.page(Dm, 'treemap')}</div><figcaption class="altcap">The same plane as a treemap</figcaption></figure>`; }
  figs += `</section>`; }
for (const p of FP.PAGES) {
  figs += `<section class="page" id="${p.id}"><div class="head"><h2>${p.name}</h2><p class="what">${WHAT[p.id]}</p></div>`;
  for (const k of KEYS) for (const th of ['sheet', 'screen'])
    figs += `<figure class="fig" data-k="${k}" data-th="${th}"${k === 'cub' && th === 'sheet' ? '' : ' hidden'}><div class="scroll">${FP.svg(p.id, R[k].D, { theme: th, name: R[k].name, reg: R[k].reg, pics: R[k].pics, sig: 'Wingsmith · certified airworthy' })}</div><figcaption>Swipe sideways for the rest of the page.</figcaption></figure>`;
  figs += `</section>`;
}
const html = `<title>Wingsmith Physics Pages</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* the garage's own look (--ed-* tokens, IBM Plex Sans) around the fiche's pages; one column a phone can read */
:root { color-scheme: dark;
  --ed-board:#1a1815; --ed-panel:#201d1a; --ed-ink:#f4efe6; --ed-dim:#c0b8ac; --ed-faint:#97907f; --ed-acc:#e6dbc9; --ed-acc-ink:#221f1b;
  --ed-hair:rgba(255,248,236,.09); --ed-border:rgba(255,248,236,.14); --ed-btn-bg:rgba(255,255,255,.06); --ed-btn-bd:rgba(255,255,255,.18);
  --sheet:#f3ede0; --sheet-ink:#2b2924;
  --c-structure:#8fb0c4; --c-engine:#e2a056; --c-gear:#a9bd6e; --c-systems:#b99be0; --c-fittings:#6fc2b0; --c-interior:#e0868a; --c-finish:#b7ab9b;
  --sans:'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; --mono:'IBM Plex Mono', ui-monospace, Menlo, monospace; }
body { background:var(--ed-board); color:var(--ed-ink); font:400 15px/1.5 var(--sans); }
body::before { content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top, 0px); z-index:10; background:var(--ed-board); }
.wrap { max-width:1000px; margin:0 auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:28px 56px; display:grid; gap:34px; }
.wrap > *, .page > *, .fig { min-width:0; }
header { display:grid; gap:10px; }
.eyebrow { font:600 11px/1 var(--sans); letter-spacing:.16em; text-transform:uppercase; color:var(--ed-faint); }
h1 { font:600 clamp(26px, 6vw, 36px)/1.1 var(--sans); margin:0; text-wrap:balance; }
h2 { font:600 20px/1.2 var(--sans); margin:0; }
p { margin:0; max-width:68ch; }
.lede, .what { color:var(--ed-dim); } .what { font-size:14px; }
.bar { position:sticky; top:env(safe-area-inset-top, 0px); z-index:5; background:var(--ed-board); padding-block:10px; border-bottom:1px solid var(--ed-hair); display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.seg { display:flex; gap:6px; flex-wrap:wrap; }
.bar button { font:500 11px/1 var(--sans); letter-spacing:.08em; text-transform:uppercase; color:var(--ed-ink); background:var(--ed-btn-bg); border:1px solid var(--ed-btn-bd); border-radius:999px; padding:9px 13px; cursor:pointer; }
.bar button[aria-pressed="true"] { background:var(--ed-acc); color:var(--ed-acc-ink); border-color:var(--ed-acc); }
.bar button:focus-visible { outline:2px solid var(--ed-acc); outline-offset:2px; }
.bar .sp { flex:1; }
.page { display:grid; gap:12px; } .head { display:grid; gap:6px; }
.fig { margin:0; }
.scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; border-radius:12px; }
.scroll svg { display:block; width:100%; height:auto; }
body.big .scroll svg { width:1100px; max-width:none; }
.fig figcaption { font-size:12px; color:var(--ed-faint); margin-top:6px; } body:not(.big) .fig figcaption:not(.altcap) { display:none; }
.pick { font-size:13px; color:var(--ed-dim); display:flex; gap:8px; align-items:center; } .pick select { font:500 13px/1 var(--sans); color:var(--ed-ink); background:var(--ed-panel); border:1px solid var(--ed-btn-bd); border-radius:8px; padding:7px 10px; }
.tag { font:600 10px/1 var(--sans); letter-spacing:.1em; text-transform:uppercase; color:var(--ed-faint); border:1px solid var(--ed-border); border-radius:999px; padding:4px 8px; vertical-align:middle; margin-left:6px; }
.panel { border:1px solid var(--ed-border); border-radius:10px; padding:18px; display:grid; gap:12px; background:var(--ed-panel); }
.panel ul, .panel ol { margin:0; padding-left:20px; display:grid; gap:8px; max-width:70ch; }
.panel li { color:var(--ed-dim); } .panel li b { color:var(--ed-ink); font-weight:500; }
.flow { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; }
.flow div { border:1px solid var(--ed-border); border-radius:8px; padding:12px; display:grid; gap:4px; }
.flow b { font-weight:600; font-size:13.5px; } .flow span { color:var(--ed-dim); font-size:13px; }
.flow i { font-style:normal; font:600 10.5px/1 var(--sans); letter-spacing:.12em; text-transform:uppercase; color:var(--ed-faint); }
code { font:400 12.5px/1.4 var(--mono); color:var(--ed-acc); }
</style>
<div class="wrap">
<header>
  <span class="eyebrow">Wingsmith · fiche pages · built</span>
  <h1>The physics a player never sees</h1>
  <p class="lede">The four pages you picked, drawn by the game's own module from numbers the game's core computes, for the three official planes. Cream is the fiche's printable sheet, the same 3:2 as its shared picture; Screen is the dark version for devlogs and Steam.</p>
</header>
<div class="bar">
  <div class="seg" role="group" aria-label="Plane">${KEYS.map(k => `<button type="button" id="pick-${k}" data-k="${k}" aria-pressed="${k === 'cub'}">${SHORT[k]}</button>`).join('')}</div>
  <span class="sp"></span>
  <div class="seg" role="group" aria-label="Look"><button type="button" id="th-sheet" data-th="sheet" aria-pressed="true">Cream sheet</button><button type="button" id="th-screen" data-th="screen" aria-pressed="false">Screen</button></div>
  <button type="button" id="zoom" aria-pressed="false">Larger</button>
</div>
<section class="panel">
  <h2>Where they live, and how you get there</h2>
  <p class="what">Today the fiche opens three ways, and all three open the same cream board: the note after a certificate ("Certified, the fiche of … is ready · open"), the small <b>fiche</b> button on a plane's row in the garage's fleet list, and the <b>fiche</b> corner on the official tiles of the All planes screen. The board's <b>share</b> button makes one 2400 × 1600 cream picture.</p>
  <div class="flow">
    <div><i>1 · on the board</i><b>A page switch</b><span>Fiche · Mass &amp; price · Load test · Drag · X-ray · The model, along the board's top. AIRCRAFT-LOOKS adds the switch on Thursday; these four pages join it.</span></div>
    <div><i>2 · printable</i><b>Share prints the page you see</b><span>The same 2400 × 1600 cream picture as the fiche, one per page, so each prints as a sheet.</span></div>
    <div><i>3 · official planes</i><b>Ready at once</b><span>Their page data ships baked beside their fiche pictures, no wait.</span></div>
    <div><i>4 · your planes</i><b>Worked out on demand</b><span>Opened on a certified plane on the stand, the bench works its pages out in the background, from 15 s to a minute.</span></div>
    <div><i>5 · promo</i><b>The dark version</b><span>The same pages on the garage's dark panel, for devlogs and Steam (a tool writes them).</span></div>
  </div>
</section>
${figs}
${window_ref}
<section class="panel">
  <h2>How it is built</h2>
  <ul>
    <li><b>The numbers:</b> <code>src/core/66c_gen_fiche_pages.js</code> reads them off the core, no physics of its own: the load test, the garage's test to destruction, the drag build-up, the electrics and the tanks.</li>
    <li><b>The drawing:</b> <code>src/viewer/fiche_physics.js</code> draws each page in either look. It places each callout on the fiche's own pictures by fitting the model onto them. That fit matches the earlier one to the pixel and takes about 0.1 s.</li>
    <li><b>The check:</b> gate PHYSPAGES (<code>tools/_physpages_check.js</code>) holds every number to a separate call of the function it reads. That means a second load test, the bench's own destruction run, the drag totals, the electrical bus and the tank records, on all three planes. It passes: 35 checks per plane, about 90 s.</li>
    <li><b>Not yet wired:</b> the board's page switch waits for AIRCRAFT-LOOKS's Thursday change to the board. On branch <code>claude/physics-pages</code>, for after L39b.</li>
  </ul>
</section>
</div>
<script>
(function () {
  var st = { k: 'cub', th: 'sheet' };
  function paint() {
    document.querySelectorAll('.fig').forEach(function (f) { f.hidden = !(f.dataset.k === st.k && (f.dataset.th === st.th || (f.classList.contains('alt') && st.th === 'screen' && false))); });
    document.querySelectorAll('.bar button[data-k]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === st.k)); });
    document.querySelectorAll('.bar button[data-th]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.th === st.th)); });
    try { localStorage.setItem('pp2', JSON.stringify(st)); } catch (e) {}
  }
  document.querySelectorAll('.bar button[data-k]').forEach(function (b) { b.addEventListener('click', function () { st.k = b.dataset.k; paint(); }); });
  document.querySelectorAll('.bar button[data-th]').forEach(function (b) { b.addEventListener('click', function () { st.th = b.dataset.th; paint(); }); });
  var z = document.getElementById('zoom');
  function zoom(on) { document.body.classList.toggle('big', on); z.setAttribute('aria-pressed', String(on)); z.textContent = on ? 'Fit' : 'Larger'; }
  z.addEventListener('click', function () { zoom(!document.body.classList.contains('big')); });
  if (window.innerWidth < 600) zoom(true);
  try { var s = JSON.parse(localStorage.getItem('pp2') || 'null'); if (s && s.k && s.th) st = s; } catch (e) {}
  paint();
  var rp = document.getElementById('refpick'); if (rp) rp.addEventListener('change', function () { document.querySelectorAll('.rfig').forEach(function (f) { f.hidden = f.dataset.r !== rp.value; }); });
})();
</script>
`;
fs.writeFileSync(path.join(__dirname, 'gallery.html'), html);
console.log('gallery.html', (html.length / 1024).toFixed(0), 'KB');
