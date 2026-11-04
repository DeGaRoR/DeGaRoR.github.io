#!/usr/bin/env node
// GATE HULL (HULL-B1..B3, futureDesigns/HULL-TYPES-2026-11.md) — THE FLYING BOAT. The fuselage IS the hull: the cage's
// hullOn reads the same frames as keel, chine and gunwale (_cage_gen.js THE BOAT HULL), the join measures the drawn
// rings into the water's station table (cageHullTable -> spec.gear.hull), and the frame hangs ONE centreline hull on
// the fuselage's own frames (61_gen_frame.js HULL-B3), flown by 32_hydro's makeFloat from that table.
//
//   node tools/_hull_check.js            -> "GATE HULL: PASS|FAIL"
//   node tools/_hull_check.js --show     -> the traces
//
// WHAT IT ASSERTS:
//   CAGE     hullOn 0 is the build it was: every saved build under builds/ and the defaults, three cage steps, the
//            same mesh and the same spec.cage as with the hull rows absent; hullOn 1 adds the step's ring pair, the
//            keel the section's lowest point, the chine raised by its half-width x tan(deadrise) at the step, the
//            afterbody keel the step depth higher
//   BUILD    the user's Cessna-on-floats build switched to the Hull tile, through THE GAME'S OWN LOAD CHAIN
//            (_load_build.js: the editor's layers, the join, the merge): one centreline hull record, the table the
//            join measured is the one the water flies (the panels' sections ARE the table's rows), closed, the hull
//            displacing >= 150 % of the gross to the gunwale, no float clusters, no wheels
//            (the build made a boat as a builder would: the Engine mount tile's 'Over the wing', the nose a bow; the
//            Hull tile's one-shot fit off the flown CG - the step 12 deg aft of it, the afterbody keel on 7 deg)
//   SETTLE   dropped from 0.2 m, engine idle: the water carries the weight (+-3 %), the step keel under the water,
//            the trim inside -6..8 deg and the bow's deck clear of the water, upright on a tip float, the frame under
//            6 % strain, finite
//   TAKEOFF  THE PILOT (43_pilot.js) on the SEA lane, calm air: a hump of R/W 0.05-0.45, the step ventilated, airborne
//            for real (dry 2 s) inside 60 s, the heading within 30 deg and the roll within 15 on the run
// Measured the day it was written (HULL-B3): the hull off, 108 meshes identical; the boat 896 kg, its hull 3.6 x the
// gross to the gunwale, the step 12.0 deg aft of the CG; at rest -4.5 deg on the datum, the bow's deck 0.22 m clear,
// 2.4 deg on a tip float; the hump R/W 0.26 at 8.4 m/s, airborne at 26.0 s at 27.6 m/s, the heading within 5.4 deg
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require('./flight_core.js');
const G = require('./_cage_gen.js');
const SHOW = process.argv.includes('--show');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);
const crypto = require('crypto');
const hash = o => crypto.createHash('md5').update(JSON.stringify(o)).digest('hex');

