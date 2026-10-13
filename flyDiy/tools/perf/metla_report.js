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
  let ev = null; try { ev = typeof j.eval === 'string' ? JSON.parse(j.eval) : j.eval; } catch (e) {}
  const memTxt = (() => { try { return fs.readFileSync(path.join(dir, f.replace('.json', '_mem.txt')), 'utf8'); } catch (e) { return ''; } })();
  const mm = /peak private ([\d,]+) MB, peak working set ([\d,]+) MB/.exec(memTxt);
  const lt = j.longTasks || [], g = (j.tGarage || 0) * 1000, fr = (j.frames || []).filter(r => r[1] > 0);
  const near = MK ? fr.filter(r => typeof r[14] === 'number' && Math.hypot(r[14] - MK[0], r[15] - MK[1]) <= NEAR) : [];
  let closest = null; if (MK) for (const r of fr) if (typeof r[14] === 'number') { const d = Math.hypot(r[14] - MK[0], r[15] - MK[1]); if (closest == null || d < closest) closest = d; }
  const n0 = near.length ? near[0][0] : null, n1 = near.length ? near[near.length - 1][0] : null;
  const ph = j.phases || {}, P = k => ph[k] || {};
  return { f, pre: m[1], n: +m[2], side: m[3], garage: j.tGarage, rollout: j.tReveal,
    bootWorst: Math.max(0, ...lt.filter(x => x[0] <= g).map(x => x[1])), afterWorst: Math.max(0, ...lt.filter(x => x[0] > g).map(x => x[1])),
    standLoop: P('stand').workMed, standRender: P('stand').renderMed, standDraws: P('stand').drawsMed,
    taxiLoop: P('taxi').workMed, taxiRender: P('taxi').renderMed, taxiDraws: P('taxi').drawsMed, taxiFps: P('taxi').fpsDelivered,
    nearS: near.length ? (n1 - n0) / 1000 : 0, nearLoop: med(near.map(r => r[2])), nearRender: med(near.map(r => r[10])), nearDraws: med(near.map(r => r[29])),
    nearP99: pct(near.map(r => r[1]), 0.99), nearWorstDt: near.length ? Math.max(...near.map(r => r[1])) : null,
    nearWorstTask: near.length ? Math.max(0, ...lt.filter(x => x[0] >= n0 - 2000 && x[0] <= n1).map(x => x[1])) : null,
    privMB: mm ? +mm[1].replace(/,/g, '') : null, wsMB: mm ? +mm[2].replace(/,/g, '') : null, heapMB: ev && ev.heapMB, houses: ev && ev.houses, town: ev && ev.town, closest };
}
const all = fs.readdirSync(dir).filter(f => /^(metla|metlacub)_\d+_[AB]\.json$/.test(f)).map(load);
if (!all.length) { console.error('metla_report: no runs in ' + dir); process.exit(1); }
const f1 = x => (x == null ? '-' : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)), sg = x => (x == null ? '-' : (x > 0 ? '+' : '') + f1(x));
const L = ['# METLA-ONOFF - Metlakatla OFF (A, ?town=0) vs ON (B, ?town=1), ABBA', '',
  'The box\'s default preset (GFX.get() kept per run). garage = navigation -> garage (s, warm profile), boot worst = the worst main-thread task before it, roll-out = Roll out -> flight (s); loop = the frame\'s JS work, render = renderer.render() CPU (ms), draws a frame (shadows in); memory = Chrome\'s whole process tree (peak private / working set, MB) and the JS heap at the end; closest = the nearest the aeroplane came to the Metlakatla seaplane base (m); NEAR = every frame within ' + NEAR + ' m of it (s spent, loop, render, draws, frame p99 / worst, the worst task).', ''];
const S = {};
for (const [pre, title, K] of [
  ['metla', 'THE FIRST VISIT - the Cessna on floats, SEA lane -> the Metlakatla seaplane base, 330 s', ['garage', 'bootWorst', 'rollout', 'nearS', 'nearLoop', 'nearRender', 'nearDraws', 'nearP99', 'nearWorstDt', 'nearWorstTask', 'afterWorst', 'privMB', 'wsMB', 'heapMB', 'houses', 'closest']],
  ['metlacub', 'HOME - the Cub, stand and taxi', ['garage', 'bootWorst', 'rollout', 'standLoop', 'standRender', 'standDraws', 'taxiLoop', 'taxiRender', 'taxiDraws', 'taxiFps', 'afterWorst', 'privMB', 'heapMB', 'houses']]]) {
  const runs = all.filter(r => r.pre === pre).sort((a, b) => a.n - b.n); if (!runs.length) continue;
  const mean = (s, k) => { const v = runs.filter(r => r.side === s).map(r => r[k]).filter(x => typeof x === 'number' && isFinite(x)); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
  const A = Object.fromEntries(K.map(k => [k, mean('A', k)])), B = Object.fromEntries(K.map(k => [k, mean('B', k)]));
  S[pre] = { A, B, D: k => (A[k] != null && B[k] != null ? B[k] - A[k] : null) };
  L.push('## ' + title, '', '| run | ' + K.join(' | ') + ' | town |', '|' + ' --- |'.repeat(K.length + 2));
  for (const r of runs) L.push('| ' + r.f.replace('.json', '') + ' | ' + K.map(k => f1(r[k])).join(' | ') + ' | ' + r.town + ' |');
  L.push('| **A off** | ' + K.map(k => f1(A[k])).join(' | ') + ' | |', '| **B on** | ' + K.map(k => f1(B[k])).join(' | ') + ' | |', '| **B - A** | ' + K.map(k => sg(S[pre].D(k))).join(' | ') + ' | |', '');
  if (runs.some(r => (r.side === 'B') !== !!r.town)) L.push('WARNING: a run\'s town state (FLYDIY_TOWN.all) does not match its side - that run is void.', '');
}
const V = S.metla, C = S.metlacub;
if (V) L.push('**ON costs ' + sg(V.D('nearLoop')) + ' ms loop / ' + sg(V.D('nearRender')) + ' ms render a frame over the town (draws ' + sg(V.D('nearDraws')) + ', frame p99 ' + f1(V.A.nearP99) + ' -> ' + f1(V.B.nearP99) + ' ms, worst frame ' + f1(V.A.nearWorstDt) + ' -> ' + f1(V.B.nearWorstDt) + ' ms, worst task near ' + f1(V.A.nearWorstTask) + ' -> ' + f1(V.B.nearWorstTask) + ' ms)' +
  (C ? '; at HOME taxi ' + sg(C.D('taxiLoop')) + ' / ' + sg(C.D('taxiRender')) + ' ms' : '') + '; ' + sg(V.D('garage')) + ' s to the garage, ' + sg(V.D('rollout')) + ' s roll-out; ' + sg(V.D('privMB')) + ' MB peak private (' + sg(V.D('heapMB')) + ' MB JS heap).**', '');
fs.writeFileSync(path.join(dir, 'metla_onoff.md'), L.join('\n'));
console.log(L.join('\n'));
