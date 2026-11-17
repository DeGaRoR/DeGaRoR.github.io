#!/usr/bin/env node
// lawn_page.js - THE USER'S PAGE FOR THE MOWN GRASS STUDY (GRASS-CARDS, 16 Nov 2026): lawn_rig.js's stills and costs as one
// self-contained HTML page (the stills inline as data URIs: the user reads it on the phone), the variants side by side per eye,
// the cost per variant, one question with a default.
// Usage: node tools/perf/lawn_page.js --in <lawn_rig out dir> --out <page.html> --default B [--note "<one line>"]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const IN = path.resolve(opt('in', 'lawn_rig_out')), OUT = path.resolve(opt('out', path.join(IN, 'lawn_page.html'))), DEF = opt('default', 'B'), NOTE = opt('note', '');
const J = JSON.parse(fs.readFileSync(path.join(IN, 'lawn_rig.json'), 'utf8'));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EYE = { cockpit: 'HOME, from the cockpit at the stand', rwyside: 'HOME, beside the runway (1.8 m up, the mown band)', app10: 'HOME, low pass (10 m over the threshold)', cabin: 'Cabin Strip, your back eye (15 Nov)' };
const ORDER = ['master', 'edge', 'A', 'B', 'C', 'D', 'phone'];
const SHORT = { master: 'Today', edge: 'Tue floor (30 cm)', A: 'A', B: 'B', C: 'C', D: 'D', phone: 'Phone' };
const WHAT = { master: 'short tufts, 8 cm (the dots)', edge: 'tufts floored at 30 cm (Tuesday’s stopgap)', A: 'cards, 6 cm, 80 a m²', B: 'cards, 8 cm, 150 a m²',
  C: 'cards, 12 cm, 150 a m²', D: 'cards, 10 cm, 300 a m², to 20 m', phone: 'B at 60 a m², to 20 m' };
const SHOW = opt('eyes', null) ? opt('eyes').split(',') : null;   // the eyes on the page (the costs still read every eye)
const eyes = [...new Set(J.rows.map(r => r.eye))].filter(e => !SHOW || SHOW.includes(e));
const img = f => { try { return 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IN, f)).toString('base64'); } catch (e) { return null; } };
const n1 = v => v == null ? '–' : (+v).toFixed(v < 10 ? 2 : 1);
const k = v => v == null ? '–' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v);
// per config: the worst eye's lawn GPU ms, cards drawn, draws; the field's ms beside it; the cell build
const agg = {};
for (const r of J.rows) { const a = agg[r.config] || (agg[r.config] = { ms: 0, inst: 0, draws: 0, fms: 0, all: 0, cell: 0, frame: [] });
  const L = r.cost && r.cost.lawn || {}, F = r.cost && r.cost.field || {};
  a.ms = Math.max(a.ms, L.ms || 0); a.inst = Math.max(a.inst, (L.instK || 0) * 1000); a.draws = Math.max(a.draws, L.draws || 0);
  a.fms = Math.max(a.fms, F.ms || 0); a.all = Math.max(a.all, (L.ms || 0) + (F.ms || 0)); a.cell = Math.max(a.cell, (r.rings && r.rings.lawn && r.rings.lawn.meanMs) || 0); if (r.frame && r.frame.frameGpuMs) a.frame.push(r.frame.frameGpuMs); }
const cfgs = ORDER.filter(c => agg[c]);
const fig = r => { const src = r.still ? img(r.still) : null, L = r.cost && r.cost.lawn || {}, pick = r.config === DEF;
  return `<figure class="shot${pick ? ' pick' : ''}" id="${esc(r.eye + '-' + r.config)}">
  ${src ? `<a class="x" href="#top">close</a><a href="#${esc(r.eye + '-' + r.config)}"><img src="${src}" alt="${esc(SHORT[r.config] + ', ' + EYE[r.eye])}" loading="lazy"></a>` : '<div class="miss">no picture</div>'}
  <figcaption><b>${esc(SHORT[r.config])}</b>${pick ? '<span class="tag">default</span>' : ''}<span class="what">${esc(WHAT[r.config] || r.label)}</span>
  <span class="num">${r.config === 'master' || r.config === 'edge' ? 'no cards' : `${n1(L.ms)} ms · ${k(Math.round((L.instK || 0) * 1000))} cards · ${L.draws || 0} draws`}</span></figcaption></figure>`; };