// ---- CAGE ---------------------------------------------------------------------------------------------------------
console.log('CAGE');
{
  // the hull rows at their defaults with the hull OFF must be invisible: the same mesh and spec.cage as a build that
  // never had them (the rows deleted from P: the save before HULL-B1)
  const files = [];
  const walk = d => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.json$/.test(n)) files.push(p); } };
  walk(path.join(ROOT, 'builds'));
  const Ps = [G.cageDefaults()];
  for (const p of files) { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); const sp = j.spec || j; if (sp && sp.cage) Ps.push(G.cageFromSpec(sp)); } catch (e) { /* not a build */ } }
  let diff = 0, n = 0, keyLeak = 0;
  for (const P of Ps) {
    const P0 = JSON.parse(JSON.stringify(P));
    for (const k of ['hullOn'].concat(G.CAGE_HULL_ROWS)) delete P0[k];
    for (const st of [0, 2, 'crease']) {
      n++;
      if (hash(G.buildCage2(G.cageSpec(JSON.parse(JSON.stringify(P))), st)) !== hash(G.buildCage2(G.cageSpec(JSON.parse(JSON.stringify(P0))), st))) diff++;
    }
    const sc = G.cageToSpec(P);
    if (['hullOn'].concat(G.CAGE_HULL_ROWS).some(k => k in sc)) keyLeak++;
  }
  verdict(diff === 0, `hull off: ${n} cage meshes (${Ps.length} builds x 3 steps) identical to the rows' absence (${diff} differ)`);
  verdict(keyLeak === 0, `hull off: no hull row reaches spec.cage (${keyLeak} builds leak one)`);
  // hull on: the reading
  const P = Object.assign(G.cageDefaults(), { hullOn: 1 });
  const H = G.cageHullSpec(P);
  const L = G.cageHullLines(P);
  const fore = L.sta.find(s => s.side === 'F'), aft = L.sta.find(s => s.side === 'A');
  const m0 = G.buildCage2(G.cageSpec(G.cageDefaults()), 'crease'), m1 = G.buildCage2(G.cageSpec(P), 'crease');
  console.log(`   default + hull: ${L.sta.length} stations, step at cage z ${f(L.zStep)} (fore keel ${f(fore && fore.yk)}, aft ${f(aft && aft.yk)}); mesh ${m0.V.length} -> ${m1.V.length} vertices`);
  const gap = Math.max(0.02, 0.6 * H.hs);
  verdict(!!fore && !!aft && Math.abs((fore.z - aft.z) - gap) < 0.003, `the step is a ring pair ${f(fore && aft ? fore.z - aft.z : NaN, 4)} apart (0.6 x its depth, HULL-B6: room for its loops)`);
  verdict(!!fore && !!aft && Math.abs((aft.yk - fore.yk) - H.hs) < 0.012, `the afterbody keel is the step depth higher (${f(aft.yk - fore.yk, 4)} vs ${f(H.hs, 4)})`);
  const bStep = Math.atan2(fore.yc - fore.yk, fore.b) * 180 / Math.PI;
  verdict(Math.abs(bStep - H.beta) < 0.01, `the chine at the step stands on the deadrise: ${f(bStep, 2)} deg (row ${f(H.beta, 2)})`);
  verdict(L.sta.every(s => s.yk <= s.yc + 1e-9 && s.yc <= s.yd + 1e-9), `every ring: keel <= chine <= gunwale`);
  // the keel is the section's lowest point, in both modes (the frames' "bottom height" keeps its meaning)
  const lowest = m => { const z = {}; for (const v of m.V) { const k = v[2].toFixed(3); z[k] = Math.min(z[k] == null ? Infinity : z[k], v[1]); } return z; };
  const lo0 = lowest(m0), lo1 = lowest(m1), cab = '1.823';
  verdict(lo0[cab] != null && Math.abs(lo0[cab] - lo1[cab]) < 1e-9, `the cabin frame's lowest point is the same in both modes (${f(lo0[cab], 4)} / ${f(lo1[cab], 4)})`);
}

