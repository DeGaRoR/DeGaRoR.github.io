#!/usr/bin/env node
// GATE DESTTO (G1945-G1954 DEST-TO) — ONE "TO", AND THE FLIGHT GOES ON FROM WHERE IT IS.
//
// The user (2026-10-05): "I'm landing at an airport. I'd want the plane to take off from that very airport, to a new
// destination. I can't do that now, it will always reset the plane to the default starting location. It needs to
// start from where it is. Actually we could gradually drop the FROM-TO in favour of a simple 'To', which can be updated
// in flight or on the ground. The plane reacts like its autopilot's destination has been updated."
//
// 38b_dest.js is the model (the bases, flightWhere - the derived From -, flightLeg - the leg a To asks for from here -,
// the pref's migration); 43_pilot.js ap.setDest is the autopilot's destination moving; app.js setTo / nextLeg chain
// them on the page exactly as this gate does (flightLeg, then a fresh pilot's departFrom, or the flying pilot's
// setDest). Everything here flies the REAL sim and the REAL pilot on Jolene (the island the game plays), the
// validated builds only (the user's Cub builds/cub_2026-09-20_corrected.json, the Jodel, the metal Cessna, the Cessna
// floats, the twin on floats - tools/_treecrash_lib.js BUILDS), the damage model ON.
//
//   node tools/_destto_check.js                    -> "GATE DESTTO: PASS|FAIL"
//   node tools/_destto_check.js --show             -> the per-case lines
//   node tools/_destto_check.js --only ltd:cub,air:cub   a part of it
//   node tools/_destto_check.js --evidence         -> also the traces (reports/evidence/DEST-TO/*.csv, *.json)
//   node tools/_destto_check.js --selftest         -> negative verification (the old chain and a doctored re-plan go red)
//
// A. THE MODEL (no flight): the default base is HOME and a roll-out starts on its stand (the base, unchanged);
//    flightWhere reads the stand, a strip, a lane, the air; the To choices follow the strip-surface rule (a wheeled
//    build cannot pick a lane, floats cannot pick land); the v1 pref { from, dest } migrates to { v: 2, base, to } (a
//    `from` that is not a base falls back to the base); a re-departure planned from the stand by the derived From is
//    the default start's own plan (the same taxi route, the same take-off direction).
// B. LAND, THEN DEPART (ltd:<build>): a landing at a field, stopped; a To picked IN THE ROLL-OUT is queued (setDest
//    'queued', the runway it lands on untouched); at STOPPED the next leg is the page's: flightLeg from where it stands
//    (the From DERIVED) to the To, a fresh pilot on the same sim - no reset, no teleport (the leg's first step starts
//    where the last ended, the fuel and the damage state carried) - which goes from the landing stop to its take-off
//    (DEPART -> TAXI|STOP -> HOLD -> ROLL), takes off, flies there and lands (completed, stopped on its strip / lane).
//      metal Cessna   lined up at HOME, landed on Tamgas Hill's 520 m of gravel (w3), then To Jolene AFB 02/20 (w2):
//                     the From is w3 where it stands (not the leg's HOME), and the run ahead of the stop is short,
//                     so the next leg TAXIS (the backtrack / U-turn on the strip) before it rolls
//      Cub, Jodel     a circuit at HOME (lined up there), stopped on 13/31, then To w3
//    (Measured, the pilot's and the strip's, not the chain's - 43_pilot's laws are PILOT-ONE's, so no case asks them:
//    on master 55dd98b, the old chain from w3's stand, the user's Cub cannot line up at w3 - 'could not line up in 60
//    s' x 3, taxi-lost - and the Jodel rejects its take-off there - 'will not reach Vr: 1.45 m/s^2 ... 327 m left';
//    and an arrival at 13/31 from the south-west can fly a 280-390 s DOWNWIND, go around and run out of the
//    watchdog's budget, set once at departFrom: the Cub from w3, the metal Cessna after its w3 backtrack -
//    reports/evidence/DEST-TO/master_w3.txt and the HANDOVER entry.)
// C. A NEW TO IN THE AIR (air:<build>): lined up at HOME bound for w3; mid-way down the enroute leg the To becomes
//    Jolene AFB 02/20 (w2), behind the aeroplane - setDest 'replan', the arrival planned again from here: the new path
//    starts at the aeroplane, the bank never past the pilot's limit (+4 deg), the track never turning faster than
//    1.3 x what that bank turns it (no step), and it arrives (stopped on w2, completed). Cub and metal Cessna.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const L = require(path.join(T, '_treecrash_lib.js'));
const C = L.core();
const IN = require(path.join(T, 'island_node.js'));
const SH = require(path.join(T, '_shard.js'));

