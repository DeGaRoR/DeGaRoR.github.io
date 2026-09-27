#!/usr/bin/env node
// GATE PLAN (G710) — THE PLAN IS PUBLISHED, AND IT IS THE ONE FLOWN.
//
// The Jolene playtest (2026-09-26): "it's unclear to what altitude the
// autopilot intends to go. There are also no waypoints on the map". The
// pilot now publishes ap.intent (43_pilot.js) every step - the legs and the
// active one, the point flown to, the height asked there, the vertical speed
// asked and the TECS limits it is clamped to, the filleted air path - and
// plans each leg's height when it plans the legs (hPlanA / hPlan / gB). The
// map, the HUD's plan line and the 3-D legs read those; this gate holds them
// to what the law actually does.
//
//   node tools/_plan_check.js            -> "GATE PLAN: PASS|FAIL"
//   node tools/_plan_check.js --show     -> the per-flight numbers
//
// Two circuits flown by THE PILOT to a stop: the stock build at the analytic
// HOME, and the user's aluminium C172 off Jolene's HOME stand. Every step:
//   1 in a leg (CROSSWIND..INBOUND) intent.to is the active leg's name, the
//     point is its end, intent.h IS the height the TECS law was asked
//     (afcs.sel.alt) and the path is published
//   2 the vertical speed asked lies inside the limits published with it
//   3 every leg carries its planned heights; a leg's plan is never under the
//     live target flown on it by more than 15 m (the plan reads the ground
//     along the whole leg, the pilot 1.5 km ahead of where it is), and never
//     under the leg's height over the datum; the FINAL ends on the ground
//   4 on the settled downwind (8 s in, 12 s before its end) the aeroplane
//     flies within 15 m of the downwind's planned height
//   5 on FINAL the target is the slope's (or the latched level) and the
//     point is the aim
//   6 both flights stop
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const SHOW = process.argv.includes('--show');
let bad = 0;
const check = (ok, what, detail) => {
  if (!ok) bad++;
  if (!ok || SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : ''));
  return ok;
};
const LEGS = new Set(['CROSSWIND', 'DOWNWIND', 'BASE', 'ENROUTE', 'INBOUND']);

