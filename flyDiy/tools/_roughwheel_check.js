#!/usr/bin/env node
// GATE ROUGHWHEEL (SNOW-MUD, 2026-11-15) - ON A STONY STRIP A BIG SOFT WHEEL SWALLOWS WHAT A SMALL HARD ONE CLIMBS.
//
// The user (15 Nov): "does a large tundra wheel help on a bumpy road with stones? Normally we should have one". It did not:
// the solver read the ground at ONE POINT under each wheel node, so a wheel met a stone when its axle stood over it - a step
// of the stone's whole height in one substep, whatever the wheel - and no stone cost any wheel any speed. 30_solver now
// reads a rolling wheel's EFFECTIVE ROAD on a bumpy strip (world.roughAt: a micro strip's box), the TANDEM CAM of Schmeitz &
// Pacejka (VSD 2004): two cams of the tyre's radius one footprint apart (the carcass's own, tyreFootprint), the axle's
// ground their mean, the road's slope their difference over the footprint - by which a stone pushes the wheel back.
//
//   node tools/_roughwheel_check.js          -> "GATE ROUGHWHEEL: PASS|FAIL" and the tables
//
// The Cub (list:1, as the game loads it) with its main wheels changed and nothing else (GATE WHEELSIZE's four: 0.15, 0.22 as
// built, 0.30 on the standard carcass, 0.36 on the tundra carcass). The stones are the strip's own law (STRIP_MICRO: a
// paraboloid cap STONE_H x R high, R up to 0.27 m - the strip's biggest stands 20 cm proud), one under each main wheel 6 m
// ahead, the aeroplane from rest at a fixed throttle; then a row of 15 cm stones crossed at a 10 m/s taxi.
// A. THE 15 cm STONE at 0.3 power: the 0.15 m wheel STOPS against it, the others roll over, and the share of its speed a
//    wheel keeps over the stone grows with the wheel (0.22 < 0.30 < tundra 0.36).
// B. THE STRIP'S BIGGEST STONE (20 cm) at 0.4 power: every wheel crosses, the share kept grows with the wheel, and the
//    tundra's jolt (the CG's peak vertical acceleration over the stone) is under the 0.15 m wheel's.
// C. THE OLD LAW FAILS A (the self-test): the same run with roughAt off - the 0.15 m wheel rolls over the 15 cm stone and
//    keeps all its speed.
// D. AT A 10 m/s TAXI over a row of 15 cm stones: the tundra's jolt and its gear's peak strain are under the 0.15 m wheel's.
// E. ABSENT AS BEFORE: on flat ground with roughAt on the roll is the same bits as with it off (the cams' mean of a flat road
//    is the road); and on the strip's own field (STRIP_MICRO chaos 0.8, seed 9: roughness, lumps, holes, stones) every wheel
//    taxis the 360 m, the cams reading the ground under 100 times a frame (out.envN: under 2 a substep; the profile is the
//    cams' reach and the frame's travel at 5 cm - 49 reads on the 0.15 m wheel, 76 on the tundra at 10 m/s).
// NOT CLAIMED: a softer ride on the strip's LUMPS (1.8-3.5 m waves - no tyre filters a wave longer than its footprint: the
//    rms is the same for every wheel, as it should be), nor a smaller peak there: the solver's ground spring scales with the
//    node's mass (KGn), so a heavier wheel rides STIFFER and the tundra's low-pressure carcass is not in its vertical rate.
//    That is a garage gap for the DIRT session (a carcass's vertical rate, beside TYRE_SOFT), reported, not asserted.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js')), LB = require(path.join(__dirname, '_load_build.js'));
const base = LB.loadBuild(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json')).spec;
const WHEELS = [{ nm: '0.15 m standard', r: 0.15, prof: 0 }, { nm: '0.22 m standard (built)', r: 0.22, prof: 0 },
                { nm: '0.30 m standard', r: 0.30, prof: 0 }, { nm: '0.36 m tundra', r: 0.36, prof: 1 }];
const SH = C.STRIP_MICRO.STONE_H;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
function defOf(w) {
  const s = JSON.parse(JSON.stringify(base));
  s.gear = Object.assign({}, s.gear, { wheelR: w.r }); s.cage = Object.assign({}, s.cage, { whProfile: w.prof });
  return C.buildGen(s);
}
function worldOf(env) {
  const W = { f: null, waterH: () => -1e9, surface: () => 6, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } };
  W.terrainH = (x, z) => (W.f ? W.f(x, z) : 0);
  if (env) W.roughAt = () => true;
  return W;
}
const dome = (Rs, a, b) => { const q2 = (a * a + b * b) / (Rs * Rs); return q2 < 1 ? SH * Rs * (1 - q2) : 0; };
// one of the strip's stones (R = Rs) under each main, 6 m ahead; a fixed throttle from rest
function stone(w, Rs, thr, env) {
  const d = defOf(w), W = worldOf(env), sim = C.makeSim(d, W);
  sim.reset(0); for (let f = 0; f < 180; f++) sim.step(1 / 60);
  const R = d.refs, P = sim.p, mid = () => [(P[R.mains[0] * 3] + P[R.mains[1] * 3]) / 2, (P[R.mains[0] * 3 + 2] + P[R.mains[1] * 3 + 2]) / 2];
  const hdg = () => { const m = mid(); return Math.atan2(m[1] - P[R.tw * 3 + 2], m[0] - P[R.tw * 3]); };
  const h0 = hdg(), ux = Math.cos(h0), uz = Math.sin(h0), m0 = mid(), c = [m0[0] + ux * 6, m0[1] + uz * 6];
  const bM = R.mains.map(i => -(P[i * 3] - c[0]) * uz + (P[i * 3 + 2] - c[1]) * ux);
  W.f = (x, z) => {
    const a = (x - c[0]) * ux + (z - c[1]) * uz, b = -(x - c[0]) * uz + (z - c[1]) * ux;
    if (Math.abs(a) > Rs) return 0;
    let h = 0; for (const bm of bM) h = Math.max(h, dome(Rs, a, b - bm)); return h;
  };
  let t = 0, over = null, vMin = Infinity, vIn = 0, jolt = 0, vy = sim.cgVel()[1];
  for (; t < 40; t += 1 / 60) {
    sim.ctl.dr = Math.max(-1, Math.min(1, 4 * wrap(hdg() - h0))); sim.ctl.thr = thr; sim.ctl.de = 0.3; sim.step(1 / 60);
    const m = mid(), a = (m[0] - c[0]) * ux + (m[1] - c[1]) * uz, V = sim.out.V, vy1 = sim.cgVel()[1], ay = (vy1 - vy) * 60; vy = vy1;
    if (a < -1.5) vIn = V; else if (a < 1.5) { vMin = Math.min(vMin, V); jolt = Math.max(jolt, Math.abs(ay)); } else { over = t; break; }
  }
  return { over, vIn, vMin, keep: over == null ? 0 : vMin / vIn, jolt };
}
// a taxi at 10 m/s (GATE MICRO's rig): over a row of the strip's stones (Rs, 0.45 m apart across, 40 m ahead), or over
// the strip's own field (STRIP_MICRO chaos 0.8, seed 9)
function taxi(w, env, what) {
  const d = defOf(w), W = worldOf(env), sim = C.makeSim(d, W);
  sim.reset(0); for (let f = 0; f < 180; f++) sim.step(1 / 60);
  const ax = () => { const a = sim.axes()[0]; return Math.atan2(-a[2], -a[0]); };
  const h0 = ax(), cg0 = sim.cgPos(), ux = Math.cos(h0), uz = Math.sin(h0);
  if (what === 'field') {
    const F = C.STRIP_MICRO.field({ c: [cg0[0] + ux * 195, cg0[2] + uz * 195], hdg: h0, len: 400, wid: 14 }, { chaos: 0.8, seed: 9 }, 0);
    W.f = (x, z) => F.at(x, z) + F.stoneAt(x, z);
  } else {
    const c = [cg0[0] + ux * 40, cg0[2] + uz * 40], Rs = 0.2;
    W.f = (x, z) => {
      const a = (x - c[0]) * ux + (z - c[1]) * uz, b = -(x - c[0]) * uz + (z - c[1]) * ux;
      if (Math.abs(a) > Rs) return 0;
      const k = Math.round(b / 0.45); return Math.abs(k) > 5 ? 0 : dome(Rs, a, b - k * 0.45);
    };
  }
  const end = what === 'field' ? 380 : 60;
  let eP = 0, dist = 0, vy = sim.cgVel()[1], jolt = 0, strain = 0, reads = 0, ms = 0, frames = 0, t = 0;
  for (let k = 0; k < 60 * 60; k++) {
    const e = wrap(ax() - h0), de = (e - eP) * 60; eP = e; const v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
    Object.assign(sim.ctl, { thr: Math.max(0, Math.min(1, 0.25 + 0.4 * (10 - V))), brake: 0, dr: Math.max(-1, Math.min(1, 3 * e + 1.2 * de)), de: 0.3, da: 0 });
    const q0 = process.hrtime.bigint(); sim.step(1 / 60); ms += Number(process.hrtime.bigint() - q0) / 1e6; frames++;
    reads += sim.out.envN || 0; t = (k + 1) / 60;
    const cg = sim.cgPos(), vy1 = sim.cgVel()[1], ay = (vy1 - vy) * 60; vy = vy1;
    dist = (cg[0] - cg0[0]) * ux + (cg[2] - cg0[2]) * uz;
    if (k > 240 && dist > 20) { jolt = Math.max(jolt, Math.abs(ay)); for (const b of sim.beams) if (b.gear) strain = Math.max(strain, Math.abs(b.strain)); }
    if (dist > end) break;
  }
  return { dist, t, jolt, strain, reads: reads / frames, usF: 1000 * ms / frames };
}
const t0 = Date.now(), fail = [], yes = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); };
const cell = q => (q.over == null ? 'STOPPED' : 'keeps ' + Math.round(100 * q.keep) + ' %, jolt ' + q.jolt.toFixed(1)).padEnd(26);
const cm = Rs => Math.round(SH * Rs * 100) + ' cm';
const S15 = WHEELS.map(w => stone(w, 0.2, 0.3, true)), S20 = WHEELS.map(w => stone(w, 0.27, 0.4, true));
const O15 = WHEELS.map(w => stone(w, 0.2, 0.3, false));
console.log('  the Cub (list:1), its main wheels changed; one of the strip\'s stones under each main 6 m ahead, from rest at a fixed');
console.log('  throttle: the share of its speed a wheel keeps over the stone, and the CG\'s peak vertical acceleration there (m/s^2)');
console.log('  ' + 'stone, throttle'.padEnd(24) + WHEELS.map(w => w.nm.padEnd(26)).join(''));
console.log('  ' + (cm(0.2) + ', 0.3').padEnd(24) + S15.map(cell).join(''));
console.log('  ' + (cm(0.27) + ', 0.4').padEnd(24) + S20.map(cell).join(''));
console.log('  ' + (cm(0.2) + ', 0.3 OLD LAW').padEnd(24) + O15.map(cell).join(''));
// A
yes(S15[0].over == null, 'A the 0.15 m wheel stops at the ' + cm(0.2) + ' stone at 0.3 power', cell(S15[0]));
for (let k = 1; k < 4; k++) yes(S15[k].over != null, 'A the ' + WHEELS[k].nm + ' rolls over the ' + cm(0.2) + ' stone', cell(S15[k]));
for (let k = 1; k + 1 < 4; k++) yes(S15[k + 1].keep > S15[k].keep, 'A the ' + WHEELS[k + 1].nm + ' keeps more of its speed than the ' + WHEELS[k].nm, cell(S15[k + 1]) + ' vs ' + cell(S15[k]));
// B
for (let k = 0; k < 4; k++) yes(S20[k].over != null, 'B the ' + WHEELS[k].nm + ' crosses the strip\'s biggest stone at 0.4 power', cell(S20[k]));
for (let k = 0; k + 1 < 4; k++) yes(S20[k + 1].keep > S20[k].keep, 'B over the ' + cm(0.27) + ' stone the ' + WHEELS[k + 1].nm + ' keeps more than the ' + WHEELS[k].nm, cell(S20[k + 1]) + ' vs ' + cell(S20[k]));
yes(S20[3].jolt < S20[0].jolt, 'B the tundra\'s jolt over the ' + cm(0.27) + ' stone is under the 0.15 m wheel\'s', S20[3].jolt.toFixed(1) + ' vs ' + S20[0].jolt.toFixed(1));
// C
yes(O15[0].over != null && O15[0].keep > 0.97, 'C the old point read: the 0.15 m wheel rolled over the ' + cm(0.2) + ' stone at full speed (the self-test: the old law fails A)', cell(O15[0]));
// D
const TR = WHEELS.map(w => taxi(w, true, 'row'));
console.log('  a 10 m/s taxi over a row of ' + cm(0.2) + ' stones: the CG\'s peak vertical acceleration and the gear\'s peak strain');
TR.forEach((q, k) => console.log('    ' + WHEELS[k].nm.padEnd(26) + q.jolt.toFixed(1) + ' m/s^2, ' + (100 * q.strain).toFixed(2) + ' %'));
yes(TR[3].jolt < TR[0].jolt, 'D at a 10 m/s taxi the tundra\'s jolt over the stones is under the 0.15 m wheel\'s', TR[3].jolt.toFixed(1) + ' vs ' + TR[0].jolt.toFixed(1));
yes(TR[3].strain < TR[0].strain, 'D at a 10 m/s taxi the tundra\'s gear strain over the stones is under the 0.15 m wheel\'s', (100 * TR[3].strain).toFixed(2) + ' vs ' + (100 * TR[0].strain).toFixed(2) + ' %');
// E: flat, the same bits
{
  const d = defOf(WHEELS[1]), sA = C.makeSim(d, worldOf(false)), sB = C.makeSim(d, worldOf(true));
  sA.reset(0); sB.reset(0); let same = true;
  for (let f = 0; f < 600 && same; f++) {
    sA.ctl.thr = sB.ctl.thr = f > 120 ? 0.6 : 0; sA.step(1 / 60); sB.step(1 / 60);
    for (let i = 0; i < sA.p.length; i++) if (sA.p[i] !== sB.p[i] || sA.v[i] !== sB.v[i]) { same = false; break; }
  }
  yes(same, 'E on flat ground the cams change no bit (a 10 s roll, roughAt on vs off)');
}
// (the two ends of the sweep: the smallest wheel and the tundra - the strip's field is slow to read in node)
const TXW = [WHEELS[0], WHEELS[3]], TX = TXW.map(w => taxi(w, true, 'field'));
console.log('  the strip\'s own field (STRIP_MICRO chaos 0.8, seed 9), a 10 m/s taxi of 380 m:');
TX.forEach((q, k) => console.log('    ' + TXW[k].nm.padEnd(26) + q.t.toFixed(0) + ' s, jolt ' + q.jolt.toFixed(1) + ' m/s^2, gear ' + (100 * q.strain).toFixed(2) + ' %; the cams read the ground ' + q.reads.toFixed(1) + ' times a frame, the solver ' + q.usF.toFixed(0) + ' us a frame'));
TX.forEach((q, k) => yes(q.dist > 360 && q.t < 60, 'E the ' + TXW[k].nm + ' taxis the strip', Math.round(q.dist) + ' m in ' + q.t.toFixed(0) + ' s'));
TX.forEach((q, k) => yes(q.reads < 100, 'E the ' + TXW[k].nm + '\'s cams read the ground under 100 times a frame (under 2 a substep)', q.reads.toFixed(1)));
for (const f of fail) console.log('  FAIL ' + f);
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
console.log('GATE ROUGHWHEEL: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
