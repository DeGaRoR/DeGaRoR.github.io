#!/usr/bin/env node
// GATE LINEUP (G771) — SKIP THE TAXI, AND ARRIVE WHERE THE TAXI WOULD HAVE.
//
// The user (2026-09-27): "button to skip the taxi phase and straight to starting line". The flight
// screen's `Skip to line-up` asks the pilot where its taxi would end (43_pilot ap.lineupPose: the route
// planDeparture plans from the stand, its hold), puts the aeroplane there (40_autopilot placeAtLineup:
// the one transform, then onto the solver's own ground) and hands the pilot the hold (departFrom
// { atHold }). This gate holds that to being the TAXI'S END STATE and not a teleport:
//
//   node tools/_lineup_check.js            -> "GATE LINEUP: PASS|FAIL"
//   node tools/_lineup_check.js --show     -> the per-aerodrome lines
//   node tools/_lineup_check.js --selftest -> negative verification
//
// A. EVERY AERODROME (the analytic world's land strips, then Jolene's), the default build (the Cub
//    archetype, joined as the game flies it - G770): the pose is on the centreline (< 1 m) and along
//    the strip (< 0.5 deg); placed, the lowest wheel is 1 cm over the ground the tyres meet
//    (world.terrainH, not a record's elev) and nothing is under it; the pilot goes DEPART -> STOP|HOLD
//    (no TAXI, no LINEUP turn, no replan) and ROLL begins inside 8 s, lined up (< 2.5 m, < 6 deg); on the wheels, the
//    gear at rest - the CG's height over the ground within 6 cm of the same aeroplane settled on its stand
//    (or spawn), no bounce (|vy| < 0.35 m/s after the first second).
// B. THE TAKE-OFF ROLL COMPLETES from the skip, at Jolene's HOME, for the default build and the user's
//    aluminium C172 (bugReports/cessnaMetal (1).json, copied as tools/fixtures/build_v10_cessnaMetal_
//    2026-09-26.json): airborne past hSafe inside 90 s, lift-off inside the strip and 4 m of the
//    centreline, no rejected take-off.
// C. THE SAME STATE THE TAXI REACHES: the default build taxied from Jolene's stand the whole way - the
//    skip's ROLL begins inside HOLD's own gate of where the taxi's ROLL began (< 3 m, < 6 deg). And the
//    way it went (G772): calm air takes 31 by the taxiway V's right arm (taxiOut1), the flown wing
//    clear of the parked aircraft and the fence on the apron by 3 m, stand to roll inside 190 s.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const BJ = require(path.join(T, '_bake_joined.js'));

const SHOW = process.argv.includes('--show');
const SELF = process.argv.includes('--selftest');
const METAL = path.join(T, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json');

let fail = [];
const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };
const log = s => { if (SHOW) console.log('  ' + s); };

// the runway frame of a record: along its hdg from its centre, and across
const rwy = a => { const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
  return { ux, uz, al: (x, z) => (x - a.x) * ux + (z - a.z) * uz, cr: (x, z) => -(x - a.x) * uz + (z - a.z) * ux }; };
const noseHdg = sim => { const [xA] = sim.axes(); return Math.atan2(-xA[2], -xA[0]); };
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const cgOverGround = (sim, W) => { const c = sim.cgPos(); return c[1] - W.terrainH(c[0], c[2]); };
const wheelGap = (sim, def, W) => {
  const ids = def.refs.mains.concat(def.refs.tw != null && def.refs.tw >= 0 ? [def.refs.tw] : []);
  let lo = Infinity, all = Infinity;
  for (const i of ids) lo = Math.min(lo, sim.p[i * 3 + 1] - sim.r[i] - W.terrainH(sim.p[i * 3], sim.p[i * 3 + 2]));
  for (let i = 0; i < sim.n; i++) all = Math.min(all, sim.p[i * 3 + 1] - sim.r[i] - W.terrainH(sim.p[i * 3], sim.p[i * 3 + 2]));
  return { lo, all };
};

