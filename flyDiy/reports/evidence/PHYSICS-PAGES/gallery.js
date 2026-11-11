// gallery.js - the PHYSICS-PAGES prototype gallery: one HTML page, the pictures inline, phone first
'use strict';
const fs = require('fs'), path = require('path');
const R = require('./render.js');
const KEYS = ['cub', 'c172', 'twin'], SHORT = { cub: 'Piper Cub', c172: 'Metal Cessna', twin: 'Twin busher' };
const PAGES = [
  { id: 'load', fn: R.loadTest, name: 'Load test', what: 'The certification bench as the game runs it: the plane on its back on trestles, sandbags to 3.8 g, then 5.7 g. Every member of the airframe the solver flies is drawn where it ended up, the bending made visible, coloured by the share of its own yield force it carries.',
    src: 'makeLoadTest, genLoadStations, GEN_LOAD_LIMIT / GEN_LOAD_ULT (65_gen_loadtest.js); each member\'s yield force fy0 / fc0 from the damage model' },
  { id: 'drag', fn: R.dragPage, name: 'Drag', what: 'The drag build-up the solver flies with. Each disc is a flat plate with the same drag, drawn to the plane\'s scale. Each km/h is the core\'s own cruise rule (drag at 65 % of the thrust, the rule the belly pod\'s cost is solved with), run again with that part\'s drag area taken off. The figures do not add up: each is that part on its own.',
    src: 'genFusCdA, genGearCdA (62_gen_aero.js), the truss and nacelle rows of genParams, genPodCdA (60d_gen_pod.js), genProbeAt / thrustAt' },
  { id: 'elec', fn: R.elecPage, name: 'Electrics', what: 'An X-ray from above: the battery, generator, starter and bus where the frame bills them, every lamp with its draw and its breaker, and the power budget. The endurance is the game\'s own bus (makeBus) run with the generator switched off until the volts drop under 9.',
    src: 'genSystemsResolve parts and breakers, GEN_ELEC, GEN_ELEC_PARTS, GEN_LIGHT_AMPS, genBreakerSize, makeBus (31_elec.js)' },
  { id: 'tank', fn: R.tankPage, name: 'Tanks & structure', what: 'The same X-ray, for what holds the plane together and what it carries: every wing, tail and fuselage member the solver bends, the fuel bay and the tank fitted in it.',
    src: 'def.beams / def.nodes of buildGen, genBayResolve, genVesselResolve (60c_gen_energy.js)' },
];
let figs = '';
for (const P of PAGES) {
  figs += `<section class="page" id="${P.id}"><div class="head"><h2>${P.name}</h2><p class="what">${P.what}</p></div>`;
  for (const k of KEYS) figs += `<figure class="fig" data-k="${k}"${k === 'cub' ? '' : ' hidden'}><div class="scroll">${P.fn(k)}</div><figcaption>Swipe sideways for the rest of the picture.</figcaption></figure>`;
  figs += `<p class="src"><span>From the core:</span> ${P.src}</p></section>`;
}
const D = R.DRAG, E = R.ELEC, L = R.LOAD;
const row = (k, cells) => `<tr><th>${SHORT[k]}</th>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
const nums = `<table class="nums"><thead><tr><th></th><th>Tip at 3.8 g</th><th>Cruise</th><th>Gear costs</th><th>Night load</th><th>Battery alone</th></tr></thead><tbody>${
  KEYS.map(k => row(k, [(L[k].tipM * 100).toFixed(1) + ' cm', Math.round(D[k].Vc * 3.6) + ' km/h', Math.round(D[k].groups.mainGear.dV * 3.6) + ' km/h',
    E[k].night.A.toFixed(1) + ' / ' + E[k].altA + ' A', Math.round(E[k].dark.min) + ' min'])).join('')}</tbody></table>`;

const html = `<title>Wingsmith Physics Pages</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* the garage's own look (--ed-* tokens, IBM Plex Sans), one dark panel per picture, a column a phone can read */
:root { color-scheme: dark;
  --ed-board:#1a1815; --ed-panel:#201d1a; --ed-ink:#f4efe6; --ed-dim:#c0b8ac; --ed-faint:#97907f; --ed-acc:#e6dbc9;
  --ed-warn:#d8a07a; --ed-hair:rgba(255,248,236,.09); --ed-border:rgba(255,248,236,.14); --ed-btn-bg:rgba(255,255,255,.06); --ed-btn-bd:rgba(255,255,255,.18);
  --c-structure:#8fb0c4; --c-engine:#e2a056; --c-gear:#a9bd6e; --c-systems:#b99be0; --c-fittings:#6fc2b0; --c-interior:#e0868a; --c-finish:#b7ab9b;
  --sans:'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; --mono:'IBM Plex Mono', ui-monospace, Menlo, monospace; }
body { background:var(--ed-board); color:var(--ed-ink); font:400 15px/1.5 var(--sans); }
body::before { content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top, 0px); z-index:10; background:var(--ed-board); }
.wrap { max-width:860px; margin:0 auto; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:28px 56px; display:grid; gap:34px; }
header { display:grid; gap:10px; }
.eyebrow { font:600 11px/1 var(--sans); letter-spacing:.16em; text-transform:uppercase; color:var(--ed-faint); }
h1 { font:600 clamp(26px, 6vw, 36px)/1.1 var(--sans); margin:0; text-wrap:balance; }
h2 { font:600 20px/1.2 var(--sans); margin:0; }
h3 { font:600 15px/1.3 var(--sans); margin:0; }
p { margin:0; max-width:65ch; }
.lede { color:var(--ed-dim); }
.bar { position:sticky; top:env(safe-area-inset-top, 0px); z-index:5; background:var(--ed-board); padding-block:10px; border-bottom:1px solid var(--ed-hair); display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.bar button { font:500 11px/1 var(--sans); letter-spacing:.08em; text-transform:uppercase; color:var(--ed-ink); background:var(--ed-btn-bg); border:1px solid var(--ed-btn-bd); border-radius:999px; padding:9px 13px; cursor:pointer; }
.bar button[aria-pressed="true"] { background:var(--ed-acc); color:#221f1b; border-color:var(--ed-acc); }
.bar button:focus-visible, .zoom:focus-visible { outline:2px solid var(--ed-acc); outline-offset:2px; }
.bar .sp { flex:1; }
.zoom { font:500 11px/1 var(--sans); color:var(--ed-dim); background:none; border:1px solid var(--ed-border); border-radius:6px; padding:8px 10px; cursor:pointer; }
.page { display:grid; gap:12px; }
.head { display:grid; gap:6px; }
.what { color:var(--ed-dim); font-size:14px; }
.fig { margin:0; }
.scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; border-radius:10px; }
.scroll svg { display:block; width:100%; height:auto; }
body.big .scroll svg { width:780px; max-width:none; }
.fig figcaption { font-size:12px; color:var(--ed-faint); margin-top:6px; } body:not(.big) .fig figcaption { display:none; }
.src { font:400 12px/1.5 var(--mono); color:var(--ed-faint); }
.src span { font-family:var(--sans); font-weight:600; letter-spacing:.06em; text-transform:uppercase; font-size:10.5px; margin-right:4px; }
.panel { border:1px solid var(--ed-border); border-radius:10px; padding:18px; display:grid; gap:12px; background:var(--ed-panel); }
.panel ul, .panel ol { margin:0; padding-left:20px; display:grid; gap:8px; max-width:65ch; }
.panel li { color:var(--ed-dim); } .panel li b { color:var(--ed-ink); font-weight:500; }
.def { display:block; margin-top:3px; color:var(--ed-acc); font-size:13.5px; }
.tablewrap { overflow-x:auto; }
table.nums { border-collapse:collapse; font-variant-numeric:tabular-nums; font-size:13.5px; min-width:520px; width:100%; }
.nums th, .nums td { text-align:right; padding:8px 10px; border-bottom:1px solid var(--ed-hair); white-space:nowrap; }
.nums thead th { font:600 10.5px/1.2 var(--sans); letter-spacing:.08em; text-transform:uppercase; color:var(--ed-faint); }
.nums tbody th { text-align:left; font-weight:500; }
.key { display:flex; flex-wrap:wrap; gap:6px 14px; font-size:12.5px; color:var(--ed-dim); }
.key i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:-1px; }
@media (prefers-reduced-motion: no-preference) { .fig { animation: in .35s ease-out; } @keyframes in { from { opacity:.6 } to { opacity:1 } } }
</style>
<div class="wrap">
<header>
  <span class="eyebrow">Wingsmith · fiche pages · prototype 1</span>
  <h1>The physics a player never sees</h1>
  <p class="lede">Four fiche pages, drawn from numbers the game already computes for the three official planes, loaded the way the game loads them. Nothing here is new physics: each figure names the core function it comes from. They are meant to sit beside the Mass &amp; price page, work as devlog pictures, and help a player tune the plane.</p>
  <div class="key"><span><i style="background:var(--c-structure)"></i>Structure</span><span><i style="background:var(--c-engine)"></i>Engine &amp; fuel</span><span><i style="background:var(--c-gear)"></i>Gear</span><span><i style="background:var(--c-systems)"></i>Systems</span><span><i style="background:var(--c-fittings)"></i>Fittings</span><span><i style="background:var(--c-interior)"></i>Interior</span><span><i style="background:var(--c-finish)"></i>Finish</span></div>
