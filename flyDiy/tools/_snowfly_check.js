#!/usr/bin/env node
// GATE SNOWFLY (DEEP SNOW, 2026-11-15) — WHEELS DO NOT GET OFF DEEP SNOW. THAT IS THE WHOLE POINT OF SKIS.
//
// The user (15 Nov): "model the deep snow wheel effect. And indeed, your tests should cover simple wheels and deep snow, and I
// would expect this to fail without skis. That's the whole point, let's test that". 00_registry: powder (9) and wet snow (10)
// are a VIRGIN layer (Bekker's fresh stiffness, 30 and 15 cm over the base) and a sunk tyre pays its BULLDOZING
// (groundBullWheel: b min(z, D) (sig + rho v^2) - the snow shoved ahead, its ram growing with the speed); packed snow (8) is a
// rolled strip. The Cub (list:1), the C172 (list:50) and the PC-6 (the drafting card) on their WHEELS, as the game loads them.
//
//   node tools/_snowfly_check.js            -> "GATE SNOWFLY: PASS|FAIL" and the table
//   node tools/_snowfly_check.js --show     -> + the phases of every circuit
//
// A. PACKED SNOW IS A STRIP: the pilot's circuit from HOME (1100 m) with the strip and everything within 900 m of it packed
//    snow completes for all three - its take-off roll within 1.3 x grass's - and the no-pilot run (full power from rest, the
//    heading held) gets off within 1.25 x grass's.
// B. DEEP SNOW STOPS A WHEEL: on powder and on wet snow the pilot REJECTS the take-off and the aeroplane never leaves the
//    ground, and stops on the strip; the no-pilot run at full power is held under 0.9 Vs for 60 s (the ram) - for all three,
//    the 550 shp PC-6 included.
// C. A SKI GETS THROUGH (the law, both rows): a ski of the build's own mains' size class (SS-class: 0.30 x 1.8 m on the Cub,
//    0.45 x 2.4 m on the C172 and the PC-6), at the same main's load, at 15 m/s: its sliding (GROUND_SKI_MU: cold powder's 0.12
//    is most of it) and its plough (groundSinkPlate) resist less than half the tyre's compaction + bulldozing, and less than
//    80 % of the build's STATIC thrust's share for that main - it gets going. (The tyre's side is B's, flown: held.)
// D. FLOWN ON SKIS (when SKIS' PC-6 on skis is in the tree: tools/fixtures/test_copies/pc6_skis.json, a build with def.refs.skis or
//    def.parts.ski): the no-pilot run on powder gets off. Without the fixture the row says PENDING and asserts nothing.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const SHOW = process.argv.includes('--show');
const ONE = (process.argv.find(a => a.startsWith('--one=')) || '').slice(6);
const PLANES = { cub: { name: 'Piper Cub (list:1)', file: 'builds/cub_2026-09-20_corrected.json', ski: { W: 0.30, L: 1.8 } },
                 c172: { name: 'Cessna 172 (list:50)', file: 'builds/cessna172r_2026-11-08.json', ski: { W: 0.45, L: 2.4 } },
                 pc6: { name: 'PC-6 (drafting, wheels)', file: 'builds/candidates/pc6_drafting_2026-11-11.json', ski: { W: 0.45, L: 2.4 } } };
const SKI_FIX = path.join(__dirname, 'fixtures', 'skis', 'pc6_skis.json');

