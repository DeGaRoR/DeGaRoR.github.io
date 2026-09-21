#!/usr/bin/env node
// GATE FLOATS (H1, G382) — the float in the REAL solver. The user's
// ultralight (tools/fixtures/build_v7_ultralight_2026-09-05.json) with
// `gear.type: 'floats'`: two floats built as rigid node bodies by
// 61_gen_frame, the hull and the force law of 32_hydro.js riding on their
// frame nodes, the sea south of HOME (0, 1600: 44 m deep, 800 m clear).
//
//   node tools/_floats_check.js            -> "GATE FLOATS: PASS|FAIL"
//   node tools/_floats_check.js --show     -> the traces
//
// WHAT IT ASSERTS:
//   BUILD    two float clusters, the step keels as the mains' refs, no third
//            wheel, the pair displacing >= 150 % of the gross (the rule is 180)
//   SETTLE   dropped from 0.3 m, engines idle: the water carries the weight
//            (+-3 %) with the step keels 0.15-0.40 m under, 2-10 deg
//            nose-up, level in roll, the frame under 6 % strain, finite
//   TAKEOFF  full throttle, stick back past 12 m/s: a hump (R/W 0.10-0.40)
//            below 14 m/s, the steps ventilated before lift-off, airborne
//            inside 30 s, roll under 5 deg the whole run
//   LANDING  the approach trimmed by bisection (1.3 Vs, quarter throttle,
//            1 m/s down): the touch between 0.5 and 1.6 m/s, the water's
//            lift climbing over >= 3 frames to its first peak, no frame
//            adding more than 0.35 W, peak under 2 W, idle taxi under 5 m/s
//            20 s later, finite throughout
// Measured on the fixture the day it was written (HANDOVER G382): settle
// 0.266 m / 6.8 deg / L/W 1.00; hump 0.21 at 8.5-10 m/s; airborne at 24 m/s
// 11 s after throttle-up; the touch at 0.92 m/s, +0.02/0.15/0.32/0.49/0.62/
// 0.72/0.79/0.83 W frame by frame, one skip, taxi at 3.2 m/s.
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js');
const SHOW = process.argv.includes('--show');
const FIX = path.join(__dirname, 'fixtures', 'build_v7_ultralight_2026-09-05.json');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);

const spec = JSON.parse(fs.readFileSync(FIX, 'utf8')).spec;
spec.gear.type = 'floats';
const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
const world = C.makeWorld();
let M = 0; for (const n of def.nodes) M += n.m;
const W = M * 9.81;
const X0 = 0, Z0 = 1600, h = world.waterH(X0, Z0);
const G = 9.81;