</header>
<div class="bar" role="group" aria-label="Plane">
  ${KEYS.map(k => `<button type="button" id="pick-${k}" data-k="${k}" aria-pressed="${k === 'cub'}">${SHORT[k]}</button>`).join('')}
  <span class="sp"></span><button type="button" class="zoom" id="zoom" aria-pressed="false">Larger pictures</button>
</div>
${figs}
<section class="panel">
  <h2>The three planes side by side</h2>
  <div class="tablewrap">${nums}</div>
  <p class="what">Gear costs: the main gear's drag taken off at cruise. Battery alone: every light on at night with the generator or alternator dead, run on the game's own bus to 9 V.</p>
</section>
<section class="panel">
  <h2>What making these turned up</h2>
  <ul>
    <li><b>The floats have no air drag of their own.</b> The core charges a float plane as two bare wheels, a third wheel and legs (genGearCdA), and the water code has no air term. The Twin's "floats cost 13 km/h" is the wheel formula's number, so the drag page prints it with an asterisk. Fixing it is a core change, outside this brief.</li>
    <li><b>The Cub runs on the edge at night.</b> Every light on draws 19.5 A from a 20 A generator. The Cessna's 60 A alternator has three times the headroom.</li>
    <li><b>The callouts sit on the baked fiche pictures</b> by fitting the core's nodes onto them, which is good to a few pixels. The game pages would read the camera frame from the fiche bake itself. That needs one re-bake on the GPU box, which I will ask A0 for.</li>
    <li><b>Lamp positions are approximate here.</b> They come from the wing and fin nodes. The game page would read the light layer's own measured sites.</li>
  </ul>