const argv = process.argv.slice(2);
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest'), EVID = argv.includes('--evidence');
const ONLY = (() => { const i = argv.indexOf('--only'); return i >= 0 ? argv[i + 1].split(',') : null; })();
const log = s => { if (SHOW) console.log('  ' + s); };
const EV_DIR = path.join(T, '..', 'reports', 'evidence', 'DEST-TO');

const jolene = () => IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const nose = sim => { const [xA] = sim.axes(); return Math.atan2(-xA[2], -xA[0]); };
const bankOf = sim => { const [, yU, zR] = sim.axes(); return Math.atan2(zR[1], yU[1]); };   // the right wing's height over the up axis
const finite = sim => { for (let i = 0; i < sim.p.length; i++) if (!Number.isFinite(sim.p[i])) return false; return true; };
const gearOf = (def, sim) => C.stripGear(def && def.spec && def.spec.gear ? def : sim);

// ---- the start: lined up where the taxi from the field's stand would end (GATE LINEUP's way), or on the lane ----------
function startAt(def, W, a) {
  const sim = C.makeSim(def, W);
  sim.reset(0); if (sim.stance) sim.stance();
  if (sim.hydro) { C.placeAtAerodrome(sim, a); return sim; }
  const site = C.siteOf(a.id);
  if (site && site.stand) {
    C.placeAtStand(sim, a, site.stand);
    C.seatOnGround(sim, (x, z) => W.terrainH(x, z), def.refs);
    const q = C.makePilot(sim, def, W, {});
    q.setRoute(a, a); q.departFrom(a, a, site);
    const pose = q.lineupPose();
    sim.reset(0); if (sim.stance) sim.stance();
    C.placeAtLineup(sim, a, pose, W, def.refs);
    sim.__pose = pose;
  } else C.placeAtAerodrome(sim, a);
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
  return sim;
}

// ---- one leg flown to its stop; `onStep(ap, sim, s)` may act (a To changed), the trace sampled at 1 Hz ---------------
function fly(sim, ap, W, maxS, onStep, trace, tag) {
  const phases = [];
  let last = null, s = 0, jump = 0, prev = sim.cgPos().slice();
  for (; s < maxS * 60; s++) {
    if (onStep) onStep(ap, sim, s);
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase !== last) { phases.push(ap.phase); last = ap.phase; }
    const c = sim.cgPos(), v = sim.cgVel();
    // continuity: no step moves the aeroplane further than it flies (a teleport would)
    jump = Math.max(jump, Math.hypot(c[0] - prev[0], c[2] - prev[2]) - Math.hypot(v[0], v[2]) / 60);
    prev = c.slice();
    if (trace && s % 60 === 0) trace.push([tag, +sim.t.toFixed(1), ap.phase, +c[0].toFixed(1), +c[2].toFixed(1), +c[1].toFixed(1),
      +(nose(sim) * 57.2958).toFixed(1), +(bankOf(sim) * 57.2958).toFixed(1), +Math.hypot(v[0], v[2]).toFixed(1),
      sim.fuel ? +(+sim.fuel.kg || 0).toFixed(2) : '', ap.route && ap.route.to ? ap.route.to.id : '']);
    if (!finite(sim)) break;
    if (ap.phase === 'STOPPED' && ap.t > 3) break;
    const o = ap.report && ap.report.outcome;
    if (o && o !== 'completed') break;
    if (sim.damage && sim.damage().crashed) break;
  }
  return { phases, t: s / 60, jump, outcome: ap.report && ap.report.outcome, verdicts: (ap.report && ap.report.verdicts) || [] };
}
const fuelKg = sim => sim.fuel ? +sim.fuel.kg || 0 : null;
const dmg = sim => (sim.damage ? sim.damage() : { crashed: false, members: 0, yields: 0 });