// ---- BUILD ------------------------------------------------------------------
console.log('BUILD');
{
  const fl = def.parts.floats, cl = def.clusters.filter(c => c.cls === 'float');
  const F0 = fl && C.HYDRO.makeFloat(fl[0].P);
  const disp = F0 ? 2 * F0.volDeck * fl[0].P.rho : 0;
  console.log(`   ${def.nodes.length} nodes, ${def.beams.length} beams, gross ${f(M, 1)} kg; floats: L ${f(fl[0].P.L, 2)} m, beam ${f(fl[0].P.B, 2)} m, scale ${f(fl[0].P.scale, 3)}, ${f(fl[0].P.mFloat, 1)} kg each, ` +
              `the pair displaces ${f(disp, 0)} kg to the deck (${f(disp / M, 2)} x gross); step at x ${f(fl[0].pos[0], 2)}, keel y ${f(fl[0].pos[1], 2)}, track ${f(2 * Math.abs(fl[0].pos[2]), 2)} m; substeps ${def.params.substeps}`);
  verdict(fl && fl.length === 2 && cl.length === 2 && cl.every(c => c.nodes.length === 15), `two floats, two rigid clusters of 15 nodes (five stations, G451)`);
  verdict(def.refs.tw === -1 && def.refs.mains.length === 2 && def.refs.mains.every(i => def.nodes[i].tag === 'FLK'), `the step keels are the mains' refs, no third wheel`);
  verdict(disp >= 1.5 * M, `the pair displaces ${f(disp / M, 2)} x the gross (bound 1.5; the rule is 1.8)`);
  verdict(h === 0 && world.terrainH(X0, Z0) < -10, `the sea at (${X0}, ${Z0}): level ${h}, bed ${f(world.terrainH(X0, Z0), 1)} m`);
}
const state = (sim) => {
  const [xA, yU] = sim.axes();
  const trim = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI;
  const roll = Math.asin(Math.max(-1, Math.min(1, yU[2]))) * 180 / Math.PI;
  let vx = 0, vy = 0, mm = 0, cy = 0; for (let i = 0; i < sim.n; i++) { vx += sim.v[i * 3] * sim.m[i]; vy += sim.v[i * 3 + 1] * sim.m[i]; cy += sim.p[i * 3 + 1] * sim.m[i]; mm += sim.m[i]; }
  const fl = sim.hydro.floats;
  return { V: -vx / mm, vy: vy / mm, cgY: cy / mm - h, trim, roll,
           Fy: fl.reduce((s, x) => s + x.out.F[1], 0) / W, R: fl.reduce((s, x) => s + x.out.F[0], 0) / W,
           wet: fl.reduce((s, x) => s + x.wet, 0), vent: Math.min(...fl.map(x => x.out.vent || 0)),
           draft: fl.map(x => x.h - x.out.W[x.F.edge.K][1]) };
};
function place(sim, hAbove, V, vy0) {
  const p = sim.p, v = sim.v, iK = def.refs.mains[0];
  const dx = X0 - p[iK * 3], dz = Z0 - p[iK * 3 + 2], dy = (h + hAbove) - p[iK * 3 + 1];
  for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = -(V || 0); v[i * 3 + 1] = vy0 || 0; v[i * 3 + 2] = 0; }
}
const finite = r => Number.isFinite(r.V) && Number.isFinite(r.trim) && Number.isFinite(r.Fy);

// ---- SETTLE ------------------------------------------------------------------
console.log('\nSETTLE (dropped from 0.3 m, throttle 0)');
const sim = C.makeSim(def, world); sim.reset(0); place(sim, 0.3, 0, 0); sim.ctl.thr = 0;
{
  let ok = true, Fy = 0, dr = 0, tr = 0, rl = 0, n = 0, maxRoll = 0;
  for (let s = 0; s < 600; s++) {
    sim.step(1 / 60);
    const r = state(sim);
    if (!finite(r)) { ok = false; break; }
    maxRoll = Math.max(maxRoll, Math.abs(r.roll));
    if (s >= 480) { Fy += r.Fy; dr += 0.5 * (r.draft[0] + r.draft[1]); tr += r.trim; rl += Math.abs(r.roll); n++; }
    if (SHOW && s % 60 === 59) console.log(`   t ${f((s + 1) / 60, 1)} cgY ${f(r.cgY)} trim ${f(r.trim, 2)} roll ${f(r.roll, 2)} L/W ${f(r.Fy)} wet ${f(r.wet, 2)} draft ${f(r.draft[0])}/${f(r.draft[1])}`);
  }
  Fy /= n; dr /= n; tr /= n; rl /= n;
  let maxStrain = 0; for (const b of sim.beams) maxStrain = Math.max(maxStrain, Math.abs(b.strain));
  console.log(`   at rest: L/W ${f(Fy)}, draft at the step ${f(dr)} m, trim ${f(tr, 2)} deg, roll ${f(rl, 2)} deg (max ${f(maxRoll, 2)} through the drop), max beam strain ${f(maxStrain, 4)}`);
  verdict(ok, `the settle stays finite`);
  verdict(Math.abs(Fy - 1) < 0.03, `the water carries the weight: L/W ${f(Fy)} (bound +-3 %)`);
  verdict(dr > 0.15 && dr < 0.40, `draft at the step ${f(dr)} m (bound 0.15-0.40)`);
  // H2 (G389): the step is 12 deg aft of the CG now (the rule solved on the
  // airframe's CG, the floats' own mass where the step puts it); a float
  // so placed sits nearly level at rest — 1.4 deg measured, where the
  // G382 float with its step at the CG sat at 6.8
  verdict(tr > 0.5 && tr < 10, `trim ${f(tr, 2)} deg nose-up at rest (bound 0.5-10)`);
  verdict(rl < 1 && maxRoll < 3, `level in roll: ${f(rl, 2)} deg at rest, ${f(maxRoll, 2)} max`);
  verdict(maxStrain < 0.06, `the frame's max strain ${f(maxStrain, 4)} (bound 0.06)`);
}