// where the departure begins in the game: the site's stand (taxi out), else the spawn identity
function startPose(sim, a, site) {
  sim.reset(0); if (sim.stance) sim.stance();
  if (site && site.stand) C.placeAtStand(sim, a, site.stand); else C.placeAtAerodrome(sim, a);
}
// the pose the pilot's taxi would end on, asked from the start pose (as app.js asks it)
function poseFor(def, W, a, site) {
  const sim = C.makeSim(def, W);
  startPose(sim, a, site);
  const ap = C.makePilot(sim, def, W, {});
  ap.setRoute(a, a); ap.departFrom(a, a, site);
  // the rest height the aeroplane settles to where it starts - what the gear must read at the hold too
  for (let i = 0; i < 180; i++) { sim.ctl.brake = 1; sim.step(1 / 60); }
  return { pose: ap.lineupPose(), restH: cgOverGround(sim, W), sim };
}
// skip: a fresh reset onto the pose, a fresh pilot on the hold; `doctor` bends the placement (selftest)
function skipTo(def, W, a, site, pose, doctor) {
  const sim = C.makeSim(def, W);
  sim.reset(0); if (sim.stance) sim.stance();
  C.placeAtLineup(sim, a, pose, W, def.refs);
  if (doctor) doctor(sim);
  const ap = C.makePilot(sim, def, W, {});
  ap.setRoute(a, a); ap.departFrom(a, a, site, { atHold: pose });
  return { sim, ap };
}

// A. one aerodrome: the pose, the placement, the hold, the roll's first frame
function oneStrip(def, W, a, tag, doctor) {
  const site = C.siteOf(a.id);
  const P = poseFor(def, W, a, site), pose = P.pose, R = rwy(a);
  const half = (a.wid || 30) / 2;
  const cr = R.cr(pose.x, pose.z), dH = Math.abs(Math.abs(wrap(pose.hdg - a.hdg)) - (Math.abs(wrap(pose.hdg - a.hdg)) > Math.PI / 2 ? Math.PI : 0));
  check(pose.how === 'lined' ? Math.abs(cr) < half - 1 : Math.abs(cr) < 1.0, tag + 'the line-up is on the centreline', cr.toFixed(2) + ' m (' + pose.how + ')');
  check(dH < 0.5 / 57.3, tag + 'the line-up heading runs along the strip', (dH * 57.3).toFixed(2) + ' deg');
  check(Math.abs(R.al(pose.x, pose.z)) < a.len / 2, tag + 'the line-up is inside the strip\'s length');
  const S = skipTo(def, W, a, site, pose, doctor), sim = S.sim, ap = S.ap;
  const g0 = wheelGap(sim, def, W);
  check(g0.all > 0.004 && g0.lo < 0.02, tag + 'placed on the strip\'s true surface (lowest wheel 1 cm over terrainH, nothing under it)',
        'wheel ' + g0.lo.toFixed(3) + ' m, any node ' + g0.all.toFixed(3) + ' m');
  const phases = [];
  let roll = null, maxVy = 0, onRoll = 0, hRoll = null;
  for (let s = 0; s < 8 * 60 && !roll; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (!phases.length || phases[phases.length - 1] !== ap.phase) phases.push(ap.phase);
    const v = sim.cgVel();
    if (s > 60) maxVy = Math.max(maxVy, Math.abs(v[1]));
    if (ap.phase === 'ROLL') {
      const c = sim.cgPos();
      roll = { t: s / 60, cr: R.cr(c[0], c[2]), e: Math.abs(wrap(noseHdg(sim) - pose.hdg)), x: c[0], z: c[2] };
      onRoll = sim.wheelsOnGround(); hRoll = cgOverGround(sim, W);
    }
  }
  // straight to the hold: DEPART hands over to STOP / HOLD and HOLD to ROLL - no taxi, no line-up turn, no replan
  check(phases.every(p => ['DEPART', 'STOP', 'HOLD', 'ROLL'].includes(p)), tag + 'straight onto the hold (no taxi, no line-up, no replan)', phases.join('>'));
  check(!!roll, tag + 'the take-off roll begins inside 8 s of the skip (STOP|HOLD -> ROLL)', phases.join('>'));
  if (roll) {
    check(Math.abs(roll.cr) < 2.5 && roll.e < 6 / 57.3, tag + 'the roll begins lined up (< 2.5 m, < 6 deg)',
          roll.cr.toFixed(2) + ' m, ' + (roll.e * 57.3).toFixed(1) + ' deg');
    check(onRoll >= 2, tag + 'on its wheels when the roll begins', onRoll + ' contacts');
    check(Math.abs(hRoll - P.restH) < 0.06, tag + 'the gear at rest height (the CG over the ground as on its stand)',
          (hRoll - P.restH >= 0 ? '+' : '') + ((hRoll - P.restH) * 100).toFixed(1) + ' cm');
  }
  check(maxVy < 0.35, tag + 'no drop and no bounce after the first second', maxVy.toFixed(2) + ' m/s');
  log(tag + pose.how + ' (' + pose.x.toFixed(1) + ', ' + pose.z.toFixed(1) + ') hdg ' + (pose.hdg * 57.3).toFixed(1) +
      ' | ' + phases.join('>') + (roll ? ' @' + roll.t.toFixed(1) + ' s, ' + roll.cr.toFixed(2) + ' m' : '') +
      ' | wheel ' + g0.lo.toFixed(3) + ' | rest ' + (hRoll != null ? ((hRoll - P.restH) * 100).toFixed(1) + ' cm' : '-'));
  return { pose, S, roll };
}