// ---- B. land, then depart ----------------------------------------------------------------------------------------------
function landThenDepart(key, check, trace, doctor, lead) {
  const W = jolene(), A = id => W.aerodromes.find(a => a.id === id);
  const def = L.defOf(key);                     // the damage model ON (_treecrash_lib: damage unless `elastic`)
  const wet = !!def.spec && C.stripGear(def) === 'floats';
  // `lead`: how leg 1 lands - 'xc' from Tamgas Hill to HOME (the From then differs from where it lands), 'circuit' at
  // HOME, 'short' from HOME onto Tamgas Hill (the From differs, and the next leg must taxi) - see the header
  // 'short' lands on Tamgas Hill's 520 m of gravel and picks HOME: the run ahead of the stop is not enough, so the next
  // leg TAXIS (the backtrack / U-turn on the strip) before it rolls
  const P = wet ? { a: 'SEA', land: 'SEA', b: 'mk_sea' } : lead === 'circuit' ? { a: 'HOME', land: 'HOME', b: 'w3' }
          : lead === 'short' ? { a: 'HOME', land: 'w3', b: 'w2' } : { a: 'w3', land: 'HOME', b: 'w3' };
  const tag = 'ltd:' + key + ': ';
  const sim = startAt(def, W, A(P.a));
  const gear = gearOf(def, sim);
  check(gear === (wet ? 'floats' : 'wheels'), tag + 'the gear is ' + (wet ? 'floats' : 'wheels'), gear);
  // leg 1: to the field it lands at (a cross-country on wheels; on floats the circuit on the lane)
  let ap = C.makePilot(sim, def, W, {});
  if (sim.__pose) ap.departFrom(A(P.a), A(P.land), C.siteOf(P.a), { atHold: sim.__pose });
  else ap.setRoute(A(P.a), A(P.land));
  let queued = null, toBefore = null;
  const r1 = fly(sim, ap, W, 1300, (p) => {
    // a To picked IN THE ROLL-OUT: queued, the runway it lands on untouched (the page chains it at STOPPED)
    if (queued == null && p.phase === 'ROLLOUT') { toBefore = p.route.to; queued = p.setDest(A(P.b)); }
  }, trace, 'leg1');
  const c1 = sim.cgPos().slice(), t1 = sim.t, f1 = fuelKg(sim), d1 = dmg(sim);
  const w1 = C.flightWhere(W, c1[0], c1[2], {});
  if (!check(r1.outcome === 'completed' && ap.phase === 'STOPPED', tag + 'leg 1 lands at ' + P.land + ' and stops', r1.outcome + ' ' + ap.phase + ' after ' + r1.t.toFixed(0) + ' s: ' + r1.phases.join('>') +
             ' | ' + r1.verdicts.map(v => v.t + ' ' + v.code + ': ' + v.note).join(' / ') + (dmg(sim).crashed ? ' | crashed: ' + dmg(sim).reason : ''))) return;
  check(w1.id === P.land && (w1.kind === 'runway' || w1.kind === 'water'), tag + 'stopped on ' + P.land + "'s " + (wet ? 'lane' : 'strip'), w1.kind + ' ' + w1.id);
  check(queued === 'queued' && ap.route.to === toBefore && ap.nextTo === A(P.b), tag + 'a To picked in the roll-out is queued, the runway it lands on untouched', queued);
  log(tag + 'leg 1 ' + r1.phases.join('>') + ' in ' + r1.t.toFixed(0) + ' s, stopped ' + w1.kind + ' ' + w1.id + ' (' + c1[0].toFixed(0) + ', ' + c1[2].toFixed(0) + ')');
  // THE CHAIN, as app.js nextLeg makes it: the leg from where it stands, a fresh pilot on the same sim
  const Lg = (doctor && doctor.leg) ? doctor.leg(W, A, P, ap) : C.flightLeg(W, gear, c1[0], c1[2], P.b, { legFrom: ap.route.from });
  check(Lg.depart && Lg.from && Lg.from.id === P.land, tag + 'the From is DERIVED - ' + P.land + ' where it stands' + (P.a !== P.land ? ', not the leg\'s ' + P.a : ''), (Lg.from && Lg.from.id) + ' (' + Lg.where.kind + ')');
  check(Lg.to && Lg.to.id === P.b, tag + 'the To is ' + P.b, Lg.to && Lg.to.id);
  if (doctor && doctor.leg) return;           // (the selftest asks the chain only)
  ap = C.makePilot(sim, def, W, {});
  ap.departFrom(Lg.from, Lg.to);
  const c2 = sim.cgPos();
  check(Math.hypot(c2[0] - c1[0], c2[2] - c1[2]) < 1e-9 && sim.t === t1, tag + 'no reset, no teleport: the leg begins where the landing stopped', Math.hypot(c2[0] - c1[0], c2[2] - c1[2]).toFixed(3) + ' m');
  check(fuelKg(sim) === f1 && dmg(sim).members === d1.members && dmg(sim).yields === d1.yields, tag + 'the fuel and the damage state carried over', f1 + ' kg');
  let taxiM = 0, cp = c1.slice(), r2done = false;
  const r2 = fly(sim, ap, W, 1500, (p) => { if (!['ROLL', 'LIFTOFF', 'CLIMB'].includes(p.phase) && sim.wheelsOnGround() > 0 && !r2done) { const c = sim.cgPos(); taxiM += Math.hypot(c[0] - cp[0], c[2] - cp[2]); cp = c.slice(); } if (p.phase === 'ROLL') r2done = true; }, trace, 'leg2');
  const c3 = sim.cgPos(), w3 = C.flightWhere(W, c3[0], c3[2], {});
  const ph = r2.phases, iRoll = ph.indexOf('ROLL'), pre = ph.slice(0, iRoll);
  // (DEPART plans inside the leg's first step: the first phase a step ends in is the plan's - TAXI, or STOP when the
  // run ahead of the stop is enough, lined up)
  check(iRoll > 0 && pre.every(p => ['DEPART', 'TAXI', 'LINEUP', 'STOP', 'HOLD'].includes(p)), tag + 'leg 2 goes from the landing stop to its take-off (DEPART -> TAXI|STOP -> HOLD -> ROLL)', ph.join('>'));
  if (lead === 'short') check(pre.includes('TAXI'), tag + 'off a short strip the next leg taxis before it rolls', ph.join('>'));
  check(ph.includes('LIFTOFF') && ph.includes('CLIMB'), tag + 'leg 2 takes off', ph.join('>'));
  check(r2.outcome === 'completed' && ap.phase === 'STOPPED' && w3.id === P.b, tag + 'leg 2 flies to ' + P.b + ' and lands there', r2.outcome + ' ' + ap.phase + ' ' + w3.kind + ' ' + w3.id + ' after ' + r2.t.toFixed(0) + ' s' +
        (r2.outcome !== 'completed' ? ' | ' + r2.verdicts.map(v => v.t + ' ' + v.code + ': ' + v.note).join(' / ') : ''));
  check(!r2.verdicts.some(v => /rejected|wrong-surface|taxi-lost/.test(v.code)), tag + 'no rejected take-off, no wrong surface, no lost taxi', r2.verdicts.map(v => v.code).join(','));
  check(Math.max(r1.jump, r2.jump) < 0.5, tag + 'continuous: no step moves the aeroplane further than it flies', Math.max(r1.jump, r2.jump).toFixed(3) + ' m');
  check(!dmg(sim).crashed && fuelKg(sim) <= f1, tag + 'no crash, the fuel only went down', (dmg(sim).reason || '') + ' ' + fuelKg(sim));
  log(tag + 'leg 2 ' + ph.join('>') + ' in ' + r2.t.toFixed(0) + ' s, ' + taxiM.toFixed(0) + ' m on the ground before the roll, stopped ' + w3.kind + ' ' + w3.id + '; fuel ' + f1 + ' -> ' + fuelKg(sim) + ' kg; members broken ' + dmg(sim).members);
}

