#!/usr/bin/env node
// node_accept.js - NODE-ACCEPT (Pilot, 9 Nov; the design: flydiy-notes/NODE-ACCEPT-DESIGN-2026-11-09.md). The user (via
// A0, 8 Nov): "Couldn't we improve the node simulation so it tests at least taxi and capsizing? ... It's frustrating to
// have a session declare that the plane flies really well, try it, and it absolutely doesn't fly."
//
// ONE CARD, THE GAME'S START, THE LEGS THE PLAYER FLIES, STOPPED ON THE FIRST THING THAT WOULD MAKE THE USER SAY "IT
// DOESN'T FLY": the load door's spec (tools/_load_build.js gameSpec through _tour_lib defOf, damage ON), the worker's own
// host (_tour_lib gameHost: the walked stand out of the player's shed, the page's placement and pilot at Expert), the
// Jolene world with its solid things (_tour_lib tourWorld), a fixed day whose wind the leg names. The detectors
// (tools/_accept_detect.js: noseOver, capsize, propStrike, gearAtTouch, groundLoop, tailStrike, yield, stuck) end a leg
// on the first verdict.
//
//   node tools/node_accept.js --card cub [--legs taxi,circuit] [--winds W0,W8,W15] [--json out.json]
//   node tools/node_accept.js --selftest       the detectors on REAL sims (forced cases, ~1 min; a box run)
//   cards: the load door's validated keys (cub, jodel, metal, floats, twinFloats, petrel) or a build file
//
// THE LEGS (this first cut: the AP at Expert; the scripted player, fastTaxi and the water legs come next - design 5):
//   taxi     the stand to the line-up, the route's own taxi: ends PASS at the first LINEUP / ROLL
//   circuit  HOME to w2 (the field's other runway, 02/20): line-up, take-off, the circuit, the landing, the roll-out to
//            the stop - _tour_lib flyLeg. A take-off the pilot DECLINES in that wind is a pass, said (the AP is right
//            to refuse what it cannot fly)
// THE WINDS: W0 calm; W8 8 kt from 30 deg off HOME's axis; W15 15 kt from 45 deg off (a 10.6 kt crosswind) - a legacy
// day wind (09_climate: { base: [wx, 0, wz] }, the world vector exactly), the day's clock ticking as the game's does.
//
// THE LINE (design 3.6 - the only words a session may use to say a card flies):
//   NODE-ACCEPT <card> @<sha>: PASS  ap 4/4 (taxi W0, circuit W0 W8 W15[declined: why])
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const AD = require(path.join(T, '_accept_detect.js'));
const KT = 0.514444, D2R = Math.PI / 180;
const r1 = v => Math.round(v * 10) / 10;
const sha = () => { try { return cp.execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { return '?'; } };

function cardKey(c) {
  const V = require(path.join(T, '_load_build.js')).VALIDATED;
  if (V[c]) return { key: path.join(ROOT, V[c].build), label: V[c].label, id: c };
  return { key: path.resolve(c), label: path.basename(c), id: path.basename(c, '.json') };
}
// the wind: `kts` from `off` deg off the strip's axis (the side the pilot meets it on is its own business)
function dayWith(TR, C, strip, w) {
  const day = TR.gameDay(C);
  if (!w || !w.kts) { day.wind = null; return day; }
  const from = strip.hdg + w.off * D2R, V = w.kts * KT;   // FROM that bearing (world frame): it blows the other way
  day.wind = { base: [-Math.cos(from) * V, 0, -Math.sin(from) * V], gust: w.gust || 0, refH: 10 };
  return day;
}
const WINDS = { W0: null, W8: { kts: 8, off: 30 }, W15: { kts: 15, off: 45 } };

function setup() {
  const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
  const C = require(path.join(T, 'flight_core.js')), IN = require(path.join(T, 'island_node.js')), TR = require(path.join(T, '_tour_lib.js'));
  const TW = TR.tourWorld(C, IN, fs);
  return { PT, C, TR, W: TW.W };
}

// one leg; returns { leg, wind, pilot, ok, verdict, declined, t, warnings, note }
function runLeg(S, card, def, legName, windK) {
  const { C, TR, W } = S;
  const A = W.aerodromes.find(a => a.id === 'HOME'), B = W.aerodromes.find(a => a.id === 'w2');
  const day = dayWith(TR, C, A, WINDS[windK]);
  const H = TR.gameHost(C, W, def, A, B, { day });
  const dets = AD.make({ W, def }), name = legName + ':' + windK;
  const R = { card: card.id, leg: legName, wind: windK, pilot: 'ap', ok: false, verdict: null, declined: null, t: 0, warnings: [] };
  if (legName === 'circuit') {
    const L = TR.flyLeg(C, W, H.sim, def, A, B, { host: H, first: true, detectors: dets, legName: name, tMax: 900 });
    R.t = r1(L.t); R.verdict = L.verdict || null; R.warnings = (L.detWarnings || []).concat(L.warnings || []);
    R.declined = L.faults.length && L.faults.every(f => f.k === 'declined') ? L.faults[0].note : null;
    R.ok = !R.verdict && (L.ok || !!R.declined);
    if (!R.ok && !R.verdict) R.note = L.faults.map(f => f.k + (f.note ? ' (' + f.note + ')' : '')).join('; ') || 'did not stop at ' + B.id;
    R.landing = L.arr && L.arr.landing ? { sink: L.arr.landing.sink, onStrip: L.arr.landing.onStrip } : null;
    return R;
  }
  if (legName === 'taxi') {
    // the leg's own loop: the host's 'start' (placed on the walked stand, departing), stepped to the line-up
    H.queueCmd({ cmd: 'start' });
    const sim = H.sim, D0 = sim.damage ? JSON.parse(JSON.stringify(sim.damage())) : null;
    const base = { pitch0: sim.out && Number.isFinite(sim.out.pitch) ? sim.out.pitch : 0, D0,
      gear: (def.parts && def.parts.hull) ? 'hull' : (def.parts && def.parts.floats) ? 'float' : (def.spec && def.spec.gear && def.spec.gear.type === 'taildragger') ? 'tail' : 'tri' };
    const dt = 1 / 60;
    for (let k = 0; k < 600 / dt; k++) {
      H.step(); R.t += dt;
      const ap = H.ap, cg = sim.cgPos();
      if (!isFinite(cg[0])) { R.verdict = { verdict: 'nan', t: r1(R.t), what: 'the solver went NaN' }; break; }
      const wH = typeof W.waterH === 'function' ? W.waterH(cg[0], cg[2]) : -Infinity;
      const ctx = { sim, ap, t: R.t, legName: name, surface: Number.isFinite(wH) && wH > W.terrainH(cg[0], cg[2]) ? 'water' : 'land', base };
      let hit = null, by = null; for (const d of dets) { hit = d.onFrame(ctx); if (hit) { by = d.name; break; } }
      if (hit) { R.verdict = Object.assign({ by, phase: ap.phase }, hit); break; }
      if (ap.phase === 'LINEUP' || ap.phase === 'ROLL') { R.ok = true; R.note = 'at ' + ap.phase; break; }
      if (ap.phase === 'STOPPED' && ap.report && ap.report.outcome === 'declined') { R.ok = true; R.declined = 'declined at the hold'; break; }
    }
    R.t = r1(R.t);
    if (!R.ok && !R.verdict) R.note = 'never reached the line-up in 600 s';
    R.warnings = [].concat(...dets.map(d => (d.warnings || []).map(w => d.name + ': ' + w.what + ' at ' + w.t + ' s')));
    return R;
  }
  throw new Error('no such leg: ' + legName);
}
const fmt = R => '  ' + (R.ok ? (R.declined ? 'DECL' : 'ok  ') : 'FAIL') + ' ' + (R.leg + ' ' + R.wind).padEnd(14) + String(R.t).padStart(6) + ' s  ' +
  (R.verdict ? R.verdict.verdict + ' at ' + R.verdict.t + ' s: ' + R.verdict.what : R.declined ? 'declined: ' + R.declined : R.note || '') +
  (R.landing && R.landing.sink != null ? ' | sink ' + r1(R.landing.sink) + ' m/s' : '') + (R.warnings.length ? ' | warn: ' + R.warnings.slice(0, 3).join('; ') : '');

// ---- THE REAL-SIM SELFTEST (design 3.3): each detector on a real sim, a forced case - and quiet on a clean one ----
// noseOver: Deform's gate roll() - settled 240 frames, V added along the heading to every node, then thr 0, brake 1,
// de 0, held to |V| < 0.05 m/s: the user's repro (9 Nov). On master today it reads noseOver-undamaged (the prop strikes
// and the integrity says intact); with Deform's NOSE-STRIKE, noseOver.
function selftest() {
  const L = require(path.join(T, '_treecrash_lib.js')), C = L.core();
  let fails = 0;
  const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
  const rest = (key, frames, place) => {
    const def = L.defOf(key, {}), { W, strip } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
    sim.ctl.thr = 0; for (let f = 0; f < (frames || 240); f++) sim.step(1 / 60);
    return { def, W, sim };
  };
  const drive = (R, secs, ctl, leg) => {
    const { def, W, sim } = R, dets = AD.make({ W, def }), ap = { phase: 'ROLLOUT' };
    const base = { pitch0: 0, D0: JSON.parse(JSON.stringify(sim.damage())), gear: def.spec && def.spec.gear && def.spec.gear.type === 'tricycle' ? 'tri' : 'tail' };
    if (def.parts && def.parts.hull) base.gear = 'hull';
    for (let k = 0, t = 0; k < secs * 60; k++, t += 1 / 60) {
      if (ctl) ctl(sim, t);
      sim.step(1 / 60);
      const ctx = { sim, ap, t, legName: leg || 'selftest', surface: 'land', base };
      for (const d of dets) { const v = d.onFrame(ctx); if (v) return Object.assign({ by: d.name }, v); }
      const v = sim.cgVel(); if (t > 1 && Math.hypot(v[0], v[1], v[2]) < 0.05 && !ctl.keep) break;
    }
    return null;
  };
  const roll = V => (sim, t) => {
    if (t === 0) { const xA = sim.axes()[0], nh = [-xA[0], 0, -xA[2]], nl = Math.hypot(nh[0], nh[2]);
      for (let i = 0; i < sim.n; i++) { sim.v[i * 3] += V * nh[0] / nl; sim.v[i * 3 + 2] += V * nh[2] / nl; } }
    sim.ctl.thr = 0; sim.ctl.brake = 1; sim.ctl.de = 0;
  };
  console.log('noseOver (Deform\'s roll(): the user\'s full brake held to the stop)');
  for (const key of ['cub']) for (const V of [12, 18]) {
    const v = drive(rest(key), 12, roll(V));
    check(!!v && /^noseOver/.test(v.verdict), key + ' from ' + V + ' m/s, full brake: ' + (v ? v.verdict + ' (' + v.what + ')' : 'NOTHING'));
  }
  console.log('quiet on a clean case');
  for (const key of ['cub', 'jodel', 'metal', 'petrel']) {
    const quiet = Object.assign(() => {}, { keep: true });
    const R = rest(key), G = R.sim.gear ? R.sim.gear() : null, v = drive(R, 10, quiet, 'rest');
    check(v === null, key + ' at rest 10 s: nothing' + (G ? ' (gear pos ' + G.pos.toFixed(2) + ')' : '') + (v ? ' - got ' + v.verdict + ' (' + v.what + ')' : ''));
  }
  {
    const R = rest('cub'), slow = roll(4);
    const v = drive(R, 12, (sim, t) => { slow(sim, t); sim.ctl.brake = 0.3; sim.ctl.de = -0.6; });
    check(v === null, 'cub from 4 m/s, a light brake, the stick back: nothing' + (v ? ' - got ' + v.verdict + ' (' + v.what + ')' : ''));
  }
  console.log(fails ? 'NODE-ACCEPT SELFTEST: FAIL (' + fails + ')' : 'NODE-ACCEPT SELFTEST: PASS');
  return fails;
}

if (require.main === module) {
  if (argv.includes('--selftest')) process.exit(selftest() ? 1 : 0);
  const card = cardKey(opt('card', 'cub'));
  const legs = opt('legs', 'taxi,circuit').split(','), winds = opt('winds', 'W0,W8,W15').split(',');
  const S = setup(), def = S.TR.defOf(S.C, S.PT, card.key), t0 = Date.now(), at = sha();
  console.log('NODE-ACCEPT ' + card.id + ' (' + card.label + ') @' + at + ': mass ' + r1(def.params && def.params.gen ? def.params.gen.mass || 0 : 0) + ', legs ' + legs.join(',') + ', winds ' + winds.join(','));
  const out = [];
  for (const lg of legs) for (const w of (lg === 'taxi' ? ['W0'] : winds)) {
    const R = runLeg(S, card, def, lg, w); out.push(R); console.log(fmt(R));
  }
  const n = out.length, ok = out.filter(r => r.ok).length;
  const words = out.map(r => r.leg + ' ' + r.wind + (r.declined ? '[declined: ' + r.declined + ']' : r.ok ? '' : '[' + (r.verdict ? r.verdict.verdict : 'fail') + ']')).join(', ');
  console.log('NODE-ACCEPT ' + card.id + ' @' + at + ': ' + (ok === n ? 'PASS' : 'FAIL') + '  ap ' + ok + '/' + n + ' (' + words + ')  ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall');
  const j = opt('json', null); if (j) fs.writeFileSync(j, JSON.stringify({ card: card.id, sha: at, legs: out }, null, 1));
  process.exit(ok === n ? 0 : 1);
}
module.exports = { runLeg, WINDS, dayWith, cardKey };
