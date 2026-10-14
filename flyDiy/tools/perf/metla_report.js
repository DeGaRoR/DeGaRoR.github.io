#!/usr/bin/env node
// metla_report.js - METLA-ONOFF (G3205, A0 13 Oct: the user's "Metlakatla ON by default" decision): the ABBA of rollout_perf
// runs, A = ?town=0 (Metlakatla off, today's default), B = ?town=1 (on).
//   metla_<n>_<A|B>     THE FIRST VISIT: the Cessna on floats from the SEA lane (Annette Dock) to the Metlakatla seaplane base
//                       (mk_sea, the town's waterfront - a landplane cannot route there: app.js routeFitted turns a water To into
//                       CIRCUIT), 330 s from the reveal. THE NEAR WINDOW: every frame within NEAR m of mk_sea - loop, render,
//                       draws, the frame p99 and worst, the worst main-thread task while near (the town streamed and compiled)
//   metlacub_<n>_<A|B>  the Cub at HOME (stand, taxi), when the slot had time
// Reads <dir>/<prefix>_<n>_<A|B>.json and _mem.txt (tools/perf/chrome_mem.ps1); prints / writes <dir>/metla_onoff.md: per
// side the mean of its runs, B - A, and the go / no-go line: ON costs X ms a frame / Y s of loading / Z MB.
//   node tools/perf/metla_report.js <dir> [--near 1500]
'use strict';
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('metla_report: <dir>'); process.exit(2); }
const NEAR = +(process.argv[process.argv.indexOf('--near') + 1] || 0) || 1500;
let MK = null;
try { const F = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'island_jolene.json'), 'utf8')); const r = F.layers.runways.find(x => x.id === 'mk_sea'); MK = r && r.c; } catch (e) {}
const med = a => { const s = a.filter(x => typeof x === 'number' && isFinite(x)).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
const pct = (a, q) => { const s = a.filter(x => typeof x === 'number' && isFinite(x)).sort((p, r) => p - r); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
function load(f) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), m = /^(\w+?)_(\d+)_([AB])\.json$/.exec(f);
  let ev = j.eval; for (let i = 0; i < 2 && typeof ev === 'string'; i++) { try { ev = JSON.parse(ev); } catch (e) { ev = null; } }   // (rollout_perf stringifies the eval's value)
  const memTxt = (() => { try { return fs.readFileSync(path.join(dir, f.replace('.json', '_mem.txt')), 'utf8'); } catch (e) { return ''; } })();
  const mm = /peak private ([\d,]+) MB, peak working set ([\d,]+) MB/.exec(memTxt);
  const lt = j.longTasks || [], g = (j.tGarage || 0) * 1000, fr = (j.frames || []).filter(r => r[1] > 0);
  const near = MK ? fr.filter(r => typeof r[14] === 'number' && Math.hypot(r[14] - MK[0], r[15] - MK[1]) <= NEAR) : [];
  let closest = null; if (MK) for (const r of fr) if (typeof r[14] === 'number') { const d = Math.hypot(r[14] - MK[0], r[15] - MK[1]); if (closest == null || d < closest) closest = d; }
  const n0 = near.length ? near[0][0] : null, n1 = near.length ? near[near.length - 1][0] : null;   // (s after the reveal)
  const dist = r => (MK && typeof r[14] === 'number' ? Math.hypot(r[14] - MK[0], r[15] - MK[1]) : Infinity);
  const even = rows => { const d = rows.map(r => r[1]).filter(x => x > 0); if (!d.length) return null; let run = 0, best = 0; for (const x of d) { if (x > 34) { run += x; if (run > best) best = run; } else run = 0; }
    const sh = t => 100 * d.filter(x => x > t).length / d.length; return { n: d.length, o34: sh(34), o50: sh(50), o100: sh(100), p95: pct(d, 0.95), p99: pct(d, 0.99), worst: Math.max(...d), run: best / 1000 }; };
  const appr = fr.filter(r => { const x = dist(r); return x > NEAR && x <= 6000; });
  const apPh = []; { let pv = null; for (const r of fr) if (r[16] !== pv) { apPh.push(r[16] + '@' + (+r[0]).toFixed(1)); pv = r[16]; } }
  const wPh = []; { let pv = null; for (const r of fr) if (r[25] && r[25] !== pv) { wPh.push(r[25] + '@' + (+r[0]).toFixed(1)); pv = r[25]; } }
  const ph = j.phases || {}, P = k => ph[k] || {};
  const nm = i => med(near.map(r => r[i]));
  const steps = {}; { let set = null; for (const b of (j.bootLog || [])) { if (b.k === 'run') { set = b.set; continue; } if (b.k === 'step' && set === 'garage') steps[b.id] = (steps[b.id] || 0) + (b.ms || 0); } }
  return { f, pre: m[1], n: +m[2], side: m[3], garage: j.tGarage, rollout: j.tReveal, steps, census: ev && ev.census, gl: ev && ev.gl,
    nearShadow: nm(11), nearWorld: nm(5), nearPrem: nm(12), nearTris: nm(30),
    bootWorst: Math.max(0, ...lt.filter(x => x[0] <= g).map(x => x[1])), afterWorst: Math.max(0, ...lt.filter(x => x[0] > g).map(x => x[1])),
    standLoop: P('stand').workMed, standRender: P('stand').renderMed, standDraws: P('stand').drawsMed,
    taxiLoop: P('taxi').workMed, taxiRender: P('taxi').renderMed, taxiDraws: P('taxi').drawsMed, taxiFps: P('taxi').fpsDelivered,
    nearS: near.length ? n1 - n0 : 0, nearLoop: med(near.map(r => r[2])), nearRender: med(near.map(r => r[10])), nearDraws: med(near.map(r => r[29])),
    nearP99: pct(near.map(r => r[1]), 0.99), nearWorstDt: near.length ? Math.max(...near.map(r => r[1])) : null,
    evNear: even(near), evAppr: even(appr), evAll: even(fr), variant: j.variant, routeTo: j.start && j.start.route ? j.start.route.to : null, apPh, wPh,
    privMB: mm ? +mm[1].replace(/,/g, '') : null, wsMB: mm ? +mm[2].replace(/,/g, '') : null, heapMB: ev && ev.heapMB, houses: ev && ev.houses, town: ev && ev.town, closest };
}
const all = fs.readdirSync(dir).filter(f => /^(metla|metlacub)_\d+_[AB]\.json$/.test(f)).map(load);
if (!all.length) { console.error('metla_report: no runs in ' + dir); process.exit(1); }
const f1 = x => (x == null ? '-' : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)), sg = x => (x == null ? '-' : (x > 0 ? '+' : '') + f1(x));
const L = ['# METLA-ONOFF - Metlakatla OFF (A, ?town=0) vs ON (B, ?town=1), ABBA', '',
  'The box\'s default preset (GFX.get() kept per run). garage = navigation -> garage (s, warm profile), boot worst = the worst main-thread task before it, roll-out = Roll out -> flight (s); loop = the frame\'s JS work, render = renderer.render() CPU (ms), draws a frame (shadows in); memory = Chrome\'s whole process tree (peak private / working set, MB) and the JS heap at the end; closest = the nearest the aeroplane came to the Metlakatla seaplane base (m); NEAR = every frame within ' + NEAR + ' m of it (s spent, loop, render, draws, frame p99 / worst, the worst task).', ''];