// ---- C. a new To in the air ----------------------------------------------------------------------------------------------
function airChange(key, check, trace, doctor) {
  const W = jolene(), A = id => W.aerodromes.find(a => a.id === id);
  const def = L.defOf(key);
  const tag = 'air:' + key + ': ';
  const sim = startAt(def, W, A('HOME'));
  const ap = C.makePilot(sim, def, W, {});
  ap.departFrom(A('HOME'), A('w3'), C.siteOf('HOME'), { atHold: sim.__pose });
  const bankLim = Math.max(0.15, Math.min(0.55, (def.params.ap.bankLim ?? 0.30))) + 4 / 57.2958;
  let enr0 = null, at = null, how = null, path0 = null, hdgPrev = null, maxBank = 0, maxRate = 0, worst = null, bankPre = 0;
  const r = fly(sim, ap, W, 1500, (p, s) => {
    const c = sim.cgPos(), v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
    const b = Math.abs(bankOf(sim));
    if (!at) {
      if (p.phase !== 'STOPPED' && sim.wheelsOnGround() === 0) bankPre = Math.max(bankPre, b);
      const Lg = p.legs && p.legs[p.legI];
      // mid-way down the enroute leg (40 % of the way from where the leg began to its end flown): the To moves to w2,
      // behind the aeroplane
      if (p.phase === 'ENROUTE' && Lg && Lg.B && enr0 == null) enr0 = Math.hypot(Lg.B[0] - c[0], Lg.B[1] - c[2]);
      if (p.phase === 'ENROUTE' && Lg && Lg.B && Math.hypot(Lg.B[0] - c[0], Lg.B[1] - c[2]) < 0.6 * enr0) {
        at = { t: sim.t, x: c[0], z: c[2], phase: p.phase };
        how = doctor && doctor.air ? doctor.air(p, A('w2')) : p.setDest(A('w2'));
      }
      return;
    }
    if (path0 == null && p.intent && p.intent.path && p.intent.path.pts && p.phase !== at.phase + '?') {
      const q = p.intent.path.pts[0];
      if (q) path0 = Math.hypot(q.x - at.x, q.z - at.z);
    }
    // from the change to the final: the bank, and the heading's rate against the coordinated turn at the bank limit
    if (['FINAL', 'FLARE', 'ROLLOUT', 'STOPPED'].includes(p.phase) || sim.wheelsOnGround() > 0) return;
    const h = Math.atan2(v[2], v[0]);
    maxBank = Math.max(maxBank, b);
    if (hdgPrev != null && V > 10) {
      const rate = Math.abs(wrap(h - hdgPrev)) * 60, lim = 9.81 * Math.tan(bankLim) / V;
      if (rate / lim > maxRate) { maxRate = rate / lim; worst = { t: sim.t, rate, lim, V }; }
    }
    hdgPrev = h;
  }, trace, 'air');
  const c = sim.cgPos(), w = C.flightWhere(W, c[0], c[2], {});
  if (r.outcome !== 'completed') check(false, tag + 'the flight ended ' + r.outcome, r.verdicts.map(v => v.t + ' ' + v.code + ': ' + v.note).join(' / ') + (dmg(sim).crashed ? ' | crashed: ' + dmg(sim).reason : ''));
  check(!!at && how === 'replan', tag + 'a To picked mid-way down the enroute leg re-plans from here', at ? how + ' at t=' + at.t.toFixed(0) + ' s' : 'never ENROUTE: ' + r.phases.join('>'));
  check(path0 != null && path0 < 40, tag + 'the new path starts at the aeroplane', path0 != null ? path0.toFixed(1) + ' m' : 'no path');
  check(maxBank <= bankLim, tag + 'the bank stays inside the pilot\'s limit (+4 deg)', (maxBank * 57.3).toFixed(1) + ' of ' + (bankLim * 57.3).toFixed(1) + ' deg (before the change ' + (bankPre * 57.3).toFixed(1) + ')');
  // (1.3: the track's rate carries the sideslip and the servo's overshoot; a heading STEP would read tens of times the law)
  check(maxRate <= 1.3, tag + 'no heading step: the track turns no faster than that bank turns it', maxRate.toFixed(2) + ' x' + (worst ? ' at t=' + worst.t.toFixed(0) + ' (' + (worst.rate * 57.3).toFixed(1) + ' deg/s at ' + worst.V.toFixed(0) + ' m/s)' : ''));
  check(r.outcome === 'completed' && ap.phase === 'STOPPED' && w.id === 'w2', tag + 'it arrives: stopped on w2, completed', r.outcome + ' ' + ap.phase + ' ' + w.kind + ' ' + w.id + ' after ' + r.t.toFixed(0) + ' s: ' + r.phases.join('>'));
  check(r.jump < 0.5 && !dmg(sim).crashed, tag + 'continuous, no crash', r.jump.toFixed(3) + ' m');
  log(tag + r.phases.join('>') + ' in ' + r.t.toFixed(0) + ' s; the change at t=' + (at ? at.t.toFixed(0) : '-') + ', path ' + (path0 != null ? path0.toFixed(1) : '-') +
      ' m from the aeroplane, bank ' + (maxBank * 57.3).toFixed(1) + ' deg, rate ' + maxRate.toFixed(2) + ' x the law; stopped ' + w.kind + ' ' + w.id);
}