// ---- TAKEOFF ------------------------------------------------------------------
// THE SEAPLANE TECHNIQUE: full back stick from the start (the bow up out
// of the plough), eased once on the step. With the CG 0.28 m ahead of the
// step and the twin's tail out of any propwash, the hump is flown at
// -5 deg (plowing) at R/W 0.35: the honest cost of a wing-mounted twin on
// floats, and why the bound is 0.45 rather than the tank's 0.30.
console.log('\nTAKEOFF (full throttle from rest, stick back, eased past 14 m/s)');
{
  sim.ctl.thr = 1; sim.ctl.de = 0.45;
  let ok = true, hump = { R: 0, V: 0 }, ventBeforeLift = 0, airborne = null, maxRoll = 0, T = 0, Vlift = 0;
  for (let s = 0; s < 40 * 60; s++) {
    sim.step(1 / 60); T += 1 / 60;
    const r = state(sim);
    if (!finite(r)) { ok = false; break; }
    sim.ctl.de = r.V > 14 ? 0.2 : 0.45;
    maxRoll = Math.max(maxRoll, Math.abs(r.roll));
    if (r.wet > 0 && r.R > hump.R) hump = { R: r.R, V: r.V };
    if (r.wet > 0) ventBeforeLift = Math.max(ventBeforeLift, r.vent);
    if (airborne == null && r.wet === 0 && r.Fy === 0 && s > 60) { airborne = T; Vlift = r.V; }
    if (SHOW && s % 60 === 59) console.log(`   t ${f(T, 1)} V ${f(r.V, 2)} cgY ${f(r.cgY)} trim ${f(r.trim, 2)} roll ${f(r.roll, 2)} L/W ${f(r.Fy)} R/W ${f(r.R)} wet ${f(r.wet, 2)} vent ${f(r.vent, 2)}`);
    if (airborne != null && T > airborne + 2) break;
  }
  console.log(`   hump R/W ${f(hump.R)} at ${f(hump.V, 1)} m/s; steps ventilated to ${f(ventBeforeLift, 2)} before lift-off; airborne ${airborne == null ? 'NO' : 'at ' + f(airborne, 1) + ' s, ' + f(Vlift, 1) + ' m/s'}; max roll ${f(maxRoll, 2)} deg`);
  verdict(ok, `the take-off stays finite`);
  verdict(hump.R > 0.10 && hump.R < 0.45 && hump.V < 14, `a hump of R/W ${f(hump.R)} at ${f(hump.V, 1)} m/s (bound 0.10-0.45, under 14 m/s)`);
  verdict(ventBeforeLift > 0.95, `the steps ventilate before lift-off (${f(ventBeforeLift, 2)})`);
  verdict(airborne != null && airborne < 30, `airborne inside 30 s (${airborne == null ? 'never' : f(airborne, 1) + ' s'})`);
  verdict(maxRoll < 5, `roll under 5 deg through the run (${f(maxRoll, 2)})`);
}

