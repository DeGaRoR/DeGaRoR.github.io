#!/usr/bin/env node
// GATE MUDFLY (SNOW-MUD FINISH, 2026-11-15) — THE CUB, THE CESSNA 172 AND THE PC-6 FLOWN ON MUD.
//
// A0 for the user (15 Nov): "node flown tests on mud: Cub, Cessna 172 (list:50) and PC-6. Cover take-off roll, landing roll
// and stuck/not-stuck limits, with the numbers in a table". Three builds as the game loads them (tools/_load_build.js):
// the Cub (list:1, builds/cub_2026-09-20_corrected.json), the C172 (list:50, builds/cessna172r_2026-11-08.json), the PC-6
// (builds/candidates/pc6_drafting_2026-11-11.json - the drafting card on wheels, L40a's).
//
//   node tools/_mudfly_check.js            -> "GATE MUDFLY: PASS|FAIL" and the table
//   node tools/_mudfly_check.js --show     -> + the phases of every circuit
//
// A. THE CIRCUITS. THE PILOT (43_pilot makePilot) flies a full circuit from HOME (1100 m) on grass, then with HOME's strip
//    and everything within 900 m of it FIRM MUD (SURFACE 11), then SOFT MUD (12) - the aerodrome record says so too, so the
//    pilot plans on it. Measured: the take-off roll (the roll's start to the wheels' leaving), the landing roll (the
//    touchdown to the stop), the outcome. Asserted:
//      every build completes its circuit on grass and on firm mud (a muddy community strip is for every light aeroplane);
//      on firm mud the take-off roll is longer than on grass and no more than 1.6 x it (the soft-field rule's +20-50 %, and
//      no aeroplane that flies off grass is stopped by it);
//      on soft mud each build either completes (its roll no shorter than on firm) or its pilot REJECTS the take-off and
//      stops on the strip - never a crash, never a run off the end;
//      every landing on mud stops on the strip.
// B. THE LIMITS (no pilot: full power from rest, the heading held, the stick neutral, to 0.9 Vs within 60 s and 1100 m):
//    the soft-mud layer's stiffness scaled down (k x f, f from 1 to 0.15) until the build no longer gets off - its STUCK
//    LIMIT, f*; and from rest whether it moves at all (2 m/s within 30 s). Asserted: the run lengthens as the mud softens
//    (no build faster on softer mud); the tricycle's limit is the stiffest (its small nose wheel ploughs: f*_C172 >= the
//    taildraggers'); the Cub and the PC-6 still get off the soft mud as built (f* < 1).
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const SHOW = process.argv.includes('--show');
const ONE = (process.argv.find(a => a.startsWith('--one=')) || '').slice(6);
const PLANES = { cub: { name: 'Piper Cub (list:1)', file: 'builds/cub_2026-09-20_corrected.json' },
                 c172: { name: 'Cessna 172 (list:50)', file: 'builds/cessna172r_2026-11-08.json' },
                 pc6: { name: 'PC-6 (drafting, wheels)', file: 'builds/candidates/pc6_drafting_2026-11-11.json' } };
const FS = [1, 0.7, 0.5, 0.35, 0.25, 0.15];