function measurePlane(key) {
  const C = require(path.join(__dirname, 'flight_core.js')), LB = require(path.join(__dirname, '_load_build.js'));
  const specOf = f => LB.loadBuild(path.isAbsolute(f) ? f : path.join(ROOT, f)).spec;
  const spec = specOf(PLANES[key].file);
  function circuit(code) {
    const def = C.buildGen(JSON.parse(JSON.stringify(spec))), world = C.makeWorld(), a = world.aerodromes[0];
    const cx = Array.isArray(a.c) ? a.c[0] : a.x, cz = Array.isArray(a.c) ? a.c[1] : a.z;
    if (code != null) { const s0 = world.surface; world.surface = (x, z) => Math.hypot(x - cx, z - cz) < 900 ? code : s0(x, z); a.surface = code; }
    const sim = C.makeSim(def, world); sim.reset(0); for (let i = 0; i < 600; i++) sim.step(1 / 60);
    const ap = C.makePilot(sim, def, world);
    let roll0 = null, lift = null, air = false, last = '', phases = [], end = null, stop = null;
    const onG = () => { const W = sim.wheelContacts(); return W.mains.some(x => x) || W.tw; };
    for (let s = 0; s < 420 * 60; s++) {
      const t = s / 60; ap.update(1 / 60); sim.step(1 / 60);
      if (sim.stats().bad) { end = 'diverged'; break; }
      if (ap.phase !== last) { phases.push(ap.phase + '@' + t.toFixed(0)); last = ap.phase; }
      if (ap.phase === 'ROLL' && !roll0) roll0 = { p: sim.cgPos(), t };
      if (roll0 && !lift && !onG() && t - roll0.t > 1) { lift = { p: sim.cgPos(), t }; air = true; }
      if (ap.phase === 'STOPPED' && t > 10) { stop = { p: sim.cgPos(), t }; break; }
      if (!air && roll0 && ap.phase === 'STOPPED') break;
    }
    const R = C.siteRunway(a), at = sim.cgPos();
    const along = (at[0] - R.end0.x) * R.dx + (at[2] - R.end0.z) * R.dz, cross = Math.abs((at[0] - R.cx) * R.nx + (at[2] - R.cz) * R.nz);
    return { code, outcome: end || (ap.report && ap.report.outcome) || 'none', air, toRoll: roll0 && lift ? Math.hypot(lift.p[0] - roll0.p[0], lift.p[2] - roll0.p[2]) : null,
             stopped: !!stop || ap.phase === 'STOPPED', onStrip: along > -30 && along < R.len + 30 && cross < R.half + 15, phases: phases.join(' ') };
  }
  function straight(sp, code) {
    const def = C.buildGen(JSON.parse(JSON.stringify(sp))), Vs = def.params.gen.Vs, sim = C.makeSim(def, { terrainH: () => 0, surface: () => code, treesNear: () => [] });
    sim.reset(0); for (let i = 0; i < 300; i++) sim.step(1 / 60);
    const Rf = def.refs, P = sim.p, hdg = () => Math.atan2((P[Rf.mains[0] * 3 + 2] + P[Rf.mains[1] * 3 + 2]) / 2 - P[Rf.tw * 3 + 2], (P[Rf.mains[0] * 3] + P[Rf.mains[1] * 3]) / 2 - P[Rf.tw * 3]);
    const h0 = hdg(), p0 = sim.cgPos(); sim.ctl.thr = 1; let run = null, Vmax = 0, thrust0 = 0;
    for (let t = 0; t < 60; t += 1 / 60) {
      let e = hdg() - h0; e = Math.atan2(Math.sin(e), Math.cos(e)); sim.ctl.dr = Math.max(-1, Math.min(1, 4 * e)); sim.step(1 / 60);
      Vmax = Math.max(Vmax, sim.out.V); if (!thrust0) thrust0 = sim.out.thrust || 0;   // (the static thrust: the first frame's)
      const p = sim.cgPos(), d = Math.hypot(p[0] - p0[0], p[2] - p0[2]);
      if (d > 1100) break;
      if (sim.out.V > 0.9 * Vs) { run = d; break; }
    }
    // the static thrust and the mains' load (the law's row C)
    return { run, Vmax, Vs, thrust: thrust0, mass: def.nodes.reduce((s, n) => s + (n.m || 0), 0), ski: !!((def.refs && def.refs.skis) || (def.parts && def.parts.ski)) };
  }
  const out = { key, grass: circuit(null), packed: circuit(8), powder: circuit(9), wet: circuit(10),
                sGrass: straight(spec, 0), sPacked: straight(spec, 8), sPowder: straight(spec, 9), sWet: straight(spec, 10) };
  if (key === 'pc6' && fs.existsSync(SKI_FIX)) { try { out.sSki = straight(specOf(SKI_FIX), 9); } catch (e) { out.skiErr = String(e).slice(0, 200); } }
  // C. the law: a ski against its tyre on each deep row, at a main's static share (90 % of the weight on two mains) and 15 m/s
  const def = C.buildGen(JSON.parse(JSON.stringify(spec))), m = def.nodes.reduce((s, n) => s + (n.m || 0), 0), N = 0.45 * m * 9.81, D = 2 * def.nodes[def.refs.mains[0]].r;
  const fp = C.tyreFootprint('standard', D), SK = PLANES[key].ski;
  out.law = {};
  for (const c of [9, 10]) {
    const S = C.GROUND_SOFT[c];
    const tyre = C.groundSinkWheel(S, N, fp[0], D, fp[1]) + C.groundBullWheel(S, C.GROUND_SINK.z, fp[0], D, 15), tz = C.GROUND_SINK.z;
    const plough = C.groundSinkPlate(S, N, SK.W * SK.L * 0.85, SK.W), sz = C.GROUND_SINK.z;
    const ski = plough + C.GROUND_SKI_MU[c][0] * N;
    out.law[c] = { N, tyre, tz, ski, sz };
  }
  out.thrustShare = out.sGrass.thrust / 2;   // the STATIC thrust's share per main (what a ski must beat to get going)
  return out;
}
if (ONE) { process.stdout.write(JSON.stringify(measurePlane(ONE))); process.exit(0); }