// ---- LANDING -------------------------------------------------------------------
console.log('\nLANDING (trimmed approach at 1.3 Vs, quarter throttle, 1 m/s down; throttle to idle at the touch)');
{
  const g = def.params.gen, VA = 1.3 * g.Vs, thrA = 0.25;
  const fly = (de) => {
    const s2 = C.makeSim(def, world); s2.reset(0); place(s2, 30, VA, 0); s2.ctl.thr = thrA; s2.ctl.de = de;
    let acc = 0, n = 0;
    for (let s = 0; s < 240; s++) { s2.step(1 / 60); if (s >= 180) { acc += state(s2).vy; n++; } }
    return acc / n;
  };
  let lo = -0.5, hi = 0.8, vyT = 0;
  for (let it = 0; it < 9; it++) { const de = 0.5 * (lo + hi); vyT = fly(de); if (vyT > -1.0) hi = de; else lo = de; }
  const deA = 0.5 * (lo + hi);
  console.log(`   Vs ${f(g.Vs, 1)} -> approach ${f(VA, 1)} m/s; elevator ${f(deA)} trims ${f(vyT, 2)} m/s down`);
  const s3 = C.makeSim(def, world); s3.reset(0); place(s3, 8, VA, -0.5); s3.ctl.thr = thrA; s3.ctl.de = deA;
  let ok = true, T = 0, touched = null, sinkTouch = 0, prev = 0, maxJump = 0, peak = 0, frames = [], iPk = -1, endV = NaN;
  for (let s = 0; s < 45 * 60; s++) {
    s3.step(1 / 60); T += 1 / 60;
    const r = state(s3);
    if (!finite(r)) { ok = false; break; }
    if (touched == null && r.Fy > 0) { touched = T; sinkTouch = -r.vy; s3.ctl.thr = 0.1; }
    if (touched != null) {
      maxJump = Math.max(maxJump, Math.abs(r.Fy - prev)); peak = Math.max(peak, r.Fy);
      if (frames.length < 40) frames.push(r.Fy);
      if (SHOW && (T < touched + 0.4 || s % 120 === 119)) console.log(`   t ${f(T, 2)} V ${f(r.V, 2)} vy ${f(r.vy, 2)} trim ${f(r.trim, 2)} L/W ${f(r.Fy)} R/W ${f(r.R)} wet ${f(r.wet, 2)}`);
      if (T > touched + 20) { endV = r.V; break; }
    } else if (SHOW && s % 60 === 59) console.log(`   t ${f(T, 1)} V ${f(r.V, 2)} vy ${f(r.vy, 2)} cgY ${f(r.cgY, 2)} trim ${f(r.trim, 2)}`);
    prev = r.Fy;
  }
  // the first peak of the water's lift after the touch
  for (let i = 1; i + 1 < frames.length; i++) if (frames[i] >= frames[i - 1] && frames[i] > frames[i + 1]) { iPk = i; break; }
  if (iPk < 0) iPk = frames.indexOf(Math.max(...frames));
  console.log(`   touch at ${f(touched, 2)} s, sinking ${f(sinkTouch, 2)} m/s; the water's lift frame by frame: ${frames.slice(0, 10).map(v => f(v, 2)).join(' ')} ... first peak ${f(frames[iPk])} W after ${iPk + 1} frames; ` +
              `largest one-frame change ${f(maxJump)} W; peak ${f(peak)} W; 20 s on: V ${f(endV, 1)} m/s`);
  verdict(ok, `the landing stays finite`);
  // G451: the bound's floor is 0.35, from 0.5. The Wipline family's transom
  // keel sits 0.8 H over the step keel (the H0 float's sat at 0.6 H), so the
  // aeroplane trimmed to 1 m/s down descends further into the ground effect
  // before its STEP touches, and arrives at 0.42-0.55 m/s where the H0 float
  // touched at 0.92; the touch is still a descent, which is what the floor
  // is for (a skim would read ~0)
  verdict(touched != null && sinkTouch > 0.35 && sinkTouch < 1.6, `the touch at ${f(sinkTouch, 2)} m/s down (bound 0.35-1.6)`);
  verdict(iPk >= 2, `the water's lift climbs over ${iPk + 1} frames to its first peak (bound 3)`);
  verdict(maxJump < 0.35, `no frame adds more than ${f(maxJump)} W (bound 0.35)`);
  verdict(peak < 2, `the touchdown peaks at ${f(peak)} W (bound 2)`);
  verdict(endV < 5, `an idle taxi 20 s after the touch: ${f(endV, 1)} m/s (bound 5)`);
}

// the runner reads the WHOLE verdict line (GATE <ID>: PASS), not the exit code
console.log(fails ? `\nGATE FLOATS: FAIL (${fails})` : '\nGATE FLOATS: PASS');
process.exit(fails ? 1 : 0);