function measurePlane(key) {
  const C = require(path.join(__dirname, 'flight_core.js')), LB = require(path.join(__dirname, '_load_build.js'));
  const spec = LB.loadBuild(path.join(ROOT, PLANES[key].file)).spec;
  // A. a circuit from HOME, its surroundings of code `code` (null: as built)
  function circuit(code) {
    const def = C.buildGen(JSON.parse(JSON.stringify(spec))), world = C.makeWorld(), a = world.aerodromes[0];
    const cx = Array.isArray(a.c) ? a.c[0] : a.x, cz = Array.isArray(a.c) ? a.c[1] : a.z;
    if (code != null) { const s0 = world.surface; world.surface = (x, z) => Math.hypot(x - cx, z - cz) < 900 ? code : s0(x, z); a.surface = code; }
    const sim = C.makeSim(def, world); sim.reset(0); for (let i = 0; i < 600; i++) sim.step(1 / 60);
    const ap = C.makePilot(sim, def, world);
    let roll0 = null, lift = null, td = null, stop = null, air = false, last = '', phases = [], maxSink = 0, end = null;
    const onG = () => { const W = sim.wheelContacts(); return W.mains.some(x => x) || W.tw; };
    for (let s = 0; s < 420 * 60; s++) {
      const t = s / 60; ap.update(1 / 60); sim.step(1 / 60);
      if (sim.stats().bad) { end = 'diverged'; break; }
      if (sim.out.softZ > maxSink) maxSink = sim.out.softZ;
      if (ap.phase !== last) { phases.push(ap.phase + '@' + t.toFixed(0)); last = ap.phase; }
      const p = sim.cgPos();
      if (ap.phase === 'ROLL' && !roll0) roll0 = { p, t };
      if (roll0 && !lift && !onG() && t - roll0.t > 1) { lift = { p, t }; air = true; }
      if (air && !td && onG() && t - lift.t > 20) td = { p, t };
      if (ap.phase === 'STOPPED' && (td || !air) && t > 10) { stop = { p, t }; break; }
    }
    const d = (A, B) => A && B ? Math.hypot(B.p[0] - A.p[0], B.p[2] - A.p[2]) : null;
    // on the strip: the stop within the strip's box (the runway's own frame)
    const R = C.siteRunway(a), at = stop ? stop.p : sim.cgPos();
    const along = (at[0] - R.end0.x) * R.dx + (at[2] - R.end0.z) * R.dz, cross = Math.abs((at[0] - R.cx) * R.nx + (at[2] - R.cz) * R.nz);
    return { code, outcome: end || (ap.report && ap.report.outcome) || 'none', toRoll: d(roll0, lift), ldRoll: d(td, stop), stopped: !!stop,
             onStrip: along > -30 && along < R.len + 30 && cross < R.half + 15, maxSink, phases: phases.join(' '), why: ap.report && ap.report.why };
  }
  // B. full power from rest on flat soft mud (k x f), the heading held, the stick neutral
  const S12 = Object.assign({}, C.GROUND_SOFT[12]);
  function straight(f) {
    C.GROUND_SOFT[12] = Object.assign({}, S12, { k: S12.k * f });
    const def = C.buildGen(JSON.parse(JSON.stringify(spec))), Vs = def.params.gen.Vs, sim = C.makeSim(def, { terrainH: () => 0, surface: () => 12, treesNear: () => [] });
    sim.reset(0); for (let i = 0; i < 300; i++) sim.step(1 / 60);
    const Rf = def.refs, P = sim.p, hdg = () => Math.atan2((P[Rf.mains[0] * 3 + 2] + P[Rf.mains[1] * 3 + 2]) / 2 - P[Rf.tw * 3 + 2], (P[Rf.mains[0] * 3] + P[Rf.mains[1] * 3]) / 2 - P[Rf.tw * 3]);
    const h0 = hdg(), p0 = sim.cgPos(), rest = sim.out.softW ? sim.out.softW.slice(0, 3) : [0, 0, 0];
    sim.ctl.thr = 1; let run = null, moved = false, t = 0;
    for (; t < 60; t += 1 / 60) {
      let e = hdg() - h0; e = Math.atan2(Math.sin(e), Math.cos(e)); sim.ctl.dr = Math.max(-1, Math.min(1, 4 * e));
      sim.step(1 / 60);
      const p = sim.cgPos(), dist = Math.hypot(p[0] - p0[0], p[2] - p0[2]);
      if (t < 30 && sim.out.V > 2) moved = true;
      if (dist > 1100) break;
      if (sim.out.V > 0.9 * Vs) { run = dist; break; }
    }
    C.GROUND_SOFT[12] = S12;
    return { f, run, moved, V: sim.out.V, rest: rest.map(z => +z.toFixed(4)) };
  }
  const out = { key, grass: circuit(null), firm: circuit(11), soft: circuit(12), limits: FS.map(straight) };
  const stuck = out.limits.find(r => r.run == null);
  out.fStar = stuck ? stuck.f : 0;
  return out;
}

if (ONE) { process.stdout.write(JSON.stringify(measurePlane(ONE))); process.exit(0); }

