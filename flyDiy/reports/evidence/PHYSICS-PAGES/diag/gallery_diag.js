const D = require('./diag2.js'), fs = require('fs');
const FM = JSON.parse(fs.readFileSync(__dirname + '/fiche_masks.json'));
// REAL-FIGURES' planes (tools/real_refs.js PLANES, the live rows), then the official list's reproductions they stand in for
const P = [['cub160', 'Piper Cub, J-3 chord 1.60 m', 'REAL-FIGURES (candidate; stands for the official Cub)'], ['jodel', 'Jodel D112', 'REAL-FIGURES · official'],
  ['pa18f160', 'PA-18 on floats, chord 1.60 m', 'REAL-FIGURES (candidate)'], ['petrelL', 'Super Petrel V4.1', 'REAL-FIGURES (provisional, land)'], ['chinook', 'Chinook', 'REAL-FIGURES · official'],
  ['dc3', 'DC-3-alike', 'REAL-FIGURES (candidate)'], ['stearman', 'Stearman-alike', 'REAL-FIGURES (candidate)'], ['tigermoth', 'Tiger Moth-alike', 'REAL-FIGURES (candidate)'],
  ['camel', 'Camel-alike', 'REAL-FIGURES (candidate)'], ['c172rf', '172R on Wipline 2350 floats', 'REAL-FIGURES'], ['carboncubss', 'Carbon Cub SS', 'REAL-FIGURES (candidate)'],
  ['c172v2', 'Cessna 172 V2-172', 'REAL-FIGURES · the official Cessna for comparisons (list:50, cessna172r_2026-11-08)'],
  ['ruckus', 'Top Rudder Ruckus, standard', 'REAL-FIGURES (candidate) · its own reproduction, not Rufus · the card REAL-FIGURES tests', 'builds/candidates/ruckus_std_2026-11-09.json (on claude/practical-cerf-7fjpwp)'], ['cub', 'Piper Cub', 'official (superseded in REAL-FIGURES by the J-3 chord)'], ['pa18f', 'PA-18 on floats', 'official (superseded by the 1.60 m chord)'],
  ['stolcub', 'STOL Cub', 'official (superseded by the Carbon Cub SS)'], ['cessna', 'Metal Cessna B-CESS (legacy)', 'legacy: the V2-172 above is the Cessna for comparisons now (dropped from REAL-FIGURES)'], ['rufus', 'Rufus', 'official']];