</section>
<section class="panel">
  <h2>Questions for you</h2>
  <ol>
    <li><b>Which pages go in the game?</b> <span class="def">Default: three pages beside Mass &amp; price. Load test, Drag, and one X-ray that merges Electrics with Tanks &amp; structure. The logbook page stays a design for later.</span></li>
    <li><b>The floats' missing air drag:</b> print it with the asterisk now, or wait for a core fix first? <span class="def">Default: the asterisk now, and the gap filed for a core session.</span></li>
    <li><b>Which look for the pictures?</b> <span class="def">Default: the dark garage panel shown here for the devlog and Steam pictures, and the fiche's own cream sheet inside the board if Mass &amp; price uses it, with the same category colours on both.</span></li>
    <li><b>Tuning:</b> should a tap on a drag disc or a member open that part in the garage? <span class="def">Default: not in the first version. Read-only pages first, links in a later round.</span></li>
  </ol>
</section>
</div>
<script>
(function () {
  var btns = document.querySelectorAll('.bar button[data-k]');
  function pick(k) {
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === k)); });
    document.querySelectorAll('.fig').forEach(function (f) { f.hidden = f.dataset.k !== k; });
    try { localStorage.setItem('pp-plane', k); } catch (e) {}
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { pick(b.dataset.k); }); });
  var z = document.getElementById('zoom');
  function zoom(on) { document.body.classList.toggle('big', on); z.setAttribute('aria-pressed', String(on)); z.textContent = on ? 'Fit pictures' : 'Larger pictures'; }
  z.addEventListener('click', function () { zoom(!document.body.classList.contains('big')); });
  if (window.innerWidth < 600) zoom(true);
  try { var k = localStorage.getItem('pp-plane'); if (k && document.getElementById('pick-' + k)) pick(k); } catch (e) {}
})();
</script>
`;
fs.writeFileSync(path.join(__dirname, 'gallery.html'), html);
console.log('gallery.html', (html.length / 1024).toFixed(0), 'KB');