const t0 = Date.now();
const kids = Object.keys(PLANES).map(k => new Promise(res => {
  const c = cp.spawn(process.execPath, [__filename, '--one=' + k], { stdio: ['ignore', 'pipe', 'inherit'] });
  let b = ''; c.stdout.on('data', d => b += d); c.on('close', () => { try { res(JSON.parse(b)); } catch (e) { res({ key: k, error: b.slice(0, 300) }); } });
}));
Promise.all(kids).then(R => {
  const fail = [], yes = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); };
  const by = {}; for (const r of R) by[r.key] = r;
  for (const k in PLANES) if (!by[k] || by[k].error) fail.push(k + ': no result ' + (by[k] && by[k].error));
  if (fail.length) { for (const f of fail) console.log('  FAIL ' + f); console.log('GATE MUDFLY: FAIL (' + fail.length + ')'); process.exit(1); }
  const m = v => v == null ? '   -' : String(Math.round(v)).padStart(4);
  const x = (a, b) => a == null || b == null ? '    ' : ('x' + (a / b).toFixed(2));
  console.log('  THE CIRCUITS (the pilot, HOME 1100 m): take-off roll / landing roll (m), x grass, outcome');
  console.log('  ' + 'aeroplane'.padEnd(24) + 'grass         '.padEnd(22) + 'firm mud (11)'.padEnd(34) + 'soft mud (12)');
  for (const k in PLANES) { const r = by[k], g = r.grass, f = r.firm, s = r.soft;
    const cell = (c, base) => (m(c.toRoll) + ' ' + x(c.toRoll, base && base.toRoll) + ' /' + m(c.ldRoll) + ' ' + x(c.ldRoll, base && base.ldRoll) + ' ' + (c.outcome === 'completed' ? 'ok' : c.outcome)).padEnd(34);
    console.log('  ' + PLANES[k].name.padEnd(24) + (m(g.toRoll) + ' /' + m(g.ldRoll) + ' ' + (g.outcome === 'completed' ? 'ok' : g.outcome)).padEnd(22) + cell(f, g) + cell(s, g));
    if (SHOW) for (const c of [g, f, s]) console.log('      ' + (c.code == null ? 'grass' : c.code) + ': ' + c.phases + (c.why ? ' | ' + c.why : '') + ' | deepest ' + (c.maxSink * 100).toFixed(1) + ' cm');
  }
  console.log('  THE LIMITS (no pilot, full power from rest, stick neutral; soft mud\'s k x f): the run to 0.9 Vs (m), STUCK = not within 60 s / 1100 m');
  console.log('  ' + 'aeroplane'.padEnd(24) + FS.map(f => ('f ' + f).padStart(8)).join('') + '   stuck limit f*   at rest on soft mud (main, main, third)');
  for (const k in PLANES) { const r = by[k];
    console.log('  ' + PLANES[k].name.padEnd(24) + r.limits.map(L => (L.run == null ? (L.moved ? 'STUCK' : 'NOMOVE') : String(Math.round(L.run))).padStart(8)).join('') +
      ('   ' + (r.fStar ? '< ' + r.fStar.toFixed(2) + ' (stuck at ' + r.fStar + ')' : 'gets off at every f')).padEnd(32) + r.limits[0].rest.map(z => (z * 100).toFixed(1) + ' cm').join(', ')); }
  // A
  for (const k in PLANES) { const r = by[k], g = r.grass, f = r.firm, s = r.soft, nm = PLANES[k].name;
    yes(g.outcome === 'completed' && g.stopped, 'A ' + nm + ' completes its circuit on grass', g.outcome);
    yes(f.outcome === 'completed' && f.stopped, 'A ' + nm + ' completes its circuit on firm mud', f.outcome + (f.why ? ' (' + f.why + ')' : ''));
    if (g.toRoll && f.toRoll) yes(f.toRoll > g.toRoll * 0.99 && f.toRoll <= 1.6 * g.toRoll, 'A ' + nm + ': firm mud\'s take-off roll no shorter than grass\'s and within 1.6 x', x(f.toRoll, g.toRoll));
    yes((s.outcome === 'completed' && s.toRoll >= f.toRoll * 0.98) || (s.outcome === 'rejected-takeoff' && s.stopped && s.onStrip), 'A ' + nm + ': on soft mud it completes (no shorter than on firm) or its pilot rejects and stops on the strip', s.outcome + ' ' + m(s.toRoll));
    for (const c of [f, s]) if (c.outcome === 'completed') yes(c.onStrip, 'A ' + nm + ' stops on the strip after landing on ' + (c.code === 11 ? 'firm' : 'soft') + ' mud');
  }
  // B
  for (const k in PLANES) { const L = by[k].limits; let mono = true, prev = 0;
    for (const r of L) { if (r.run == null) break; if (r.run < prev * 0.98) mono = false; prev = r.run; }
    yes(mono, 'B ' + PLANES[k].name + ': the run lengthens as the mud softens', L.map(r => r.run == null ? 'x' : Math.round(r.run)).join(' '));
  }
  yes(by.c172.fStar >= by.cub.fStar && by.c172.fStar >= by.pc6.fStar, 'B the tricycle\'s nose wheel needs the stiffest mud (f*: C172 ' + by.c172.fStar + ', Cub ' + by.cub.fStar + ', PC-6 ' + by.pc6.fStar + ')');
  yes(by.cub.limits[0].run != null && by.pc6.limits[0].run != null, 'B the Cub and the PC-6 get off soft mud as built');
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  console.log('GATE MUDFLY: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
});