// ---- A. the model, no flight ---------------------------------------------------------------------------------------------
function model(check) {
  const W = jolene(), A = id => W.aerodromes.find(a => a.id === id);
  const B = C.flightBase(W);
  check(C.FLIGHT_BASE_DEFAULT === 'HOME' && B && B.aero === 'HOME' && B.a === A('HOME'), 'the default base is HOME (the WWII hangar at Jolene AFB 13/31)', B && B.aero);
  check(C.flightBase(W, 'nowhere').id === B.id && C.flightBases(W).length === 1, 'an unknown base falls back to it; one base today');
  const st = C.siteOf('HOME').stand;
  const ws = C.flightWhere(W, st.x, st.z, {}), h = A('HOME');
  check(ws.kind === 'stand' && ws.id === 'HOME', 'the base\'s stand reads stand / HOME', ws.kind + ' ' + ws.id);
  check(C.flightWhere(W, h.x, h.z, {}).kind === 'runway' && C.flightWhere(W, h.x, h.z, {}).id === 'HOME', 'HOME\'s centreline reads runway / HOME');
  const sea = A('SEA');
  check(C.flightWhere(W, sea.x, sea.z, {}).kind === 'water', 'Annette Dock reads water');
  check(C.flightWhere(W, h.x, h.z, { air: true }).kind === 'airborne', 'in the air reads airborne');
  check(C.flightWhere(W, 30000, 30000, {}).kind === 'out' && !C.flightCanDepart(C.flightWhere(W, 30000, 30000, {})), 'far from any aerodrome reads out (no departure from there)');
  // the strip-surface rule on the To picker
  const ch = g => Object.fromEntries(C.flightToChoices(W, g).map(c => [c.id, c.ok]));
  const wh = ch('wheels'), fl = ch('floats');
  check(wh.CIRCUIT && wh.HOME && wh.w3 && !wh.SEA && !wh.mk_sea, 'wheels: every land strip, no water lane', JSON.stringify(wh));
  check(fl.CIRCUIT && fl.SEA && fl.mk_sea && !fl.HOME && !fl.w3, 'floats: the lanes only', JSON.stringify(fl));
  check(C.flightToChoices(W, 'wheels').filter(c => !c.ok).every(c => /water/.test(c.why)), 'a refusal says why');
  const tr = C.flightToRecord(W, 'wheels', 'SEA', h);
  check(tr.to === h && tr.circuit && /water/.test(tr.why), 'a lane asked of wheels falls back to the circuit where it is', tr.why);
  // the pref's migration
  const m1 = C.flightRouteMigrate({ from: 'HOME', dest: 'w3' }), m2 = C.flightRouteMigrate({ from: 'w3', dest: 'CIRCUIT' }), m3 = C.flightRouteMigrate({ v: 2, base: 'HOME', to: 'SEA', spawn: 'A3' });
  check(m1.v === 2 && m1.base === 'HOME' && m1.to === 'w3' && m1.migrated, 'v1 { from HOME, dest w3 } -> v2 base HOME, to w3', JSON.stringify(m1));
  check(m2.base === 'HOME' && m2.to === 'CIRCUIT' && !m2.spawn, 'v1 from w3 (the old spawn anywhere) -> the base', JSON.stringify(m2));
  check(m3.base === 'HOME' && m3.to === 'SEA' && m3.spawn === 'A3' && !m3.migrated, 'v2 passes through (the rigs\' spawn kept)', JSON.stringify(m3));
  check(C.flightRouteMigrate(null).base === 'HOME' && C.flightRouteMigrate('junk').to === 'CIRCUIT', 'no pref -> the base, the circuit');
  // the default start is the base's stand, and a re-departure from there (the From derived) plans the start's own taxi
  const def = L.defOf('cub');
  const plan = (derived) => {
    const sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
    C.placeAtStand(sim, h, st); C.seatOnGround(sim, (x, z) => W.terrainH(x, z), def.refs);
    const ap = C.makePilot(sim, def, W, {});
    if (derived) { const c = sim.cgPos(), Lg = C.flightLeg(W, 'wheels', c[0], c[2], 'w3', {}); ap.departFrom(Lg.from, Lg.to); }
    else { ap.setRoute(h, A('w3')); ap.departFrom(h, A('w3'), C.siteOf('HOME')); }
    ap.update(1 / 60);
    return { phase: ap.phase, ids: ap.path && ap.path.ids ? ap.path.ids.join(',') : null, t: ap.takeoffDir ? ap.takeoffDir.map(v => v.toFixed(3)).join(',') : null, from: ap.route.from.id };
  };
  const p0 = plan(false), p1 = plan(true);
  check(p0.from === 'HOME' && p0.phase === 'TAXI' && !!p0.ids, 'the default start: the base\'s stand, the taxi out', JSON.stringify(p0));
  check(p1.from === p0.from && p1.phase === p0.phase && p1.ids === p0.ids && p1.t === p0.t, 'parked on the stand, a To departs by the same taxi route and direction', JSON.stringify(p1));
  log('model: base ' + B.aero + '; stand ' + ws.kind + '; wheels ' + Object.keys(wh).filter(k => wh[k]).join(' ') + '; floats ' + Object.keys(fl).filter(k => fl[k]).join(' ') + '; the stand\'s taxi ' + p0.ids);
}