const big = r => r.still ? `<a class="big" id="${esc(r.eye + '-' + r.config)}-big" href="#${esc(r.eye + '-' + r.config)}"><img src="${img(r.still)}" alt=""><span>${esc(SHORT[r.config] + ' · ' + EYE[r.eye])} · tap to close</span></a>` : '';
const sections = eyes.map(e => `<section class="eye"><h2>${esc(EYE[e] || e)}</h2><div class="grid">${ORDER.map(c => J.rows.find(r => r.eye === e && r.config === c)).filter(Boolean).map(fig).join('')}</div></section>`).join('');
const bigs = '';   // (a tapped still expands in place: .shot:target - each picture is embedded once)
const table = `<div class="tw"><table><thead><tr><th>variant</th><th>what it is</th><th class="r">all the grass</th><th class="r">cards only</th><th class="r">cards drawn</th><th class="r">draws</th><th class="r">a cell's build</th></tr></thead><tbody>
${cfgs.map(c => { const a = agg[c], card = c !== 'master' && c !== 'edge';
  return `<tr${c === DEF ? ' class="pick"' : ''}><td><b>${esc(SHORT[c])}</b></td><td>${esc(WHAT[c])}</td><td class="r">${n1(a.all)} ms</td><td class="r">${card ? n1(a.ms) + ' ms' : '–'}</td><td class="r">${card ? k(Math.round(a.inst)) : '–'}</td><td class="r">${card ? a.draws : '–'}</td><td class="r">${card ? n1(a.cell) + ' ms' : '–'}</td></tr>`; }).join('\n')}
</tbody></table></div>`;
const html = `<title>Mown Grass Cards</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
/* layout: a short brief and the question first, then one row of side-by-side stills per eye, then the costs */
:root { --bg: #f2f3ee; --panel: #e4e7dc; --fg: #1c211a; --mute: #5b6455; --turf: #3f6a2e; --mark: #b8901c; --line: #c9cebf;
  --display: 'Barlow Condensed', 'Arial Narrow', sans-serif; --body: 'IBM Plex Sans', system-ui, sans-serif; --mono: 'IBM Plex Mono', ui-monospace, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #141812; --panel: #1f251c; --fg: #e3e8dc; --mute: #9aa591; --turf: #8cc06f; --mark: #e0b843; --line: #343c2f; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #141812; --panel: #1f251c; --fg: #e3e8dc; --mute: #9aa591; --turf: #8cc06f; --mark: #e0b843; --line: #343c2f; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 15px/1.55 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 48px }
main { max-width: 1180px; margin: 0 auto; display: grid; gap: 28px }
h1, h2 { font-family: var(--display); font-weight: 600; letter-spacing: .01em; text-wrap: balance; margin: 0 }
h1 { font-size: clamp(30px, 6vw, 44px); line-height: 1.05 } h2 { font-size: 22px; color: var(--turf) }
p { margin: 0; max-width: 65ch } .lead { display: grid; gap: 10px } .mute { color: var(--mute) }
.ask { background: var(--panel); border-left: 4px solid var(--mark); padding: 14px 16px; display: grid; gap: 6px }
.ask b { font-family: var(--display); font-size: 20px; font-weight: 600 }
.eye { display: grid; gap: 12px }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 12px }
.shot { margin: 0; display: grid; gap: 6px; min-width: 0 }
.shot img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; border: 1px solid var(--line) }
.shot.pick img { outline: 3px solid var(--mark); outline-offset: -3px }
.shot figcaption { display: grid; grid-template-columns: auto 1fr; gap: 0 8px; font-size: 13px; align-items: baseline }
.shot figcaption b { font-family: var(--display); font-size: 17px; font-weight: 600 }
.shot .what { grid-column: 1 / -1; color: var(--mute) } .shot .num { grid-column: 1 / -1; font: 12px var(--mono); font-variant-numeric: tabular-nums }
.tag { justify-self: start; font: 600 11px var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--bg); background: var(--mark); padding: 1px 6px }
.miss { aspect-ratio: 16 / 9; display: grid; place-items: center; background: var(--panel); color: var(--mute) }
.tw { overflow-x: auto } table { border-collapse: collapse; width: 100%; font-size: 14px; font-variant-numeric: tabular-nums }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); white-space: nowrap } th { font: 600 12px var(--body); letter-spacing: .05em; text-transform: uppercase; color: var(--mute) }
td.r, th.r { text-align: right; font-family: var(--mono) } tr.pick td { background: var(--panel) } tr.pick td:first-child { box-shadow: inset 4px 0 var(--mark) }
.x { display: none } .shot:target { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.94); align-content: center; padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px)) }
.shot:target img { max-height: 80vh; object-fit: contain; border: 0 } .shot:target figcaption { color: #e3e8dc } .shot:target .what { color: #b9c2b0 }
.shot:target .x { display: block; justify-self: end; color: #e3e8dc; font-size: 14px; padding: 4px 8px }
a:focus-visible { outline: 2px solid var(--mark); outline-offset: 2px }
footer { font-size: 12px; color: var(--mute); display: grid; gap: 4px }
</style>
<main id="top">
  <div class="lead">
    <h1>Mown grass as grass cards</h1>
    <p>You said short grass reads as little dots, never a lawn. Today every mown band is the tall-grass tuft shrunk to 8 cm. This study plants the bench’s grass cards instead (grass_plates: strips of about 40 blades each, never used in the game) on every mown band, apron, verge and grass runway. The wild grass is untouched.</p>
    ${NOTE ? `<p class="mute">${esc(NOTE)}</p>` : ''}
  </div>
  <div class="ask"><b>Which mown grass should ship?</b><p>Default: <b style="font-size:inherit">${esc(SHORT[DEF])}</b> (${esc(WHAT[DEF])}), the variant that reads as a lawn at the lowest cost. The others stay as settings in the F9 world editor.</p></div>
  ${sections}
  <section class="eye"><h2>What each variant costs</h2><p class="mute">GPU time a frame on the RTX 3080 at 1280×720, the worst eye. “All the grass” is the cards plus the tall grass tufts together: with the cards on, the tufts leave the mown ground, so that column is the fair comparison. A cell is 8 m of ground planted once as you fly or taxi.</p>${table}</section>
  <footer><span>GPU: ${esc(J.gpu || '')}. Frames timed: ${esc(J.frames)}. Built from claude/grass-cards on grass-edge.</span><span>Known limit, wild grass only: the tall tufts decide where to grow from the nearest 1 m point, so they can reach up to half a metre onto a paved edge. The cards read the ground between points and stop at the pavement. The tufts are not changed this week.</span><span>The phone row is the phone’s settings shot on the desktop GPU, not a real phone.</span><span>Tap a picture to see it full size.</span></footer>
</main>
${bigs}`;
fs.writeFileSync(OUT, html);
console.log('lawn_page: ' + OUT + ' (' + (html.length / 1e6).toFixed(1) + ' MB, ' + J.rows.length + ' stills)');
