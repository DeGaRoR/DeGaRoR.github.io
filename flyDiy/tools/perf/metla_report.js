#!/usr/bin/env node
// metla_report.js - METLA-ONOFF (G3205, A0 13 Oct: the user's "Metlakatla ON by default" decision): the ABBA of rollout_perf
// runs, A = ?town=0 (Metlakatla off, today's default), B = ?town=1 (on), the Cub from HOME toward strip 12 (w7 - the leg
// passes ~2 km east of the town), 300 s recorded. Reads <dir>/metla_<n>_<A|B>.json and metla_<n>_<A|B>_mem.txt
// (tools/perf/chrome_mem.ps1) and prints / writes <dir>/metla_onoff.md: per side the mean of its runs, B - A, and the
// go / no-go line: ON costs X ms a frame / Y s of loading / Z MB.
//   node tools/perf/metla_report.js <dir>
'use strict';
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('metla_report: <dir>'); process.exit(2); }
let MK = null;   // Metlakatla's seaplane base, the town's waterfront: the closest approach is measured to it
try { const F = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'island_jolene.json'), 'utf8')); const r = F.layers.runways.find(x => x.id === 'mk_sea'); MK = r && r.c; } catch (e) {}
const runs = fs.readdirSync(dir).filter(f => /^metla_\d+_[AB]\.json$/.test(f)).map(f => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), side = /_([AB])\.json$/.exec(f)[1];
  let ev = null; try { ev = typeof j.eval === 'string' ? JSON.parse(j.eval) : j.eval; } catch (e) {}
  const memTxt = (() => { try { return fs.readFileSync(path.join(dir, f.replace('.json', '_mem.txt')), 'utf8'); } catch (e) { return ''; } })();
  const mm = /peak private ([\d,]+) MB, peak working set ([\d,]+) MB/.exec(memTxt);
  const lt = (j.longTasks || []), g = (j.tGarage || 0) * 1000;
  const ph = j.phases || {}, P = k => ph[k] || {};
  let near = null;
  if (MK) for (const r of j.frames || []) if (typeof r[14] === 'number' && typeof r[15] === 'number') { const d = Math.hypot(r[14] - MK[0], r[15] - MK[1]); if (near == null || d < near) near = d; }
  const o = { f, side, garage: j.tGarage, rollout: j.tReveal, bootWorst: Math.max(0, ...lt.filter(x => x[0] <= g).map(x => x[1])), afterWorst: Math.max(0, ...lt.filter(x => x[0] > g).map(x => x[1])),
    privMB: mm ? +mm[1].replace(/,/g, '') : null, wsMB: mm ? +mm[2].replace(/,/g, '') : null, heapMB: ev && ev.heapMB, houses: ev && ev.houses, town: ev && ev.town, near };
  for (const k of ['stand', 'taxi', 'air']) Object.assign(o, { [k + 'Loop']: P(k).workMed, [k + 'Render']: P(k).renderMed, [k + 'Draws']: P(k).drawsMed, [k + 'Fps']: P(k).fpsDelivered, [k + 'P99']: P(k).dtP99 });
  return o;
}).sort((a, b) => a.f.localeCompare(b.f, undefined, { numeric: true }));
if (!runs.length) { console.error('metla_report: no metla_<n>_<A|B>.json in ' + dir); process.exit(1); }
const K = ['garage', 'bootWorst', 'rollout', 'standLoop', 'standRender', 'standDraws', 'taxiLoop', 'taxiRender', 'taxiDraws', 'taxiFps', 'airLoop', 'airRender', 'airDraws', 'airFps', 'airP99', 'afterWorst', 'privMB', 'wsMB', 'heapMB', 'houses', 'near'];
const mean = (s, k) => { const v = runs.filter(r => r.side === s).map(r => r[k]).filter(x => typeof x === 'number' && isFinite(x)); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
const f1 = x => (x == null ? '-' : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)), sg = x => (x == null ? '-' : (x > 0 ? '+' : '') + f1(x));
const A = Object.fromEntries(K.map(k => [k, mean('A', k)])), B = Object.fromEntries(K.map(k => [k, mean('B', k)])), D = k => (A[k] != null && B[k] != null ? B[k] - A[k] : null);
const L = ['# METLA-ONOFF - Metlakatla OFF (A, ?town=0) vs ON (B, ?town=1), ABBA', '',
  'The Cub, HOME -> strip 12 (w7; the leg passes the town), the box\'s default preset, 300 s from the reveal. Loads: garage = navigation -> garage (s, warm profile), boot worst = the worst main-thread task before it; roll-out = Roll out -> flight (s). Frames: loop = the JS work, render = renderer.render() CPU (ms), draws a frame (shadows in). Memory: Chrome\'s whole process tree (peak private / working set, chrome_mem.ps1) and the JS heap at the end. near = the closest approach to Metlakatla\'s waterfront (m).', '',
  '| run | ' + K.join(' | ') + ' | town |', '|' + ' --- |'.repeat(K.length + 2)];
for (const r of runs) L.push('| ' + r.f.replace('.json', '') + ' | ' + K.map(k => f1(r[k])).join(' | ') + ' | ' + r.town + ' |');
L.push('| **A off** | ' + K.map(k => f1(A[k])).join(' | ') + ' | |', '| **B on** | ' + K.map(k => f1(B[k])).join(' | ') + ' | |', '| **B - A** | ' + K.map(k => sg(D(k))).join(' | ') + ' | |', '');
const frameMs = ['taxiLoop', 'taxiRender', 'airLoop', 'airRender'].map(D);
const go = 'ON costs ' + sg(D('airLoop')) + ' ms loop / ' + sg(D('airRender')) + ' ms render a frame in the air toward the town (taxi ' + sg(D('taxiLoop')) + ' / ' + sg(D('taxiRender')) + ' ms; air fps ' + f1(A.airFps) + ' -> ' + f1(B.airFps) + '), ' +
  sg(D('garage')) + ' s to the garage (' + sg(D('rollout')) + ' s roll-out), ' + sg(D('privMB')) + ' MB peak private (' + sg(D('heapMB')) + ' MB JS heap); worst task ' + f1(A.afterWorst) + ' -> ' + f1(B.afterWorst) + ' ms; draws in the air ' + sg(D('airDraws')) + '.';
L.push('**' + go + '**', '');
if (runs.some(r => r.side === 'B' && !r.town) || runs.some(r => r.side === 'A' && r.town)) L.push('WARNING: a run\'s town state does not match its side (FLYDIY_TOWN.all) - the A/B is void where it differs.', '');
fs.writeFileSync(path.join(dir, 'metla_onoff.md'), L.join('\n'));
console.log(L.join('\n'));