// ---- BUILD --------------------------------------------------------------------------------------------------------
console.log('\nBUILD (the Cessna-on-floats build made a boat in the editor - the engine "Over the wing", the nose a bow - and the Hull tile picked, through the game\'s load chain)');
const LB = require('./_load_build.js');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'bugReports', 'cessnaFloatsWOrks.json'), 'utf8'));
{
  const sp = raw.spec || raw;
  // the Engine mount tile's 'Over the wing' (_cage_design.js engMount wingTop + NOSE_AERO), the nose lengthened to a
  // bow (noseLen, a shared row), and what the Undercarriage tile's Hull option writes (_cage_design.js gearLayout 'hull')
  sp.gear = Object.assign({}, sp.gear, { type: 'hull' }); delete sp.gear.floats;
  sp.cage = Object.assign({}, sp.cage, { engMount: 2, wgPos: 0, cowlOn: 0, cw_aftMode: 1, cw_tailLen: 1.0, aeroAftOn: 1,
    engPylonH: 1.0,   // G3912: the pylon tall enough that the Cessna's 2.06 m propeller clears the cabin (the layer's prop check)
    noseFinish: 1, noseLen: 1.3, cowlLoops: 4, noseTip: 0.98, noseDroop: 0.10, cowlEase: 0.62, cowlBulge: 1.06,
    s1On: 0, s2On: 0, gearFloats: 0, hullOn: 1, crKeel: 3 });
}
// THE TILE'S FIT (cageHullFit, what its `after` writes off the flown CG): the step by the 12-deg rule, the afterbody
// keel onto a 7-deg run - two passes, as the page's CG handshake settles it (the step moves the CG by grams)
const cgOf = sp2 => { const d = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(sp2)))); let m = 0, x = 0, y = 0; for (const n of d.nodes) { m += n.m; x += n.m * n.p[0]; y += n.m * n.p[1]; } return [x / m, y / m, m]; };
let spec = null, fitRows = null, joinErrs = [], tipProbe = null;
for (let pass = 0; pass < 3; pass++) {
  // the last pass with the page-side probe: the tip floats as drawn (HULL-B5)
  if (pass === 2) process.env.FLYDIY_JOIN_PROBE = path.join(T, '_hull_tip_probe.js');
  const got = LB.gameSpecFull(JSON.parse(JSON.stringify(raw)));
  if (pass === 2) { delete process.env.FLYDIY_JOIN_PROBE; tipProbe = got.probe; }
  spec = got.spec; joinErrs = got.errors || [];
  if (pass === 2) break;
  const [cx, cy, mass] = cgOf(spec);
  const P = G.cageFromSpec(spec), FS = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
  const TB = G.cageHullTable(G.cageHullLines(P), FS), hr = spec.gear.hull;
  if (!TB || !hr) break;
  const zFw = hr.x + TB.zStep * FS, yD = TB.yStep * FS - hr.y;
  fitRows = G.cageHullFit(P, (zFw - cx) / FS, (cy + yD) / FS);
  // HULL-B5: the tip floats' rows, the page's way (_cage_float.js hullFitStep: HYDRO.hullTipFit off the flown mass)
  const tf = C.HYDRO.hullTipFit({ sta: G.cageHullTable(G.cageHullLines(Object.assign({}, P, fitRows)), FS).sta }, mass);
  if (tf) { fitRows.hullTipKg = tf.kg; fitRows.hullTipY = tf.y; }
  Object.assign((raw.spec || raw).cage, fitRows);
}
console.log(`   the tile's fit: ${JSON.stringify(fitRows)}`);
const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
const world = C.makeWorld();
let M = 0; for (const n of def.nodes) M += n.m;
const W = M * 9.81;
const X0 = 0, Z0 = 1600, h = world.waterH(X0, Z0);
{
  const fl = def.parts.floats, hr = spec.gear.hull;
  const F0 = fl && fl[0] && C.HYDRO.makeFloat(fl[0].P);
  const disp = F0 ? F0.volDeck * 1000 : 0;
  let clo = [0, 0, 0]; if (F0) for (const pn of F0.panels) for (let k = 0; k < 3; k++) clo[k] += pn.n0[k] * pn.area0;
  const cl = def.clusters.filter(c => c.cls === 'float');
  console.log(`   ${def.nodes.length} nodes, gross ${f(M, 1)} kg; the hull: ${hr ? hr.sta.length : 0} measured stations, L ${f(F0 && F0.P.L, 2)} m, beam ${f(F0 && F0.P.B, 2)} m, ` +
              `deadrise ${f(F0 && F0.P.beta, 1)} / ${f(F0 && F0.P.betaA, 1)} deg, step ${f(F0 && F0.P.hs, 3)} m at x ${f(hr && hr.x, 2)} aft of the firewall; displaces ${f(disp, 0)} kg to the gunwale (${f(disp / M, 2)} x gross)`);
  verdict(spec.gear.type === 'hull' && !!hr, `the join measured the hull (gear.type ${spec.gear.type}, ${hr ? hr.sta.length : 0} stations)`);
  // G3912: the build the gate flies is the one the garage draws - no join error (an engine flown and not drawn was one)
  verdict(!joinErrs.length, `the join files no error (${joinErrs.length ? joinErrs.join(' | ') : 'none'})`);
  verdict(fl && fl[0].side === 0 && fl[0].hull === true && fl.filter(x => x.hull).length === 1 && fl.filter(x => x.tip).length === 2 && cl.length === 3, `one centreline hull record and two strut tip floats (${fl ? fl.length : 0} water records, ${cl.length} rigid clusters)`);
  // drawn = flown: the water's sections at the table's own stations are the table's rows
  let worst = 0;
  if (F0 && hr) for (const r of hr.sta) {
    const s = C.HYDRO.sectionOf(F0.P, r.x === 0 ? 0 : r.x);
    worst = Math.max(worst, Math.abs(s.yk - r.yk), Math.abs(s.b - Math.max(1e-4, r.b)), Math.abs(s.yc - Math.max(r.yk, r.yc)));
  }
  verdict(worst < 1e-9, `the water flies the measured rows (worst section difference ${f(worst, 12)} m)`);
  verdict(Math.hypot(...clo) < 1e-6, `the hull is closed (|sum n A| ${f(Math.hypot(...clo), 9)})`);
  verdict(disp >= 1.5 * M, `the hull displaces ${f(disp / M, 2)} x the gross to the gunwale (bound 1.5)`);
  verdict(def.refs.tw === -1 && def.nodes.every(n => !(n.r > 0)), `no wheels: no tailwheel, no wheel node`);
  // HULL-B5: THE TIP FLOATS ARE DRAWN WHERE THEY FLY - the garage's floats (the page probe) against the frame's
  // records, through the join's datums (cage = [z, y + yD, zFw - x])
  {
    const D = tipProbe && typeof tipProbe === 'object' ? tipProbe.datum : null, drawn = tipProbe && tipProbe.tips;
    let worst = Infinity, dL = Infinity;
    if (D && Array.isArray(drawn)) {
      worst = 0; dL = 0;
      for (const rec of fl.filter(x => x.tip)) {
        const c = [rec.pos[2], rec.pos[1] + D.yD, D.zFw - rec.pos[0]], d = drawn.find(t => t.side === rec.side);
        if (!d) { worst = Infinity; break; }
        worst = Math.max(worst, Math.hypot(c[0] - d.step[0], c[1] - d.step[1], c[2] - d.step[2]));
        dL = Math.max(dL, Math.abs(rec.P.L - d.L));
      }
    }
    verdict(worst < 0.01 && dL < 1e-6, `the tip floats are drawn where they fly: worst station ${f(worst, 4)} m, length ${f(dL, 6)} m apart (${drawn ? drawn.length : 0} drawn)`);
  }
  let mx = 0, my = 0; for (const n of def.nodes) { mx += n.m * n.p[0]; my += n.m * n.p[1]; } mx /= M; my /= M;
  const ang = Math.atan2(hr.x - mx, my - hr.y) * 180 / Math.PI;
  verdict(ang > 10 && ang < 15, `the step stands ${f(ang, 1)} deg aft of the CG (the seaplane's 10-15)`);
}
const state = (sim) => {   // (the hull record's own numbers: the tip floats carry the rest of the weight)
  const [xA, yU] = sim.axes();
  const trim = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI;
  const roll = Math.asin(Math.max(-1, Math.min(1, yU[2]))) * 180 / Math.PI;
  let vx = 0, vy = 0, mm = 0, cy = 0; for (let i = 0; i < sim.n; i++) { vx += sim.v[i * 3] * sim.m[i]; vy += sim.v[i * 3 + 1] * sim.m[i]; cy += sim.p[i * 3 + 1] * sim.m[i]; mm += sim.m[i]; }
  const fl = sim.hydro.floats, x = fl[0];
  return { V: -vx / mm, vy: vy / mm, cgY: cy / mm - h, trim, roll, Fy: fl.reduce((a, y) => a + y.out.F[1], 0) / W, R: x.out.F[0] / W, wet: x.wet, vent: x.out.vent || 0,
           draft: x.h - x.out.W[x.F.edge.K][1] };
};
function place(sim, hAbove, V) {
  const p = sim.p, v = sim.v, iK = def.parts.floats[0].K[2];
  const dx = X0 - p[iK * 3], dz = Z0 - p[iK * 3 + 2], dy = (h + hAbove) - p[iK * 3 + 1];
  for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = -(V || 0); v[i * 3 + 1] = 0; v[i * 3 + 2] = 0; }
}
const finite = r => Number.isFinite(r.V) && Number.isFinite(r.trim) && Number.isFinite(r.Fy);