// B. the roll to the climb, from a skip already begun
function toClimb(def, S, a, tag) {
  const { sim, ap } = S, R = rwy(a);
  let lift = null, t = 0;
  for (let s = 0; s < 90 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60); t = s / 60;
    if (!lift && ap.phase === 'LIFTOFF') { const c = sim.cgPos(); lift = { al: R.al(c[0], c[2]), cr: R.cr(c[0], c[2]), t }; }
    if ((ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB') && (ap.dbg.agl || 0) > (def.params.ap.hSafe || 8)) break;
    if (ap.phase === 'STOPPED' || ap.phase === 'ABORT') break;
  }
  const rej = ap.report.verdicts.filter(v => /rejected|taxi-lost|replan/.test(v.code)).map(v => v.code);
  check(!!lift && (ap.phase === 'CLIMB' || ap.phase === 'LIFTOFF') && t < 90, tag + 'airborne past hSafe inside 90 s of the skip', ap.phase + ' at ' + t.toFixed(0) + ' s');
  check(!!lift && Math.abs(lift.al) < a.len / 2 && Math.abs(lift.cr) < 4, tag + 'lift-off on the strip, inside 4 m of the centreline',
        lift ? lift.cr.toFixed(2) + ' m across, ' + (a.len / 2 - Math.abs(lift.al)).toFixed(0) + ' m of strip left' : 'no lift-off');
  check(!rej.length, tag + 'no rejected take-off, no replan', rej.join(','));
  log(tag + 'airborne ' + t.toFixed(1) + ' s, lift-off ' + (lift ? lift.cr.toFixed(2) + ' m across at ' + lift.t.toFixed(1) + ' s' : '-'));
}

// C. the whole taxi, to the roll's first frame (the comparison the skip is held to) - and, G772, the way it
// went: the route's ids and the flown track's least wingtip clearance to what stands on the apron
function taxiRoll(def, W, a, fix) {
  const site = C.siteOf(a.id);
  const sim = C.makeSim(def, W);
  startPose(sim, a, site);
  const ap = C.makePilot(sim, def, W, {});
  ap.setRoute(a, a); ap.departFrom(a, a, site);
  const span = spanOf(def);
  let ids = null, clr = { c: Infinity, what: '-' }, s0 = null, run = 0;
  for (let s = 0; s < 420 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (!ids && ap.path) ids = ap.path.ids || null;
    const c = sim.cgPos();
    if (s0) run += Math.hypot(c[0] - s0[0], c[2] - s0[1]); s0 = [c[0], c[2]];
    if (fix && ap.phase === 'TAXI' && run < 150) for (const o of fix) for (const [p, q] of o.segs) {
      const k = segDist([c[0], c[2]], p, q) - span / 2; if (k < clr.c) clr = { c: k, what: o.id };
    }
    if (ap.phase === 'ROLL') return { x: c[0], z: c[2], hdg: noseHdg(sim), t: s / 60, ids, clr, span, why: ap.dirWhy };
    if (ap.phase === 'STOPPED') break;
  }
  return null;
}
// the wing's reach: the widest node pair across the aeroplane, built (a disc of it swept round the CG)
function spanOf(def) { let lo = Infinity, hi = -Infinity; for (const n of def.nodes) { lo = Math.min(lo, n.p[2]); hi = Math.max(hi, n.p[2]); } return hi - lo; }
const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
// what stands on Jolene's club apron, off the record: the parked aircraft (fuselage + wing lines, the
// archetype's span and length) and the fence's runs - tools/apron_map.js draws the same
function apronFix(F) {
  const ARCH = { 'arch:cub': { span: 10.7, len: 6.8 }, 'arch:c172': { span: 11.0, len: 8.3 }, 'arch:jodel': { span: 8.2, len: 6.4 } };
  const out = F.layers.objects.filter(o => o.kind === 'aircraft').map(o => {
    const A = ARCH[o.key] || { span: 10, len: 7 }, nx = -Math.sin(o.yaw), nz = Math.cos(o.yaw);
    const nose = [o.x + nx * A.len * 0.45, o.z + nz * A.len * 0.45], tail = [o.x - nx * A.len * 0.55, o.z - nz * A.len * 0.55];
    const wc = [nose[0] - nx * 0.3 * A.len, nose[1] - nz * 0.3 * A.len];
    return { id: o.id, segs: [[nose, tail], [[wc[0] - nz * A.span / 2, wc[1] + nx * A.span / 2], [wc[0] + nz * A.span / 2, wc[1] - nx * A.span / 2]]] };
  });
  const club = F.layers.sites.find(x => x.id === 's_club');
  for (const [i, f] of ((club && club.fences) || []).entries()) out.push({ id: 'fence' + i, segs: [[f.a, f.b]] });
  return out;
}

const landStrips = W => W.aerodromes.filter(a => !a.water && a.kind !== 'water' && (a.spawn || C.siteOf(a.id)));

BJ.loadPanel();
const cub = BJ.bakeCard('cub');
if (cub.errors && cub.errors.length) console.log('  (the cub\'s join: ' + cub.errors.join('; ') + ')');
const defCub = C.buildGen(cub.spec);

if (!SELF) {
  const t0 = Date.now();
  // A, the analytic world then Jolene (each world in turn, so a site lookup reads that world's registry)
  const A = C.makeWorld();
  for (const a of landStrips(A)) oneStrip(defCub, A, a, 'analytic ' + a.id + ': ');
  const J = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
  let homeCub = null;
  for (const a of landStrips(J)) { const r = oneStrip(defCub, J, a, 'jolene ' + a.id + ': '); if (a.id === 'HOME') homeCub = r; }
  const home = J.aerodromes.find(a => a.id === 'HOME');
  // B
  if (homeCub && homeCub.roll) toClimb(defCub, homeCub.S, home, 'jolene HOME cub (default): ');
  const defMetal = C.buildGen(C.genMigrateSpec(JSON.parse(fs.readFileSync(METAL, 'utf8')).spec));
  const m = oneStrip(defMetal, J, home, 'jolene HOME cessnaMetal: ');
  if (m.roll) toClimb(defMetal, m.S, home, 'jolene HOME cessnaMetal: ');
  // C
  const JF = JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8'));
  const tx = taxiRoll(defCub, J, home, apronFix(JF));
  check(!!tx, 'jolene HOME cub: the taxi from the stand reaches its roll');
  if (tx) {
    // G772: THE WAY OUT IS THE PAINT'S. In calm air the take-off is 31 (the shorter way out, 0.9 km against
    // 1.7), and 31's way out is the V's right arm (taxiOut1: the ty nodes) - not the left arm and 750 m of
    // backtrack on the runway; on the apron the wing clears the parked aircraft and the fence (the old first
    // leg put it 1.1 m from the parked Cub o1)
    check(!!tx.ids && tx.ids.includes('ty0') && tx.ids[tx.ids.length - 1] === 'hold1', 'jolene HOME cub: calm air leaves by the V\'s right arm for 31 (G772)',
          (tx.ids || []).join('>') + ' | ' + (tx.why || ''));
    check(tx.clr.c > 3.0, 'jolene HOME cub: the flown wing clears what stands on the apron by 3 m (G772; the ICAO apron figure for a code-A wing)',
          tx.clr.c.toFixed(2) + ' m to ' + tx.clr.what + ' (span ' + tx.span.toFixed(1) + ' m)');
    check(tx.t < 190, 'jolene HOME cub: stand to roll inside 190 s (208 s up the left arm before G772)', tx.t.toFixed(0) + ' s');
    log('jolene HOME cub: ' + (tx.ids || []).join('>') + ' | ' + (tx.why || '') + ' | wing ' + tx.clr.c.toFixed(2) + ' m from ' + tx.clr.what);
  }
  if (tx && homeCub && homeCub.roll) {
    const d = Math.hypot(tx.x - homeCub.roll.x, tx.z - homeCub.roll.z), e = Math.abs(wrap(tx.hdg - homeCub.pose.hdg));
    // the taxi hands over anywhere inside HOLD's own gate (2.5 m, 6 deg; measured 0.3 m, 2.3 deg), the skip
    // on the gate's centre: the bound is that gate, plus the half-metre the roll's first frame travels
    check(d < 3 && e < 6 / 57.3, 'jolene HOME cub: the skip\'s roll begins where the taxi\'s did (inside HOLD\'s gate: < 3 m, < 6 deg)',
          d.toFixed(2) + ' m, ' + (e * 57.3).toFixed(2) + ' deg');
    log('jolene HOME cub: the taxi reached its roll after ' + tx.t.toFixed(0) + ' s of taxiing; the skip ' + d.toFixed(2) + ' m / ' + (e * 57.3).toFixed(2) + ' deg from it');
  }
  log('wall ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
} else {
  // NEGATIVE VERIFICATION: each doctored skip must turn its own check red
  const J = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
  const home = J.aerodromes.find(a => a.id === 'HOME');
  const cases = [
    ['a metre in the air', s => { for (let i = 0; i < s.n; i++) s.p[i * 3 + 1] += 1.0; }, /true surface|bounce|rest height/],
    ['30 cm into the ground', s => { for (let i = 0; i < s.n; i++) s.p[i * 3 + 1] -= 0.3; }, /true surface/],
    ['turned 20 degrees', s => { const c = s.cgPos(), k = 20 / 57.3, cs = Math.cos(k), sn = Math.sin(k);
      for (let i = 0; i < s.n; i++) { const x = s.p[i * 3] - c[0], z = s.p[i * 3 + 2] - c[2]; s.p[i * 3] = c[0] + x * cs - z * sn; s.p[i * 3 + 2] = c[2] + x * sn + z * cs; } }, /straight onto the hold|lined up|inside 8 s/],
  ];
  let ok = true;
  for (const [name, doc, want] of cases) {
    fail = [];
    oneStrip(defCub, J, home, 'selftest (' + name + '): ', doc);
    const hit = fail.some(f => want.test(f));
    console.log('  selftest ' + name + ': ' + (hit ? 'caught' : 'MISSED') + (SHOW ? ' | ' + fail.join(' | ') : ''));
    if (!hit) ok = false;
  }
  fail = ok ? [] : ['a doctored skip passed'];
}

for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE LINEUP: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