const rows = [];
for (const [k, label, why, fileAs] of P) {
  if (!fs.existsSync(__dirname + '/p_' + k + '.json')) { rows.push({ k, label, why, missing: true }); continue; }
  const rec = JSON.parse(fs.readFileSync(__dirname + '/p_' + k + '.json')); rec.label = label; if (fileAs) rec.file = fileAs.split(' ')[0];
  try { const MK = { cub: 1, jodel: 1, chinook: 1, pa18f: 1, stolcub: 1, cessna: 1, rufus: 1 }; const A = D.analyse(rec, null); /* the editor's own shapes for every plane: no pilot, one source for all (the user, 12 Nov) */ rows.push({ k, label, why, src: A.src, finds: A.finds, aft: A.aft, svg: D.draw(rec, A), file: fileAs || rec.file }); console.log(k, A.src, A.src === 'fiche' ? ['side', 'plan', 'front'].map(v => Math.round(100 * A.V[v].share) + '%').join('/') : '', A.finds.map(f => f.label + ' ' + Math.round(f.d * 100) + '%').join('; ')); }
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
<header style="display:grid;gap:10px"><span class="eyebrow">Wingsmith · diagnostic · not in the game · version 3, checked</span><h1>The drawn plane against what the sim flies</h1>
<section class="panel"><h2>Checked against the crew-free fiches (12 Nov)</h2><ul>
<li><b>The game's own renders agree with this page.</b> Ten planes were rendered without crew on Thursday (claude/diag-fiches). Laid on the editor's silhouette with the physics' own datums, 97 to 100 % of each render's pixels land on it, in all three views, on all ten.</li>
<li><b>The findings are the same.</b> Every finding above comes back from the renders, with two measures that sit right on the 3 % line depending on the source: the Super Petrel's span (editor 8.90 m, render 8.86 m, flown 9.16 m) and the DC-3's chord at half span (editor 3.80 m, render 3.48 m, flown 3.69 m, where the render's hinge gap breaks the chord at its 31 px/m). The Petrel's render also shows its fin top 9 cm lower than the editor's shape.</li>
</ul></section>
<section class="panel"><h2>What changed in version 3</h2><ul>
<li><b>The propeller is drawn where the blades are.</b> Versions 1 and 2 put every disc a fixed 0.12 m ahead of the engine mount's flange, which drew the Cessna's about 10 cm aft of its blades. The disc now stands where the editor draws the hub: 0.255 m ahead of the flange on every Cessna, 0.165 m on the Cubs, behind it on the pushers.</li>
<li><b>The physics' strike disc sits at the flange,</b> not at the blades: the thin dashed line in the side view. A separate physics fix, after the performance round (FLAGSHIP's).</li>
<li><b>The Ruckus is added.</b> It is its own reproduction, not the Rufus: the standard card REAL-FIGURES tests. The Rufus stays.</li>
<li><b>The Cessna for comparisons is the V2-172</b> (list:50, cessna172r_2026-11-08). The metal B-CESS is legacy and labelled so.</li>
<li><b>Metal Cessna B-CESS: closed.</b> The tailplane finding of version 1 (drawn 2.70 m, flown 3.40 m) came from a stale fiche picture. The re-render of 11 Nov shows 3.40 m, matching the editor and the physics.</li>
</ul></section>
<section class="panel"><h2>Version 2</h2><ul>
<li><b>Registration is exact now.</b> The drawn plane is placed with the join's own datums (the firewall station and the keel height, the same numbers the physics is built from), so the overlay no longer depends on a fit. As a check, each official plane's fiche render was laid on that silhouette: 98 to 100 % of its pixels land on it.</li>
<li><b>No pilot.</b> Every plane is drawn from the editor's own shapes, which carry no crew, the same source for all of them.</li>
<li><b>No more see-through bodies.</b> The drawn fuselage is now sampled from the editor's own airframe surface, which the editor scene never skinned. The DC-3, Stearman, Tiger Moth, Camel and the other candidates draw solid.</li>
<li><b>Float and hull members are drawn</b>, in their own colour.</li>
<li><b>Mass points are small</b> (2.6 px at most), so the planform reads.</li>
<li><b>Rufus is added</b> (official).</li>
<li><b>Each plane says what the physics flies for its aft body today.</b> On rod and twin-boom planes it is a fuselage cone where the drawing has a rod or a pod: that is why the Chinook still flies a fuselage. The user's AERO-BODY ruling (fly what is drawn) replaces it.</li>
<li><b>Findings from version 1 that were fitting errors are gone:</b> the Jodel's fin, and the Cub's.</li>
<li><b>A body-depth check is added for rod and twin-boom planes.</b> A rod drawn where the sim flies a full cone has the same length, so the length check could not see it. The depth two thirds of the way down the aft body can. (On conventional fuselages that depth reads 15 to 30 % different on nearly every plane, which points at the sim's frame stations against the drawn skin rather than an error, so it is not flagged there.)</li>
</ul></section>
<p>Every plane REAL-FIGURES validated, then the official planes. Each one is shown in three views, with the drawn plane underneath and the simulation's model on top. Where they differ by more than 3 %, the place is ringed and numbered. Tailplane areas are measured gross, counting the body under the tail, and read 5 to 11 % small on most planes; that is the method, not a fault.</p>
<button type="button" id="zoom">Larger pictures</button></header>
<section class="panel"><h2>Findings, by plane</h2><ul>${sum || '<li>none</li>'}</ul></section>
${rows.map(r => `<section id="${r.k}"><h2>${esc(r.label)}</h2><p class="why">${esc(r.why)} · ${esc(r.file || '')}</p>${r.k === 'cessna' ? '<p class="why" style="color:#a9bd6e">Closed: the tailplane finding (drawn 2.70 m, flown 3.40 m) came from a stale fiche. The 10 Nov fiche picture was out of date; the re-render of 11 Nov shows 3.40 m, the same as the editor and the physics.</p>' : ''}${r.svg ? `<div class="scroll">${r.svg}</div>` : `<p>${r.missing ? 'not loaded' : 'failed: ' + esc(r.err)}</p>`}</section>`).join('')}
</div>
<script>(function(){var z=document.getElementById('zoom');function s(on){document.body.classList.toggle('big',on);z.textContent=on?'Fit pictures':'Larger pictures';}z.onclick=function(){s(!document.body.classList.contains('big'));};if(innerWidth<600)s(true);})();</script>
`;
fs.writeFileSync(__dirname + '/diag.html', html); console.log('diag.html', (html.length / 1024).toFixed(0), 'KB');