// ---- SETTLE -------------------------------------------------------------------------------------------------------
console.log('\nSETTLE (dropped from 0.2 m, throttle 0)');
const sim = C.makeSim(def, world); sim.reset(0); place(sim, 0.2, 0); sim.ctl.thr = 0;
{
  let ok = true, Fy = 0, dr = 0, tr = 0, rl = 0, n = 0, maxRoll = 0;
  for (let s = 0; s < 600; s++) {
    sim.step(1 / 60);
    const r = state(sim);
    if (!finite(r)) { ok = false; break; }
    maxRoll = Math.max(maxRoll, Math.abs(r.roll));
    if (s >= 480) { Fy += r.Fy; dr += r.draft; tr += r.trim; rl += Math.abs(r.roll); n++; }
    if (SHOW && s % 60 === 59) console.log(`   t ${f((s + 1) / 60, 1)} cgY ${f(r.cgY)} trim ${f(r.trim, 2)} roll ${f(r.roll, 2)} L/W ${f(r.Fy)} wet ${f(r.wet, 2)} draft ${f(r.draft)}`);
  }
  Fy /= n; dr /= n; tr /= n; rl /= n;
  let maxStrain = 0; for (const b of sim.beams) maxStrain = Math.max(maxStrain, Math.abs(b.strain));
  console.log(`   at rest: L/W ${f(Fy)}, draft at the step ${f(dr)} m, trim ${f(tr, 2)} deg, roll ${f(rl, 2)} deg (max ${f(maxRoll, 2)}), max beam strain ${f(maxStrain, 4)}`);
  verdict(ok, `the settle stays finite`);
  verdict(Math.abs(Fy - 1) < 0.03, `the water carries the weight: L/W ${f(Fy)} (bound +-3 %)`);
  verdict(dr > 0.05 && dr < 0.60, `the step keel under the water: draft ${f(dr)} m (bound 0.05-0.60)`);
  // THE REST TRIM IS THE DESIGN'S, and this fixture is a Cessna made a boat by two tiles: its forebody is 2.3 m
  // against a 4.6 m afterbody, the centre of buoyancy at level trim 0.27 m aft of the CG (measured), so it settles
  // bow-down until they line up (-4.5 deg on the fuselage datum). The bound is seaworthiness - the bow's deck clear
  // of the water - not a level boat; the builder balances it (the wing, the engine, the hull's frames)
  verdict(tr > -6 && tr < 8, `trim ${f(tr, 2)} deg at rest on the fuselage datum (bound -6..8)`);
  { const hu = sim.hydro.floats[0], Wv = hu.out.W, dk = hu.F.sta[0];
    const bowDeck = Math.min(...[dk.Dm, dk.Dp].map(i => Wv[i][1])) - hu.h;
    verdict(bowDeck > 0.15, `the bow's deck ${f(bowDeck)} m over the water at rest (bound 0.15: the bow is not awash)`); }
  verdict(rl < 4 && maxRoll < 6, `upright: ${f(rl, 2)} deg at rest (a boat rests on one tip float), ${f(maxRoll, 2)} max`);
  verdict(maxStrain < 0.06, `the frame's max strain ${f(maxStrain, 4)} (bound 0.06)`);
}