// ---- EVENNESS FIRST (the user, 14 Oct: "frame evenness is where it could hurt") - the floats runs, OFF (A) vs ON (B)
{ const FLr = all.filter(r => r.pre === 'metla');
  if (FLr.length) {
    L.push('## FRAME EVENNESS - OFF vs ON (the floats leg; NEAR = within ' + NEAR + ' m of the Metlakatla seaplane base, APPROACH = ' + NEAR + ' m - 6 km, ALL = every frame after the reveal)', '',
      'A frame over 34 ms is a missed 30-fps frame; "longest below 30" = the longest unbroken stretch of such frames (s).', '',
      '| run | window | frames | > 34 ms % | > 50 ms % | > 100 ms % | p95 | p99 | worst | longest below 30 (s) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    const row = (lab, w, e) => L.push('| ' + lab + ' | ' + w + ' | ' + (e ? e.n : 0) + ' | ' + (e ? e.o34.toFixed(1) : '-') + ' | ' + (e ? e.o50.toFixed(1) : '-') + ' | ' + (e ? e.o100.toFixed(2) : '-') + ' | ' + (e ? f1(e.p95) : '-') + ' | ' + (e ? f1(e.p99) : '-') + ' | ' + (e ? f1(e.worst) : '-') + ' | ' + (e ? e.run.toFixed(2) : '-') + ' |');
    for (const r of FLr.sort((a, b) => a.n - b.n)) { const lab = r.f.replace('.json', '') + ' (' + (r.side === 'A' ? 'OFF' : 'ON') + ')'; row(lab, 'near', r.evNear); row(lab, 'approach', r.evAppr); row(lab, 'all', r.evAll); }
    for (const [sd, nm] of [['A', 'OFF'], ['B', 'ON']]) for (const w of ['evNear', 'evAppr', 'evAll']) {
      const es = FLr.filter(r => r.side === sd && r[w]).map(r => r[w]); if (!es.length) continue;
      const m = k => es.reduce((p, e) => p + e[k], 0) / es.length;
      row('**mean ' + nm + '**', w === 'evNear' ? 'near' : w === 'evAppr' ? 'approach' : 'all', { n: Math.round(m('n')), o34: m('o34'), o50: m('o50'), o100: m('o100'), p95: m('p95'), p99: m('p99'), worst: Math.max(...es.map(e => e.worst)), run: Math.max(...es.map(e => e.run)) });
    }
    L.push('', '### The landings (pilot phases and water phases, s after the reveal) - for the Pilot', '');
    for (const r of FLr) L.push('- ' + r.f.replace('.json', '') + ' (to ' + r.routeTo + '): pilot ' + r.apPh.join(' ') + ' | water ' + r.wPh.slice(0, 24).join(' ') + (r.wPh.length > 24 ? ' ...' : ''));
    L.push('', '(The frame rows carry no attitude: a flip is read from the phases - a FLARE / ROLLOUT that goes back to circuit is a skip; STOPPED with the water phase flickering is the float at rest.)', '');
  } }
const S = {};
for (const [pre, title, K] of [
  ['metla', 'THE FLOATS LEG - the Cessna on floats from the SEA lane, 330 s (the route each run flew: see the landings; distances to the Metlakatla seaplane base)', ['garage', 'bootWorst', 'rollout', 'nearS', 'nearLoop', 'nearRender', 'nearDraws', 'nearP99', 'nearWorstDt', 'afterWorst', 'privMB', 'wsMB', 'heapMB', 'houses', 'closest']],
  ['metlacub', 'HOME - the Cub, stand and taxi', ['garage', 'bootWorst', 'rollout', 'standLoop', 'standRender', 'standDraws', 'taxiLoop', 'taxiRender', 'taxiDraws', 'taxiFps', 'afterWorst', 'privMB', 'heapMB', 'houses']]]) {
  const runs = all.filter(r => r.pre === pre).sort((a, b) => a.n - b.n); if (!runs.length) continue;
  const mean = (s, k) => { const v = runs.filter(r => r.side === s).map(r => r[k]).filter(x => typeof x === 'number' && isFinite(x)); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
  const A = Object.fromEntries(K.map(k => [k, mean('A', k)])), B = Object.fromEntries(K.map(k => [k, mean('B', k)]));
  S[pre] = { A, B, D: k => (A[k] != null && B[k] != null ? B[k] - A[k] : null) };
  L.push('## ' + title, '', '| run | ' + K.join(' | ') + ' | town |', '|' + ' --- |'.repeat(K.length + 2));
  for (const r of runs) L.push('| ' + r.f.replace('.json', '') + ' | ' + K.map(k => f1(r[k])).join(' | ') + ' | ' + r.town + ' |');
  L.push('| **A off** | ' + K.map(k => f1(A[k])).join(' | ') + ' | |', '| **B on** | ' + K.map(k => f1(B[k])).join(' | ') + ' | |', '| **B - A** | ' + K.map(k => sg(S[pre].D(k))).join(' | ') + ' | |', '');
  const bad = runs.filter(r => (r.side === 'A' ? !(r.town === false || r.variant === 'nomet-sea') : !(r.town && r.variant !== 'nomet-sea')) || (r.routeTo !== runs[0].routeTo));   // (14 Oct: the floats never routed to mk_sea - every run flew the SEA lane's CIRCUIT, 3.9 km from the town: the A/B holds while the routes agree)
  if (bad.length) L.push('WARNING: void runs (side vs town / variant, or a route unlike the first run\'s): ' + bad.map(r => r.f + ' (town ' + r.town + ', variant ' + r.variant + ', to ' + r.routeTo + ')').join('; '), '');
}
// ---- THE BREAKDOWN (A0 14 Oct: the Metlakatla-ON chantier's baseline) - from the floats runs (they end at the town)
const FL = all.filter(r => r.pre === 'metla');
const sideMean = (s, get) => { const v = FL.filter(r => r.side === s).map(get).filter(x => typeof x === 'number' && isFinite(x)); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
if (FL.length) {
  L.push('## THE BREAKDOWN - where Metlakatla ON goes (the floats runs: the frame over the town, the load, what the scene holds at the end)', '');
  L.push('### The frame over the town (NEAR window medians, ms / counts)', '', '| | loop | render | of it: shadow pass | worldUpdate | premises stream | draws | triangles |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  const FK = ['nearLoop', 'nearRender', 'nearShadow', 'nearWorld', 'nearPrem', 'nearDraws', 'nearTris'];
  const fa = FK.map(k => sideMean('A', r => r[k])), fb = FK.map(k => sideMean('B', r => r[k]));
  L.push('| A off | ' + fa.map(f1).join(' | ') + ' |', '| B on | ' + fb.map(f1).join(' | ') + ' |', '| B - A | ' + fa.map((a, i) => sg(a != null && fb[i] != null ? fb[i] - a : null)).join(' | ') + ' |', '');
  const ids = [...new Set(FL.flatMap(r => Object.keys(r.steps || {})))];
  const st = ids.map(id => ({ id, a: sideMean('A', r => r.steps && r.steps[id]), b: sideMean('B', r => r.steps && r.steps[id]) })).map(x => Object.assign(x, { d: x.a != null && x.b != null ? x.b - x.a : null })).filter(x => x.d != null).sort((p, q) => Math.abs(q.d) - Math.abs(p.d));
  L.push('### The load (the garage boot\'s steps, ms; the ten largest moves)', '', '| step | A off | B on | B - A |', '| --- | --- | --- | --- |');
  for (const x of st.slice(0, 10)) L.push('| ' + x.id + ' | ' + f1(x.a) + ' | ' + f1(x.b) + ' | ' + sg(x.d) + ' |');
  L.push('');
  const cls = [...new Set(FL.flatMap(r => Object.keys(r.census || {})))];
  const cm = (s, c, k) => sideMean(s, r => r.census && r.census[c] ? r.census[c][k] : 0);
  const rows = cls.map(c => ({ c, aT: cm('A', c, 'tris'), bT: cm('B', c, 'tris'), aD: cm('A', c, 'draws'), bD: cm('B', c, 'draws'), bV: cm('B', c, 'inViewTris'), bS: cm('B', c, 'shadowTris'), bSD: cm('B', c, 'shadowDraws'), aG: cm('A', c, 'geoMB'), bG: cm('B', c, 'geoMB'), bX: cm('B', c, 'texMB'), bMk: cm('B', c, 'mkTris') }))
    .map(x => Object.assign(x, { dT: (x.bT || 0) - (x.aT || 0), dD: (x.bD || 0) - (x.aD || 0), dG: (x.bG || 0) - (x.aG || 0) })).sort((p, q) => Math.abs(q.dT) - Math.abs(p.dT));
  const K = n => (n == null ? '-' : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(0) + ' k' : n.toFixed(0));
  const KS = n => (n == null ? '-' : (n > 0 ? '+' : '') + K(n));
  L.push('### What the scene holds at the end (over the town), by class - the visible meshes (draws), their triangles, in the camera\'s view, as shadow casters, geometry / texture MB; mk = Metlakatla\'s own', '',
    '| class | draws off -> on (Δ) | tris off -> on (Δ) | in view (on) | shadow casters (on: draws / tris) | geometry MB (Δ) | textures MB (on) | mk tris (on) |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const x of rows.slice(0, 18)) L.push('| ' + x.c + ' | ' + K(x.aD) + ' -> ' + K(x.bD) + ' (' + KS(x.dD) + ') | ' + K(x.aT) + ' -> ' + K(x.bT) + ' (' + KS(x.dT) + ') | ' + K(x.bV) + ' | ' + K(x.bSD) + ' / ' + K(x.bS) + ' | ' + f1(x.bG) + ' (' + sg(x.dG) + ') | ' + f1(x.bX) + ' | ' + K(x.bMk) + ' |');
  const tot = k => rows.reduce((p, x) => p + (x[k] || 0), 0);
  L.push('| **all** | ' + K(tot('aD')) + ' -> ' + K(tot('bD')) + ' (' + KS(tot('dD')) + ') | ' + K(tot('aT')) + ' -> ' + K(tot('bT')) + ' (' + KS(tot('dT')) + ') | ' + K(tot('bV')) + ' | ' + K(tot('bSD')) + ' / ' + K(tot('bS')) + ' | ' + f1(tot('bG')) + ' (' + sg(tot('dG')) + ') | ' + f1(tot('bX')) + ' | ' + K(tot('bMk')) + ' |', '');
  if (FL.some(r => !r.census)) L.push('(a run without a census: ' + FL.filter(r => !r.census).map(r => r.f).join(', ') + ')', '');
  L.push('### The three biggest levers', '', '(written from these numbers after the run - see below)', '');
}
const V = S.metla, C = S.metlacub;
if (V) L.push('**ON costs ' + sg(V.D('nearLoop')) + ' ms loop / ' + sg(V.D('nearRender')) + ' ms render a frame over the town (draws ' + sg(V.D('nearDraws')) + ', frame p99 ' + f1(V.A.nearP99) + ' -> ' + f1(V.B.nearP99) + ' ms, worst frame ' + f1(V.A.nearWorstDt) + ' -> ' + f1(V.B.nearWorstDt) + ' ms)' +
  (C ? '; at HOME taxi ' + sg(C.D('taxiLoop')) + ' / ' + sg(C.D('taxiRender')) + ' ms' : '') + '; ' + sg(V.D('garage')) + ' s to the garage, ' + sg(V.D('rollout')) + ' s roll-out; ' + sg(V.D('privMB')) + ' MB peak private (' + sg(V.D('heapMB')) + ' MB JS heap).**', '');
fs.writeFileSync(path.join(dir, 'metla_onoff.md'), L.join('\n'));
console.log(L.join('\n'));
