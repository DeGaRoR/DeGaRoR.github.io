// G2383 (DMG-RECAL2): a floatplane's water circuit with the pilot, traced per frame from the flare to the stop - the
// pitch, sink, speed, bank, the floats' contact, the hydro lift over the weight, the spreaders' worst load over its
// certified yield (the probe), the throttle and the stick. DMGGEAR's circuit rig (tools/_dmg_gear_lib.js circuit), the
// wind from `th` deg off the lane's landing heading (90: from the right, DMGGEAR's crosswind).
// Run from flyDiy/: ROOT=$PWD node reports/evidence/DMG-RECAL2/scripts/water_landing.js <key> <U m/s> <th deg> [out.json]
process.env.FLYDIY_CERT = '1';
const path = require('path'), fs = require('fs'); const ROOT = process.env.ROOT || process.cwd();
const L = require(path.join(ROOT, 'tools/_treecrash_lib.js')); const C = L.core();
const key = process.argv[2] || 'twinFloats', U = +(process.argv[3] || 0), TH = +(process.argv[4] || 90), OUT = process.argv[5];
const def = L.defOf(key, { probe: true }), world = C.makeWorld(); const sim = C.makeSim(def, world); sim.reset(0); sim._def = def;
const a = world.aerodromes.find(x => x.id === 'SEA'); const h = a.hdg;
// DMGGEAR's crosswind: base [-sin h, 0, cos h] * xw is "from the right"; th rotates it from the landing heading
// (th 0: a headwind on the lane's landing direction as the gate's rig flies it, 90: from the right, 180 tail, 270 left)
const fwd = [Math.cos(h), Math.sin(h)], right = [-Math.sin(h), Math.cos(h)];
// a wind FROM the right blows toward the left: the gate's base is +right*xw... keep the gate's convention: base = right * xw for th 90
const c = Math.cos(TH * Math.PI / 180), s = Math.sin(TH * Math.PI / 180);
if (U) world.setWind({ base: [U * (s * right[0] - c * fwd[0]), 0, U * (s * right[1] - c * fwd[1])], gust: 0 });
C.placeAtAerodrome(sim, a); for (let i = 0; i < 600; i++) sim.step(1 / 60);
const ap = C.makePilot(sim, def, world); ap.setRoute(a, a);
const P = sim.damagePeak(), N = def.nodes, tag = i => N[def.beams[i].a].tag + '-' + N[def.beams[i].b].tag;
const spread = []; def.beams.forEach((b, i) => { if (tag(i) === 'FLD-FLD' && sim.beams[i].cls === 'gear') spread.push(i); });
let mass = 0; for (let i = 0; i < sim.m.length; i++) mass += sim.m[i];
const Wt = mass * 9.81;
const rows = []; let heel = null, ph = null, rec = false, phases = [];
for (let k = 0; k < (+process.env.WL_MAXS || 800) * 60; k++) {
  ap.update(1 / 60); if (ap.phase !== ph) { ph = ap.phase; phases.push([+sim.t.toFixed(2), ph]); if (ph === 'FLARE' || ph === 'FINAL' && false) rec = true; }
  P.t.fill(0); P.c.fill(0); sim.step(1 / 60);
  if (ph === 'FINAL' && ap.dbg && ap.dbg.aglG < 15) rec = true;
  if (!rec) continue;
  if (heel == null && sim.hydro.floats.some(fx => fx.wet > 0.05)) heel = sim.hydro.floats.map(fx => { const W = fx.out.W, K = W[fx.F.edge.K], S = W[fx.F.sta[fx.F.sta.length - 1].K];
    return +(Math.atan2(S[1] - K[1], Math.hypot(S[0] - K[0], S[2] - K[2])) * 57.2958).toFixed(2); });
  let w = 0, wc = 0; for (const i of spread) { const r = Math.max(P.t[i], P.c[i]); if (r > w) { w = r; wc = P.c[i] >= P.t[i] ? 1 : 0; } }
  const v = sim.cgVel(), d = ap.dbg || {};
  let fy = 0, wet = 0; for (const fx of sim.hydro.floats) { fy += fx.out.F[1]; if (fx.wet > 0.05) wet++; }
  rows.push([+sim.t.toFixed(3), ph, +(d.th * 57.2958).toFixed(2), +(d.ph * 57.2958).toFixed(2), +Math.hypot(v[0], v[2]).toFixed(2), +v[1].toFixed(3),
    wet, +(fy / Wt).toFixed(3), +w.toFixed(3), wc, +sim.ctl.thr.toFixed(3), +(sim.ctl.de || 0).toFixed(3), +(d.aglG || 0).toFixed(2), +(v[0] * right[0] + v[2] * right[1]).toFixed(3), +(sim.ctl.da || 0).toFixed(3), +(sim.ctl.dr || 0).toFixed(3)]);
  if (ap.phase === 'STOPPED' && ap.t > 3) break;
}
// the contact phases: the first wet frame on, each run of wet frames separated by >= 3 dry frames
let first = -1; for (let i = 0; i < rows.length; i++) if (rows[i][6] > 0) { first = i; break; }
const runs = []; let cur = null, dry = 0;
for (let i = Math.max(0, first); first >= 0 && i < rows.length; i++) {
  const r = rows[i];
  if (r[6] > 0) { if (!cur || dry >= 3) { cur = { i0: i, t0: r[0], V: r[4], vy: r[5], th: r[2], ph: r[3], peakW: 0, peakS: 0, thr: r[10] }; runs.push(cur); } dry = 0; cur.t1 = r[0]; cur.peakW = Math.max(cur.peakW, r[7]); cur.peakS = Math.max(cur.peakS, r[8]); }
  else dry++;
}
const peakS = rows.reduce((m, r) => Math.max(m, r[8]), 0);
const out = { key, U, th: TH, mass: +mass.toFixed(1), phases, verdicts: (ap.report && ap.report.verdicts || []).filter(v => !/^(phase|status)/.test(v.code)), landing: ap.report && ap.report.landing, outcome: ap.report && ap.report.outcome,
  contacts: runs.length, runs: runs.map(r => ({ t0: r.t0, t1: r.t1, V: r.V, sink: -r.vy, pitch: r.th, bank: r.ph, thr: r.thr, peakW: r.peakW, peakSpreader: r.peakS })),
  peakSpreader: peakS, heelAtTouch: heel, cols: ['t', 'phase', 'pitch', 'bank', 'V', 'vy', 'wet', 'Fy/W', 'spreader', 'comp', 'thr', 'de', 'aglG', 'vlat', 'da', 'dr'], right, rows };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify(out.verdicts.slice(-12))); console.log('heel (stern keel over the step keel, deg) at the first touch', JSON.stringify(heel)); console.log(key, 'U', U, 'th', TH, 'outcome', out.outcome, 't', rows.length ? rows[rows.length - 1][0] : null, 'contacts', runs.length, 'peak spreader', peakS.toFixed(2));
for (const r of out.runs) console.log('  touch t', r.t0, '-', r.t1, 'V', r.V, 'sink', r.sink.toFixed(2), 'pitch', r.pitch, 'bank', r.bank, 'thr', r.thr, 'peak W', r.peakW, 'spreader', r.peakSpreader);