// ---- TAKEOFF -------------------------------------------------------------------------------------------------------
// THE PILOT FLIES IT (43_pilot.js, as GATE SEAPLANE flies the floats): the SEA lane, placed and routed as a meadow,
// its rudder law on the water rudder below the step and the air rudder on it, the aileron lifting the low float. The
// run is judged until the boat is AIRBORNE FOR REAL (dry two whole seconds); the hump is the hull's own resistance
console.log('\nTAKEOFF (the pilot, the SEA lane, calm air)');
{
  const w2 = C.makeWorld();
  const sea = w2.aerodromes.find(a => a.id === 'SEA');
  const s2 = C.makeSim(def, w2); s2.reset(0); C.placeAtAerodrome(s2, sea);
  const ap = C.makePilot(s2, def, w2); ap.setRoute(sea, sea);
  let Tt = 0, ok = true, last = '', wasWet = true, dryFrom = null, lift = null, maxRoll = 0, hump = { R: 0, V: 0 }, vent = 0, hdgRef = null, maxHdg = 0, Vlift = 0;
  for (let s = 0; s < 120 * 60; s++) {
    ap.update(1 / 60);
    s2.step(1 / 60); Tt += 1 / 60;
    const cg = s2.cgPos(), v = s2.cgVel(); const [xA, yU] = s2.axes();
    if (!Number.isFinite(cg[0]) || !Number.isFinite(v[0])) { ok = false; break; }
    const fx = s2.hydro.floats, hullX = fx[0];
    const wet = fx.reduce((a, x) => a + x.wet, 0) > 0;
    const V = Math.hypot(v[0], v[2]), roll = Math.asin(Math.max(-1, Math.min(1, yU[2]))) * 180 / Math.PI;
    const hdg = Math.atan2(-xA[0], -xA[2]) * 180 / Math.PI;
    const run = ap.phase === 'ROLL' || ap.phase === 'LIFTOFF';
    if (run && wet && lift == null) {
      if (hdgRef == null) hdgRef = hdg;
      maxHdg = Math.max(maxHdg, Math.abs(((hdg - hdgRef + 540) % 360) - 180));
      maxRoll = Math.max(maxRoll, Math.abs(roll));
      let Rx = 0; for (const x of fx) Rx += -(x.out.F[0] * v[0] + x.out.F[2] * v[2]) / Math.max(0.3, V);
      if (V < 14 && Rx / W > hump.R) hump = { R: Rx / W, V };
      vent = Math.max(vent, hullX.out.vent || 0);
    }
    if (ap.phase !== last) { if (SHOW) console.log(`   t ${f(Tt, 1)} -> ${ap.phase} V ${f(V, 2)} hdg ${f(hdg, 1)} roll ${f(roll, 1)}`); last = ap.phase; }
    if (SHOW && s % 120 === 119 && lift == null) console.log(`   t ${f(Tt, 1)} ${ap.phase} V ${f(V, 2)} roll ${f(roll, 1)} hdg ${f(hdg, 1)} wet ${fx.map(x => f(x.wet, 1)).join('/')} vent ${f(hullX.out.vent || 0, 2)}`);
    if (!wet && wasWet && Tt > 2 && lift == null) { dryFrom = Tt; Vlift = V; }
    if (wet && !wasWet && lift == null) dryFrom = null;
    if (!wet && dryFrom != null && lift == null && Tt - dryFrom >= 2) lift = dryFrom;
    wasWet = wet;
    if (lift != null && Tt > lift + 3) break;
  }
  console.log(`   hump R/W ${f(hump.R)} at ${f(hump.V, 1)} m/s; the step ventilated to ${f(vent, 2)}; airborne ${lift == null ? 'NO' : 'at ' + f(lift, 1) + ' s, ' + f(Vlift, 1) + ' m/s'}; on the run: heading swing ${f(maxHdg, 1)} deg, roll ${f(maxRoll, 1)} deg`);
  verdict(ok, `the take-off stays finite`);
  verdict(hump.R > 0.05 && hump.R < 0.45, `a hump of R/W ${f(hump.R)} at ${f(hump.V, 1)} m/s (bound 0.05-0.45)`);
  verdict(vent > 0.95, `the step ventilates before lift-off (${f(vent, 2)})`);
  verdict(lift != null && lift < 60, `airborne for real inside 60 s (${lift == null ? 'never' : f(lift, 1) + ' s'})`);
  verdict(maxHdg < 30 && maxRoll < 15, `the run holds its line: heading swing ${f(maxHdg, 1)} deg (bound 30), roll ${f(maxRoll, 1)} deg (bound 15)`);
}

console.log(fails ? `\nGATE HULL: FAIL (${fails})` : '\nGATE HULL: PASS');
process.exit(fails ? 1 : 0);