const t0 = Date.now();
Promise.all(Object.keys(PLANES).map(k => new Promise(res => {
  const c = cp.spawn(process.execPath, [__filename, '--one=' + k], { stdio: ['ignore', 'pipe', 'inherit'] });
  let b = ''; c.stdout.on('data', d => b += d); c.on('close', () => { try { res(JSON.parse(b)); } catch (e) { res({ key: k, error: b.slice(0, 300) }); } });
}))).then(R => {
  const fail = [], yes = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); };
  const by = {}; for (const r of R) by[r.key] = r;
  for (const k in PLANES) if (!by[k] || by[k].error) fail.push(k + ': no result ' + (by[k] && by[k].error));
  if (fail.length) { for (const f of fail) console.log('  FAIL ' + f); console.log('GATE SNOWFLY: FAIL (' + fail.length + ')'); process.exit(1); }
  const m = v => v == null ? '   -' : String(Math.round(v)).padStart(4);
  const oc = c => c.outcome === 'completed' ? 'flies' : c.outcome === 'rejected-takeoff' ? 'REJECTED' : c.outcome;
  const st = s => s.run != null ? (Math.round(s.run) + ' m') : ('STUCK ' + s.Vmax.toFixed(1) + '/' + (0.9 * s.Vs).toFixed(1) + ' m/s');
  console.log('  ON WHEELS. The pilot\'s circuit from HOME (take-off roll, outcome) | the no-pilot full-power run (to 0.9 Vs, or the speed it is held at)');
  console.log('  ' + 'aeroplane'.padEnd(24) + 'grass'.padEnd(20) + 'packed snow (8)'.padEnd(24) + 'powder (9)'.padEnd(28) + 'wet snow (10)');
  for (const k in PLANES) { const r = by[k];
    console.log('  ' + PLANES[k].name.padEnd(24) + (m(r.grass.toRoll) + ' m ' + oc(r.grass)).padEnd(20) + (m(r.packed.toRoll) + ' m ' + oc(r.packed)).padEnd(24) + oc(r.powder).padEnd(28) + oc(r.wet));
    console.log('  ' + ''.padEnd(24) + st(r.sGrass).padEnd(20) + st(r.sPacked).padEnd(24) + st(r.sPowder).padEnd(28) + st(r.sWet));
    if (SHOW) for (const c of [r.grass, r.packed, r.powder, r.wet]) console.log('      ' + (c.code == null ? 'grass' : c.code) + ': ' + c.phases);
  }
  console.log('  THE LAW at a main\'s load, 15 m/s: the tyre (compaction + bulldozing) against a ski of its class (sliding + plough), N; the static thrust\'s share a main');
  for (const k in PLANES) { const r = by[k];
    console.log('  ' + PLANES[k].name.padEnd(24) + [9, 10].map(c => { const L = r.law[c]; return (c === 9 ? 'powder ' : 'wet ') + 'tyre ' + Math.round(L.tyre) + ' (' + (L.tz * 100).toFixed(0) + ' cm) / ski ' + Math.round(L.ski) + ' (' + (L.sz * 100).toFixed(0) + ' cm)'; }).join('   ') + '   thrust ' + Math.round(r.thrustShare)); }
  const pc = by.pc6;
  console.log('  FLOWN ON SKIS (the PC-6, SKIS\' fixture): ' + (pc.sSki ? st(pc.sSki) + (pc.sSki.ski ? '' : ' (the fixture built WITHOUT skis)') : pc.skiErr ? 'ERROR ' + pc.skiErr : 'PENDING - tools/fixtures/test_copies/pc6_skis.json lands with SKIS'));
  // A
  for (const k in PLANES) { const r = by[k], nm = PLANES[k].name;
    yes(r.grass.outcome === 'completed', 'A ' + nm + ' flies off grass', r.grass.outcome);
    yes(r.packed.outcome === 'completed' && r.packed.toRoll != null && r.grass.toRoll != null && r.packed.toRoll <= 1.3 * r.grass.toRoll, 'A ' + nm + ' flies off packed snow (its roll within 1.3 x grass\'s)', r.packed.outcome + ' ' + m(r.packed.toRoll));
    yes(r.sPacked.run != null && r.sGrass.run != null && r.sPacked.run <= 1.25 * r.sGrass.run, 'A ' + nm + ': the no-pilot run gets off packed snow within 1.25 x grass\'s', st(r.sPacked) + ' vs ' + st(r.sGrass));
  }
  // B
  for (const k in PLANES) { const r = by[k], nm = PLANES[k].name;
    for (const [w, c, s] of [['powder', r.powder, r.sPowder], ['wet snow', r.wet, r.sWet]]) {
      yes(!c.air && c.outcome === 'rejected-takeoff' && c.onStrip, 'B ' + nm + ' on wheels does NOT fly off ' + w + ': the pilot rejects, it never leaves the ground, it stops on the strip', c.outcome + (c.air ? ' (AIRBORNE)' : ''));
      yes(s.run == null && s.Vmax < 0.9 * s.Vs, 'B ' + nm + ' on wheels at full power is held under 0.9 Vs on ' + w, st(s));
    }
  }
  // C
  for (const k in PLANES) { const r = by[k], nm = PLANES[k].name;
    for (const c of [9, 10]) { const L = r.law[c];
      yes(L.ski < 0.5 * L.tyre, 'C ' + nm + ' on ' + (c === 9 ? 'powder' : 'wet snow') + ': a ski resists under half its tyre', Math.round(L.ski) + ' vs ' + Math.round(L.tyre) + ' N');
      yes(L.ski < 0.8 * r.thrustShare, 'C ' + nm + ' on ' + (c === 9 ? 'powder' : 'wet snow') + ': the ski under 80 % of the static thrust\'s share for its main (it gets going; the tyre side is B\'s, flown)', 'ski ' + Math.round(L.ski) + ', static thrust a main ' + Math.round(r.thrustShare));
    }
  }
  // D
  if (pc.sSki && pc.sSki.ski) yes(pc.sSki.run != null, 'D the PC-6 ON SKIS gets off powder (SKIS\' fixture)', st(pc.sSki));
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  console.log('GATE SNOWFLY: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
});