function fly(name, key, island) {
  const world = island ? IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') }) : C.makeWorld();
  const def = C.buildGen(PT.specOf(key).spec);
  const sim = C.makeSim(def, world); sim.reset(0);
  const a = world.aerodromes.find(q => q.id === 'HOME'), site = island ? C.siteOf('HOME') : null;
  if (site && site.stand) { if (sim.stance) sim.stance(); C.placeAtStand(sim, a, site.stand); }
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world, { style: 'normal' });
  if (site && site.stand) { ap.setRoute(a, a); ap.departFrom(a, a, site); }
  const f = { legSteps: 0, toBad: 0, hBad: 0, pathBad: 0, vsBad: 0, vsN: 0, planUnder: 0, planUnderAt: null, dwN: 0, dwErr: 0, dwMax: 0, finN: 0, finBad: 0, legsSeen: null, liftOld: 0 };
  let prevPhase = null, phaseT0 = 0, dwEnd = null;
  const rows = [];
  for (let k = 0; k < 60 * 700; k++) {
    ap.update(1 / 60); sim.step(1 / 60);
    // the publication names the phase and the leg the step FLEW (a step that moves on publishes the old one)
    const I = ap.intent, ph = I.phase;
    if (ph !== prevPhase) { prevPhase = ph; phaseT0 = ap.t; }
    if (I.vsCmd != null) { f.vsN++; if (I.vsCmd > I.vsUp + 1e-9 || I.vsCmd < I.vsDn - 1e-9) f.vsBad++; }
    if (LEGS.has(ph) && I.legs) {
      const L = I.legs[I.legI];
      f.legSteps++;
      f.legsSeen = I.legs;
      if (I.to !== L.name || I.x !== L.B[0] || I.z !== L.B[1]) f.toBad++;
      if (!(Math.abs(I.h - ap.afcs.sel.alt) < 1e-6)) f.hBad++;
      if (!I.path || !I.path.pts || I.path.pts.length < 2) f.pathBad++;
      const under = I.h - L.hPlan;
      if (!L.enroute && under > 15) { f.planUnder++; f.planUnderAt = L.name + ' ' + Math.round(I.h) + ' against ' + L.hPlan; }
      if (!L.enroute) f.liftOld = Math.max(f.liftOld, I.h - (ap.altRef + (L.h != null ? L.h : ap.hCruise)));
      if (ph === 'DOWNWIND') rows.push({ t: ap.t - phaseT0, y: sim.cgPos()[1], h: L.hPlan });
    }
    if (ph === 'FINAL') {
      f.finN++;
      const aim = I.x != null ? Math.hypot(I.x - (ap.frame.ox + ap.xAim * ap.frame.ux), I.z - (ap.frame.oz + ap.xAim * ap.frame.uz)) : 1e9;
      if (I.to !== 'AIM' || aim > 0.01 || I.h == null) f.finBad++;
    }
    if (ap.phase === 'STOPPED') break;
  }
  f.stopped = ap.phase === 'STOPPED';
  if (rows.length) {
    dwEnd = rows[rows.length - 1].t;
    for (const r of rows) if (r.t > 8 && r.t < dwEnd - 12) { f.dwN++; const e = Math.abs(r.y - r.h); f.dwErr += e; f.dwMax = Math.max(f.dwMax, e); }
  }
  // 3 the legs' planned heights
  let planOk = !!f.legsSeen, planWhy = '';
  for (const L of f.legsSeen || []) {
    if (L.hPlan == null || L.hPlanA == null || L.gB == null) { planOk = false; planWhy = L.name + ' has no plan'; break; }
    if (L.name === 'FINAL') { if (L.hPlan !== L.gB) { planOk = false; planWhy = 'the FINAL ends at ' + L.hPlan + ', the ground ' + L.gB; } continue; }
    if (L.hPlan < Math.round(ap.altRef + (L.h != null ? L.h : ap.hCruise)) - 1) { planOk = false; planWhy = L.name + ' planned under its datum height'; }
  }
  check(f.stopped, '6 ' + name + ' flew the circuit to a stop', 't ' + ap.t.toFixed(0) + ' s, ' + ap.phase);
  check(f.legSteps > 600 && f.toBad === 0, '1 ' + name + ' names the active leg and its end', f.toBad + ' of ' + f.legSteps + ' steps wrong');
  check(f.hBad === 0, '1 ' + name + ' publishes the height the TECS law was asked', f.hBad + ' of ' + f.legSteps + ' steps differ');
  check(f.pathBad === 0, '1 ' + name + ' publishes the air path in the legs', f.pathBad + ' steps without');
  check(f.vsN > 1000 && f.vsBad === 0, '2 ' + name + ' asks its vertical speed inside the published limits', f.vsBad + ' of ' + f.vsN + ' outside');
  check(planOk, '3 ' + name + ' plans every leg\'s height', planWhy || (f.legsSeen || []).map(L => L.name + ' ' + L.hPlanA + '>' + L.hPlan + ' (ground ' + L.gB + ')').join(', '));
  check(f.planUnder === 0, '3 ' + name + ' never flies a leg above its plan by 15 m', f.planUnderAt || 'the terrain lifted the live target ' + f.liftOld.toFixed(0) + ' m over the datum height at most');
  check(f.dwN > 300 && f.dwMax < 15, '4 ' + name + ' flies the settled downwind at its planned height', f.dwN ? 'mean ' + (f.dwErr / f.dwN).toFixed(1) + ' m, max ' + f.dwMax.toFixed(1) + ' m off' : 'no settled downwind');
  check(f.finN > 300 && f.finBad === 0, '5 ' + name + ' aims the FINAL at the aim point', f.finBad + ' of ' + f.finN + ' steps wrong');
  console.log('  ' + name.padEnd(28) + ' legs ' + (f.legsSeen || []).map(L => L.name + ' ' + L.hPlan + ' m').join(' / ') +
              ' · downwind ' + (f.dwN ? (f.dwErr / f.dwN).toFixed(1) : '-') + ' m off the plan · terrain lift ' + f.liftOld.toFixed(0) + ' m');
}

fly('stock, HOME (analytic)', 'stock', false);
fly('aluminium C172, Jolene HOME', path.join(T, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json'), true);
console.log('GATE PLAN: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