// ---- the battery -----------------------------------------------------------------------------------------------------------
const CASES = [
  { id: 'ltd:cub', run: (c, tr, d) => landThenDepart('cub', c, tr, d, 'circuit') },
  { id: 'ltd:metal', run: (c, tr, d) => landThenDepart('metal', c, tr, d, 'short') },
  { id: 'ltd:floats', run: (c, tr, d) => landThenDepart('floats', c, tr, d) },
  { id: 'air:cub', run: (c, tr, d) => airChange('cub', c, tr, d) },
  { id: 'ltd:jodel', run: (c, tr, d) => landThenDepart('jodel', c, tr, d, 'circuit') },
  { id: 'ltd:twinFloats', run: (c, tr, d) => landThenDepart('twinFloats', c, tr, d) },
  { id: 'air:metal', run: (c, tr, d) => airChange('metal', c, tr, d) },
];

function battery(doctor, only) {
  only = only || ONLY;
  const fail = [];
  const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null && extra !== '' ? ' - ' + extra : '')); return ok; };
  if (SH.first && (!only || only.includes('model'))) model(check);
  for (const K of CASES) {
    if (!SH.take()) continue;
    if (only && !only.includes(K.id)) continue;
    const t0 = Date.now(), trace = EVID ? [] : null;
    const n0 = fail.length;
    try { K.run(check, trace, doctor); } catch (e) { check(false, K.id + ' threw', e.stack.split('\n').slice(0, 3).join(' | ')); }
    console.log('  ' + K.id + ': ' + (fail.length === n0 ? 'ok' : (fail.length - n0) + ' failed') + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)' + SH.tag);
    if (EVID && trace) {
      fs.mkdirSync(EV_DIR, { recursive: true });
      const f = path.join(EV_DIR, K.id.replace(':', '_') + '.csv');
      fs.writeFileSync(f, 'leg,t,phase,x,z,y,hdg_deg,bank_deg,gs_ms,fuel_kg,to\n' + trace.map(r => r.join(',')).join('\n') + '\n');
    }
  }
  return fail;
}

