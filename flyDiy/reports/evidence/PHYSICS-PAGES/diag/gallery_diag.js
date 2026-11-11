const D = require('./diag.js'), fs = require('fs');
const FM = JSON.parse(fs.readFileSync(__dirname + '/fiche_masks.json'));
// REAL-FIGURES' planes (tools/real_refs.js PLANES, the live rows), then the official list's reproductions they stand in for
const P = [['cub160', 'Piper Cub, J-3 chord 1.60 m', 'REAL-FIGURES (candidate; stands for the official Cub)'], ['jodel', 'Jodel D112', 'REAL-FIGURES · official'],
  ['pa18f160', 'PA-18 on floats, chord 1.60 m', 'REAL-FIGURES (candidate)'], ['petrelL', 'Super Petrel V4.1', 'REAL-FIGURES (provisional, land)'], ['chinook', 'Chinook', 'REAL-FIGURES · official'],
  ['dc3', 'DC-3-alike', 'REAL-FIGURES (candidate)'], ['stearman', 'Stearman-alike', 'REAL-FIGURES (candidate)'], ['tigermoth', 'Tiger Moth-alike', 'REAL-FIGURES (candidate)'],
  ['camel', 'Camel-alike', 'REAL-FIGURES (candidate)'], ['c172rf', '172R on Wipline 2350 floats', 'REAL-FIGURES'], ['carboncubss', 'Carbon Cub SS', 'REAL-FIGURES (candidate)'],
  ['c172v2', 'Cessna 172 V2-172', 'REAL-FIGURES'], ['cub', 'Piper Cub', 'official (superseded in REAL-FIGURES by the J-3 chord)'], ['pa18f', 'PA-18 on floats', 'official (superseded by the 1.60 m chord)'],
  ['stolcub', 'STOL Cub', 'official (superseded by the Carbon Cub SS)'], ['cessna', 'Metal Cessna B-CESS', 'official (dropped from REAL-FIGURES)']];
const rows = [];
for (const [k, label, why] of P) {
  if (!fs.existsSync(__dirname + '/p_' + k + '.json')) { rows.push({ k, label, why, missing: true }); continue; }
  const rec = JSON.parse(fs.readFileSync(__dirname + '/p_' + k + '.json')); rec.label = label;
  try { const A = D.analyse(rec, FM[k] || null); rows.push({ k, label, why, src: A.src, finds: A.finds, svg: D.draw(rec, A), file: rec.file }); console.log(k, A.src, A.finds.map(f => f.label + ' ' + Math.round(f.d * 100) + '%').join('; ')); }
  catch (e) { rows.push({ k, label, why, err: e.message }); console.log(k, 'ERR', e.message); }
}
fs.writeFileSync(__dirname + '/diag_rows.json', JSON.stringify(rows.map(r => Object.assign({}, r, { svg: undefined }))));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sum = rows.filter(r => r.finds && r.finds.length).map(r => `<li><a href="#${r.k}"><b>${esc(r.label)}</b></a>: ${r.finds.map(f => esc(f.label) + ' ' + (f.d > 0 ? '+' : '') + Math.round(f.d * 100) + ' %').join(' · ')}${r.src === 'editor' ? ' <span class="src">(editor shapes)</span>' : ''}</li>`).join('');
const html = `<title>Wingsmith Model Diagnostic</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{color-scheme:dark;--bg:#1a1815;--panel:#201d1a;--ink:#f4efe6;--dim:#c0b8ac;--faint:#97907f;--acc:#e6dbc9;--bad:#e08a5a;--border:rgba(255,248,236,.14);--sans:'IBM Plex Sans',system-ui,sans-serif}
body{background:var(--bg);color:var(--ink);font:400 15px/1.5 var(--sans)}
.wrap{max-width:1000px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 56px;display:grid;gap:28px}
.wrap>*{min-width:0} h1{font:600 clamp(24px,6vw,34px)/1.1 var(--sans);margin:0;text-wrap:balance} h2{font:600 19px/1.25 var(--sans);margin:0}
p{margin:0;max-width:70ch;color:var(--dim)} .eyebrow{font:600 11px/1 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.panel{border:1px solid var(--border);border-radius:10px;padding:18px;background:var(--panel);display:grid;gap:10px}
.panel ul{margin:0;padding-left:20px;display:grid;gap:7px} .panel li{color:var(--dim)} .panel li b{color:var(--ink);font-weight:500} a{color:var(--acc)}
.src{color:var(--bad)} section{display:grid;gap:8px} .why{font-size:13px;color:var(--faint)}
.scroll{overflow-x:auto;border-radius:12px} .scroll svg{display:block;width:100%;height:auto} body.big .scroll svg{width:1100px;max-width:none}
button{font:500 11px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:9px 13px;cursor:pointer;justify-self:start}
</style>
<div class="wrap">
<header style="display:grid;gap:10px"><span class="eyebrow">Wingsmith · diagnostic · not in the game</span><h1>The drawn plane against what the sim flies</h1>
<p>Every plane REAL-FIGURES validated, then the official planes they stand in for. Each one is shown three ways (side, from above, from the front): the drawn plane underneath, and on top the model the simulation flies, made of its lifting panels with control surfaces, members, masses, body drag points, propeller disc, ground contacts, CG and neutral point. Wherever the two differ by more than 3 %, it is ringed and numbered.</p>
<p>The tailplane areas read 3 to 8 % small on most planes. That is probably the method: the drawn area is measured gross, with the body under the tail counted in. Read those with care. The clear findings are the large ones.</p>
<p>Two sources for the drawn plane. Official planes use their fiche: the game's own render, so every measure is compared. Candidates use the editor's own shapes, which have no fuselage skin (the game generates that at run time), so their body is not compared. They need a fiche baked to be compared in full.</p>
<button type="button" id="zoom">Larger pictures</button></header>
<section class="panel"><h2>Findings, by plane</h2><ul>${sum || '<li>none</li>'}</ul></section>
${rows.map(r => `<section id="${r.k}"><h2>${esc(r.label)}</h2><p class="why">${esc(r.why)} · ${esc(r.file || '')}</p>${r.svg ? `<div class="scroll">${r.svg}</div>` : `<p>${r.missing ? 'not loaded' : 'failed: ' + esc(r.err)}</p>`}</section>`).join('')}
</div>
<script>(function(){var z=document.getElementById('zoom');function s(on){document.body.classList.toggle('big',on);z.textContent=on?'Fit pictures':'Larger pictures';}z.onclick=function(){s(!document.body.classList.contains('big'));};if(innerWidth<600)s(true);})();</script>
`;
fs.writeFileSync(__dirname + '/diag.html', html); console.log('diag.html', (html.length / 1024).toFixed(0), 'KB');
