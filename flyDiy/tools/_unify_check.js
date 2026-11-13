#!/usr/bin/env node
// GATE UNIFY (PILOT-UNIFY, 13 Nov; the user, 12 Nov: "one coherent pilot ... the modes are not new modes, they are
// abilities the pilot TRIGGERS ITSELF from its own assessment ... declined into the pilots of the story, their skills
// decide who can do what"): THE ONE PILOT, ITS ABILITIES AND THEIR TRIGGERS.
//   TABLE     the five persons (PILOT_PROFILES; the story's Stig = the expert, Megan = bush, Brian = club, Remy = student,
//             Bryce = ham-fist, 72_people's bases): STOL-qualified and glider-rated as the table says (the expert and the
//             bush pilot: both; the club pilot, the student, the ham-fist: neither)
//   STRIP     the strip decides, flown the game's way (TOUR's gameHost: the game's day, the shakedown, the line-up skip):
//             HOME > tw_ski (Skyline Altiport, short) > HOME (long). The user's Cub (list:1) and the archetype cub, the
//             expert: G1936's short law at tw_ski (a no-device taildragger: the feel stop ground-looped both Cubs there on
//             the td_probe of 13 Nov, so it is no default), the normal landing at HOME; the bush pilot and the club pilot
//             the same short law, neither STOL nor feel - each on its To, NO GROUND LOOP (the strip-decides STOL technique ground-looped both Cubs there:
//             FIT-PROCEDURE 25a25817), no fault. The Cessna 172 (list:50 F-HCSN, a trike), the expert, HOME > tw_ski
//             (380 m: short for it, longer than its landing run - East Point's 150 m is declined, G2450): the strip-decides STOL technique, no ground loop, landed there or a clean divert - flown in TAIL (below), one job
//   TAIL      the tailwind judged at the gate (A0 13 Nov): list:50 HOME > tw_ski's one way in on the game's day - judged on the
//             final (appr.held), landed clean with the STOL plan, or refused before any flare and a clean divert
//   GLIDE     the glider rating decides: the motorglider, its motor off 280 m over Jolene, sent to Jolene - the expert
//             (rated) flies the glider's circuit to its To ('completed'); the club pilot (unrated) has an EMERGENCY
//             (said so, 'forced-landing') and lands on the field the glide reaches
//   EMERG     every person glides a powered aeroplane that loses its engine: the Cessna 172 (list:50) at 600 m, 2.6 km out
//             of Jolene for nv_strip - the expert and the student each land on the nearest field the glide reaches,
//             said as an emergency, nothing broken
//   ARCH      the Archaeopteryx card (builds/archaeopteryx_2026-11-10.json, when the tree has it - else said as owed):
//             the expert, motor off 360 m over Jolene, the glider's circuit, on the runway
// run_gates shards it (--shard=i/N); one row by hand: ONLY=<row id> node tools/_unify_check.js
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const DS = require(path.join(T, '_cage_design.js'));
const SHD = require(path.join(T, '_shard.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const go = id => SHD.take() && (!process.env.ONLY || process.env.ONLY === id);
let fails = 0;
const row = (id, ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + id.padEnd(7) + ' ' + msg); if (!ok) fails++; };
const f = (x, n = 1) => x == null ? '-' : (+x).toFixed(n);
const CUB = path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json');
const C172 = path.join(ROOT, 'builds', 'cessna172r_2026-11-08.json');
const ARCHF = path.join(ROOT, 'builds', 'archaeopteryx_2026-11-10.json');

// ---- TABLE (pure) ----
{
  const want = { expert: [true, true], bush: [true, true], club: [false, false], student: [false, false], hamfist: [false, false] };
  const story = { expert: 'Stig', bush: 'Megan', club: 'Brian', student: 'Remy', hamfist: 'Bryce' };
  for (const n of Object.keys(want)) {
    const P = C.pilotProfile(n), q = n === 'expert' ? [true, true] : [!!P.stol, !!P.glider];   // (the expert: no profile hook - qualified in all)
    row('TABLE', q[0] === want[n][0] && q[1] === want[n][1], story[n] + ' (' + n + '): STOL ' + (q[0] ? 'yes' : 'no') + ', glider ' + (q[1] ? 'yes' : 'no'));
  }
}

// ---- the game's flight with a person: the host captured to read its pilot's plan per leg ----
let HOST = null;
const mk0 = SH.makeSimHost;
SH.makeSimHost = function () { const H = mk0.apply(this, arguments); HOST = H; return H; };
const TW = TR.tourWorld(C, IN, fs), W = TW.W;
function tour(file, profile, order) {
  const def = TR.defOf(C, PT, file), legs = [];
  const R = TR.flyTour(C, W, def, order, { game: { profile, lineup: true }, roundOK: 'nv_strip', tMax: 1800, log: L => {
    const A = HOST && HOST.ap && HOST.ap.report && HOST.ap.report.appr;
    const Rp = HOST && HOST.ap && HOST.ap.report;
    legs.push({ L, appr: A ? { technique: A.technique, stol: !!A.stol, feel: !!A.feel, held: A.held || null } : null, phases: Rp ? (Rp.phases || []).slice() : [], verdicts: Rp ? (Rp.verdicts || []).slice() : [] });
  } });
  return { R, legs };
}
const legLine = x => x.L.from + '>' + x.L.to + ' on ' + x.L.landedOn + (x.appr ? ' [' + x.appr.technique + (x.appr.stol ? ', STOL' : '') + (x.appr.feel ? ', feel' : '') + ']' : '') +
  (x.L.faults.length ? ' FAULTS ' + x.L.faults.map(q => q.k).join(',') : '') + (x.L.groundLoop ? ' ground-loop' : '');
const clean = x => x.L.ok && x.L.landedOn === x.L.to && !x.L.groundLoop;

// ---- STRIP ----
// THE GROUND LOOP IS A FAIL (_tour_lib's rule: the nose over 30 deg off the strip's axis at over 5 m/s on the roll).
// FIT-PROCEDURE's evidence (claude/fit-procedure-strip-evidence 25a25817): the strip-decides STOL technique ground-looped
// the user's Cub (50.9 deg) and the archetype cub (89.9 deg) at tw_ski on the game's flight - and no other gate flies
// that leg. So the taildragger rows fly HOME > tw_ski (Skyline Altiport, short) and must land there; the Cessna 172
// (list:50, a trike) flies East Point (nv_strip), where a clean divert passes (the user: "if it can land it's good")
// [what, build, person, order, the plan asked per leg, must land on its To]
const STRIP = [
  ['the user\'s Cub, the expert (Stig)', CUB, undefined, ['HOME', 'tw_ski', 'HOME'], [{ technique: 'short', stol: false, feel: false }, { technique: 'normal', stol: false, feel: false }], true],
  ['the archetype cub, the expert', 'cub', undefined, ['HOME', 'tw_ski'], [{ technique: 'short', stol: false, feel: false }], true],
  ['the user\'s Cub, the bush pilot (Megan)', CUB, 'bush', ['HOME', 'tw_ski'], [{ technique: 'short', stol: false, feel: false }], true],
  ['the user\'s Cub, the club pilot (Brian)', CUB, 'club', ['HOME', 'tw_ski'], [{ technique: 'short', stol: false, feel: false }], true],
];
for (const [what, file, prof, order, want, mustLand] of STRIP) {
  if (!go('STRIP')) continue;
  let out;
  try { out = tour(file, prof, order); } catch (e) { row('STRIP', false, what + ': THREW ' + String(e.message).slice(0, 160)); continue; }
  // (a clean divert - declined / held off, no ground loop - passes a row that need not land on its To; its plan is judged)
  const fine = x => mustLand ? clean(x) : (!x.L.groundLoop && (clean(x) || x.L.declined || x.L.heldOff));
  const ok = out.legs.length === want.length && out.legs.every((x, i) => fine(x) && x.appr && x.appr.technique === want[i].technique && x.appr.stol === want[i].stol && x.appr.feel === want[i].feel);
  row('STRIP', ok, what + ': ' + out.legs.map(legLine).join(' | ') + ' (asked: ' + want.map(w => w.technique + (w.stol ? '+STOL' : '') + (w.feel ? '+feel' : '')).join(', ') + ')');
}

// ---- TAIL: the tailwind judged at the gate, not at the touch ----
// A0 13 Nov (TOW-LAUNCH, GATE ALTIPORT 4, found on the retired list:40 metal Cessna; flown here on THE Cessna, list:50 F-HCSN - the
// user: one Cessna): onto Skyline Altiport's one way
// in (uphill) on the game's day, 4.8 m/s behind, ~38 m/s over the ground onto 380 m - master ground-looped and broke up;
// with the slope fix and the re-bake it touched, rolled off the box, went round and only THEN refused. The final with wind
// behind it is judged before a flare (judgeHeld: appr.held on the record): landed clean on tw_ski, or 'strip-too-short'
// said with no FLARE before it there and a clean landing where it diverted (_tour_lib's 'declined'); never a ground loop
if (go('TAIL')) {
  {
    let out = null, err = null;
    try { out = tour(C172, undefined, ['HOME', 'tw_ski']); } catch (e) { err = String(e.message).slice(0, 160); }
    const x = out && out.legs[0];
    const ref = x && x.verdicts.find(v => v.code === 'strip-too-short');
    const flareBefore = x && x.phases.some(q => q.phase === 'FLARE' && (!ref || q.t < ref.t));
    const judged = !!(x && x.appr && x.appr.held);
    // (the strip decides: a trike, an expert, powered, 380 m - the short technique with its STOL parts, when it lands there)
    const plan = !!(x && x.appr && x.appr.technique === 'short' && x.appr.stol && !x.appr.feel);
    const ok = !!x && judged && !x.L.groundLoop && ((clean(x) && plan) || (!!x.L.declined && !!ref && !flareBefore));
    row('TAIL', ok, 'the Cessna 172 (list:50) HOME>tw_ski, the game day, the expert (asked: short+STOL, judged at the gate): ' + (err ? 'THREW ' + err : x ? legLine(x) + (x.L.declined ? ' DECLINED -> ' + x.L.declined : '') +
      ' | judged ' + (judged ? JSON.stringify(x.appr.held) : 'NO') + (ref ? ' | refused at t ' + ref.t + (flareBefore ? ' AFTER A FLARE' : ', no flare before') + ': ' + String(ref.note).slice(0, 160) : '') : 'NO LEG'));
  }
}

// ---- in the air (GATE GLIDE's way): settled at a's line-up, moved to (x, z) h m up, heading hdg at V ----
const AD = id => W.aerodromes.find(a => a.id === id);
function airborne(def, a, x, z, h, hdg, V, keyOff) {
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtLineup(sim, a, { x: a.x, z: a.z, hdg }, W, def.refs); for (let i = 0; i < 60; i++) sim.step(1 / 60);
  const P = Float64Array.from(sim.p), cg = sim.cgPos(), y = W.terrainH(x, z) + h;
  sim.reset(0);
  const fx = Math.cos(hdg), fz = Math.sin(hdg);
  for (let i = 0; i < sim.n; i++) {
    sim.p[i * 3] = P[i * 3] - cg[0] + x; sim.p[i * 3 + 1] = P[i * 3 + 1] - cg[1] + y; sim.p[i * 3 + 2] = P[i * 3 + 2] - cg[2] + z;
    sim.v[i * 3] = fx * V; sim.v[i * 3 + 1] = 0; sim.v[i * 3 + 2] = fz * V;
  }
  for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, keyOff ? { key: 'off' } : { key: 'both', running: true });
  return sim;
}
function fly(def, sim, from, to, T, profile, fail) {
  const ap = C.makePilot(sim, def, W, profile ? { profile } : undefined); ap.setRoute(from, to); ap.reEngage({ phase: 'CLIMB' });
  let bad = false;
  for (let fr = 0; fr < 60 * T; fr++) {
    if (fail && fr === fail.at * 60) fail.fn(sim);
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { bad = true; break; }
    if (ap.phase === 'STOPPED') break;
  }
  const said = (ap.report.verdicts || []).find(v => v.code === 'out-of-energy');
  return { ap, bad, G: ap.report.glider, L: ap.report.landing, out: ap.report.outcome, said: said ? String(said.msg || said.text || said.note || JSON.stringify(said)).slice(0, 140) : null, broken: sim.damage ? sim.damage().broken.length : 0 };
}
const onRwy = R => !R.bad && R.L && R.L.onStrip && Math.abs(R.L.offCentre) < 20 && R.L.stopLeft > 0 && R.broken === 0;
const glideLine = R => (R.G ? R.G.field + ' (' + R.G.side + '-hand)' : 'no circuit') + '; ' + (R.L ? (R.L.onStrip ? 'on the runway' : 'OFF it') + ' ' + f(Math.abs(R.L.offCentre)) + ' m off, sink ' + f(R.L.sink, 2) : 'NO LANDING') +
  ', ' + R.out + (R.said ? ' - "' + R.said + '"' : '') + (R.broken ? ', ' + R.broken + ' broken' : '');