if (SELF) {
  // the negatives: (1) the OLD chain (the From = the last leg's To, the pre-G1945 nextLeg) after a landing the pilot
  // made elsewhere - leg 1's From doctored to read as the leg's own departure field - must fail the derived-From check;
  // (2) a re-plan that is not one (setDest doctored to a jump: the target heading snapped to the new field) must go red
  const neg = battery({
    leg: (W, A, P, ap) => { const from = ap.route.from; return { from, to: A(P.b), where: { kind: 'runway' }, depart: true }; },
    air: (p, to) => { p.route.to = to; p.xc = true; p.legs = [{ name: 'ENROUTE', A: [p._m.x, p._m.z], B: [to.x, to.z], enroute: true }]; p.legI = 0; return 'jump'; },
  }, ONLY || ['ltd:metal', 'air:cub']);
  const caught = ['the From is DERIVED', 're-plans from here', 'the new path starts at the aeroplane'].filter(k => neg.some(f => f.includes(k)));
  console.log('selftest: ' + neg.length + ' failures under the doctored chain / re-plan; caught: ' + caught.join(', '));
  const ok = caught.length === 3;
  console.log('GATE DESTTO: ' + (ok ? 'PASS' : 'FAIL') + ' (selftest)');
  process.exit(ok ? 0 : 1);
}
const t0 = Date.now();
const fail = battery(null);
for (const f of fail) console.log('  FAIL ' + f);
console.log('DESTTO: ' + fail.length + ' failure(s), ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s' + SH.tag);
console.log('GATE DESTTO: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
