#!/usr/bin/env node
// flightq_fly.js (WS-088, 28 Nov 2026) - A BUILD'S TEST FLIGHT, HEADLESS, AS THE BENCH WOULD JUDGE IT: the pilot's own
// circuit on the default field (as the gates fly it), the flight-quality verdict the bench's judge now reads
// (43_pilot PILOT_FQ, report.quality), and the design check's handling rows beside it. For the builds that live only on
// the user's machine (the Lazair, the Chinook as the user has it, the Risen V-tail): run it there.
//   node tools/flightq_fly.js <card.json> [--wind <m/s>,<gust 0..1>] [--trace <out.json>] [--max <s>]
//   e.g. node tools/flightq_fly.js builds/cub_2026-09-20_corrected.json --wind 6,0.3
// Prints: the outcome, the pilot's verdicts, each quality row (value, level, the bound) and the design rows that are
// not a pass; --trace writes the 10 Hz trace (t, phase, height, airspeed, vertical speed, pitch, bank, the controls).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const file = argv.find(a => !a.startsWith('--') && /\.json$/.test(a));
if (!file) { console.log('usage: node tools/flightq_fly.js <card.json> [--wind <m/s>,<gust>] [--trace <out.json>] [--max <s>]'); process.exit(2); }
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js')), LB = require(path.join(T, '_load_build.js'));
const B = LB.loadBuild(path.isAbsolute(file) ? file : path.resolve(file));
const def = C.buildGen(B.spec), W = C.makeWorld();
const wind = opt('wind', ''); if (wind) { const [u, g] = wind.split(',').map(Number); W.setWind({ base: [u || 0, 0, (u || 0) * 0.5], gust: g || 0 }); }
const sim = C.makeSim(def, W); sim.reset(0);
for (let i = 0; i < 600; i++) sim.step(1 / 60);
const ap = C.makePilot(sim, def, W);
const S = [], f = (x, n) => x == null || !isFinite(x) ? null : +(+x).toFixed(n), maxS = +opt('max', 600);
let stopN = 0, bad = false;
for (let s = 0; s < maxS * 60; s++) {
  ap.update(1 / 60); sim.step(1 / 60);
  if (sim.stats().bad) { bad = true; break; }
  if (s % 6 === 0) {
    const c = sim.cgPos(), v = sim.cgVel(), ax = sim.axes();
    S.push([f(s / 60, 1), ap.phase, f(c[1] - W.terrainH(c[0], c[2]), 1), f(sim.out.V, 2), f(v[1], 2), f(-Math.asin(Math.max(-1, Math.min(1, ax[0][1]))) * 57.3, 1),
      f(Math.asin(Math.max(-1, Math.min(1, ax[2][1]))) * 57.3, 1), f(sim.ctl.de, 3), f(sim.ctl.da, 3), f(sim.ctl.dr, 3), f(sim.ctl.thr, 2), f(sim.ctl.flap, 2)]);
  }
  stopN = ap.phase === 'STOPPED' ? stopN + 1 : 0; if (stopN > 120) break;
}
const R = ap.report || {}, Q = R.quality;
console.log((B.name || path.basename(file)) + (wind ? ' (wind ' + wind + ')' : ' (calm)') + ': ' + (bad ? 'DIVERGED' : R.outcome) + ' after ' + Math.round(ap.t) + ' s');
console.log('  the pilot said: ' + ((R.verdicts || []).map(v => v.code).join(', ') || 'nothing'));
console.log('  THE FLIGHT: ' + (Q ? String(Q.level).toUpperCase() + ' (airborne ' + Q.airS + ' s, settled leg ' + Q.legS + ' s)' : 'no verdict'));
for (const r of (Q && Q.rows) || []) console.log('    ' + r.level.padEnd(5) + r.label.padEnd(32) + String(r.value + (r.unit ? ' ' + r.unit : '')).padEnd(24) + r.limit);
const D = C.genShakedown ? (C.genShakedown(C.buildGen(B.spec)) || {}).design : null;
if (D) { const nr = D.rows.filter(r => r.level !== 'pass');
  console.log('  THE DESIGN CHECK: ' + String(D.verdict).toUpperCase() + (nr.length ? '' : ' (every row passes)'));
  for (const r of nr) console.log('    ' + r.level.padEnd(5) + (r.id + ' ' + r.label).slice(0, 56).padEnd(57) + String(r.value) + ' ' + (r.unit || '') + ' - ' + String(r.why || '').slice(0, 120)); }
const out = opt('trace', ''); if (out) { fs.writeFileSync(out, JSON.stringify({ file, wind, quality: Q, verdicts: R.verdicts, cols: ['t', 'ph', 'agl', 'V', 'vy', 'pitch', 'bank', 'de', 'da', 'dr', 'thr', 'flap'], S })); console.log('  the trace: ' + out); }