const archDef = key => { const A = DS.ARCHETYPES.find(x => x.key === key); return C.buildGen(DS.designBake(A.sel, A.over)); };
const H = AD('HOME');

// ---- GLIDE: the rating decides ----
for (const [who, prof] of [['the expert (rated)', undefined], ['the club pilot (unrated)', 'club']]) {
  if (!go('GLIDE')) continue;
  const def = archDef('motorglider'), R = fly(def, airborne(def, H, H.x, H.z, 280, H.hdg, 27, true), H, H, 600, prof);
  const ok = onRwy(R) && (prof ? R.out === 'forced-landing' && !!R.said : R.out === 'completed' && !!R.G);
  row('GLIDE', ok, 'the motorglider, motor off 280 m over Jolene, sent to Jolene, ' + who + ': ' + glideLine(R));
}
// ---- EMERG: every person glides a powered aeroplane that loses its engine ----
{
  const To = AD('nv_strip'), hd = Math.atan2(To.z - H.z, To.x - H.x), sx = H.x + Math.cos(hd) * 2600, sz = H.z + Math.sin(hd) * 2600;
  for (const [who, prof] of [['the expert', undefined], ['the student', 'student']]) {
    if (!go('EMERG')) continue;
    const def = TR.defOf(C, PT, C172), sim = airborne(def, H, sx, sz, 600, hd, 50, false);
    const R = fly(def, sim, H, To, 700, prof, { at: 10, fn: s2 => { for (let i = 0; i < s2.eng.length; i++) s2.setEngine(i, { running: false }); } });
    row('EMERG', onRwy(R) && !!R.said && R.out === 'forced-landing', 'the Cessna 172 (list:50) 2.6 km out for ' + To.name + ', the engine stops at 600 m, ' + who + ': ' + glideLine(R));
  }
}
// ---- ARCH: the Archaeopteryx card ----
if (go('ARCH')) {
  if (!fs.existsSync(ARCHF)) console.log('owed   ARCH    builds/archaeopteryx_2026-11-10.json is not on this tree (its branch: claude/archaeopteryx-sailplane-study-q8tzz2)');
  else {
    const def = TR.defOf(C, PT, ARCHF), R = fly(def, airborne(def, H, H.x, H.z, 360, H.hdg, 25, true), H, H, 600);
    row('ARCH', onRwy(R) && R.out === 'completed' && !!R.G, 'the Archaeopteryx card, motor off 360 m over Jolene, the expert: ' + glideLine(R));
  }
}
console.log('GATE UNIFY: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
