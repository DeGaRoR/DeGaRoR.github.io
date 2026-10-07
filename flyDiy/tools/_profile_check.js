#!/usr/bin/env node
// GATE PROFILE (G2125 PILOT-PROFILE) - THE CLIMB ON SPEED, THE PLANNED VERTICAL PROFILE, THE ROUGH PERCEPTION OF
// OBSTACLES. The user (7 Oct, flying the game's autopilot): "the autopilot initial angle at take off feels quite off.
// In the Jodel, it will try and climb so hard that it will almost stall" / "when the autopilot goes over mountains, it
// keeps diving and climbing, like its perspective on relief is very short" / "Is the autopilot aware of trees, or will
// it happily run into them if an approach circuit has trees through?".
//
// THE VALIDATED AEROPLANES ONLY: the Jodel (builds/jodel_2026-09-20_corrected.json), the user's Cub
// (builds/cub_2026-09-20_corrected.json) and the user's metal Cessna (tools/fixtures/build_v10_cessnaMetal_2026-09-26.json).
//
//   1 THE CLIMB (the analytic world's HOME, calm, the pilot from the take-off to the crosswind turn): from the screen
//     height (15 m, the 50 ft a handbook's take-off ends at) to the end of CLIMB the airspeed never under 1.3 Vs in the
//     flap flown, and off the wheels to 15 m (the run-up in the ground effect) never under 1.1 Vs (the sheet's clean and landing stalls,
//     interpolated - 44_vprofile.js climbSpeeds), the attitude never over the type's cap (a full-power climb's attitude at
//     that floor speed + 2 deg, the pilot's own number) and the settled climb (the last 10 s of CLIMB) inside 2..14 deg
//   2 THE MOUNTAIN TRIP (Jolene, HOME -> Jumbo Mine, 17 km over a 631 m ridge; the metal Cessna to a stop, the Jodel's
//     cruise): a planned profile on the enroute leg (a cruise height, its top of climb and top of descent), at most 2
//     altitude reversals (10 m band) over the first enroute segment, the terrain under the aeroplane >= the plan's
//     clearance (hClear, 130 m) until the top of descent, the arrival's 2 hSafe after it; the Cessna 'completed'
//   3 AN APPROACH OVER TREES (Jolene in the 'map' variant - the woods by the runways as the map has them - East Point
//     Clearing, 150 m, the trees in its fans: the Cub's circuit to a stop): no node in any tree's cylinder (RWYTREES 8's
//     own test), and on FINAL over the trees (more than 60 m before the threshold) the lowest node >= 10 m over every
//     tree top within 15 m of the track (`--trees=map` flies the 'map' variant; the game's 'today' by default)
//
//   node tools/_profile_check.js            all three (~6 min on 3 cores: the cases run in parallel)
//   node tools/_profile_check.js --case=N   one case (1, 2 or 3), JSON on the last line
'use strict';
const path = require('path'), fs = require('fs');
const { spawn } = require('child_process');
const T = __dirname;
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BUILDS = {
  jodel: path.join(T, '..', 'builds', 'jodel_2026-09-20_corrected.json'),
  cub: path.join(T, '..', 'builds', 'cub_2026-09-20_corrected.json'),
  cessnaMetal: path.join(T, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json'),
};
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
// the core under test: PILOT_CORE (pilot_trace's own switch) for a before / after on another build
const CORE = process.env.PILOT_CORE ? path.resolve(process.env.PILOT_CORE) : path.join(T, 'flight_core.js');
const TREES = arg('trees', 'today');
const VP = () => require(process.env.VP_CORE || path.join(T, 'flight_core.js')).VPROFILE;   // the rules the gate judges by (pure): this tree's, on any core

function jolene(variant) {
  const IN = require(path.join(T, 'island_node.js'));
  const fx = path.join(T, 'fixtures', 'island_jolene.json');
  return IN.islandWorld('jolene', Object.assign({ premises: fs.readFileSync(fx, 'utf8') }, variant ? { rwyTrees: variant } : {}));
}

// ---- 1 the climb ---------------------------------------------------------------------------------------------------
function caseClimb() {
  const PT = require(path.join(T, 'pilot_trace.js'));
  const out = {};
  for (const name of ['jodel', 'cub', 'cessnaMetal']) {
    const rows = [];
    let K = null, S = null, flapLdg = 1;
    PT.runTrace({ key: BUILDS[name], maxS: 95, quiet: true, probeEvery: true, probe: (ap, sim, t) => {
      if (!S) { S = ap.sheet; const E = S && S.effectors; flapLdg = E && E.flapLdg > 0 ? E.flapLdg : 1; }
      if (ap.climbKit) K = ap.climbKit;
      if (!['LIFTOFF', 'CLIMB'].includes(ap.phase)) return;
      const d = ap.dbg;
      rows.push({ t, ph: ap.phase, V: d.V, th: d.th, agl: d.aglG, flap: sim.ctl.flap });
    } });
    const C = require(CORE);
    const A = { VRot: null };
    // the floor in the flap flown, by the pilot's own rule
    const floorOf = f => VP().climbSpeeds(S, A, { flap: f, flapLdg: flapLdg > 0 ? flapLdg : 1 }).Vfloor;
    // THE CLIMB begins at the screen height (15 m - the 50 ft every handbook's take-off distance ends at); under it the
    // aeroplane is still taking off (off the wheels, accelerating in its ground effect) and is held to 1.1 Vs
    const R = rows.filter(q => q.agl > 15), RT = rows.filter(q => q.agl > 0.5 && q.agl <= 15);
    const climb = rows.filter(q => q.ph === 'CLIMB'), tEnd = climb.length ? climb[climb.length - 1].t : 0;
    const settled = climb.filter(q => q.t > tEnd - 10);
    let worst = null;
    for (const q of R) { const m = q.V / floorOf(q.flap) * 1.3; if (!worst || m < worst.m) worst = { m, V: q.V, t: q.t, ph: q.ph }; }
    let wTO = null;
    for (const q of RT) { const m = q.V / floorOf(q.flap) * 1.3; if (!wTO || m < wTO.m) wTO = { m, V: q.V, t: q.t }; }
    const thMax = Math.max(...R.concat(RT).map(q => q.th)) * 57.3, thSet = settled.reduce((s, q) => s + q.th, 0) / Math.max(1, settled.length) * 57.3;
    const Vset = settled.reduce((s, q) => s + q.V, 0) / Math.max(1, settled.length);
    out[name] = { n: R.length, toVs: r2(wTO ? wTO.m : 0), toV: r1(wTO ? wTO.V : 0), VminVs: r2(worst ? worst.m : 0), Vmin: r1(worst ? worst.V : 0), at: worst ? worst.ph + ' ' + r1(worst.t) + ' s' : null,
                  thMax: r1(thMax), cap: K ? r1(K.cap * 57.3 + 2) : null, thClimb: r1(thSet), Vclimb: r1(Vset), Vs: S ? r1(S.Vs) : null, Vy: K ? r1(K.Vy) : null };
  }
  return out;
}

// ---- 2 the mountain trip ---------------------------------------------------------------------------------------------
function caseTrip() {
  const PT = require(path.join(T, 'pilot_trace.js'));
  const C = require(CORE);
  const out = {};
  for (const [name, full] of [['cessnaMetal', true], ['jodel', false]]) {
    const hs = [], clr = [];
    let vpSum = null, first = null, done = false, tod = null, legL = null, react = 0;
    PT.loadPanel();
    const A0 = C.buildGen(PT.specOf(BUILDS[name]).spec).params.ap, hClear = A0.hClear ?? 130, marg2 = Math.max(2 * A0.hSafe, 40);
    const res = PT.runTrace({ key: BUILDS[name], world: 'jolene', to: 'mn_strip', maxS: full ? 1100 : 900, quiet: true, probeEvery: true, probe: (ap, sim, t) => {
      const en = ap.phase === 'ENROUTE' || ap.phase === 'INBOUND';
      if (en && first === null) first = true;
      if (!en && first === true) { first = false; done = true; }
      if (!en || done) return;
      const L = ap.legs && ap.legs[ap.legI];
      if (L && L.vpSum && !vpSum) { vpSum = L.vpSum; tod = L.vpSum.tod; legL = Math.hypot(L.B[0] - L.A[0], L.B[1] - L.A[1]); }
      const cg = sim.cgPos();
      hs.push(cg[1]);
      // the along-leg position (the plan's s) to know which side of the top of descent the aeroplane is
      let s = null;
      if (L && L.A && L.B) { const dx = L.B[0] - L.A[0], dz = L.B[1] - L.A[1], ln = Math.hypot(dx, dz) || 1; s = ((cg[0] - L.A[0]) * dx + (cg[2] - L.A[1]) * dz) / ln; }
      clr.push({ s, c: ap.dbg.aglG, t });
      react = ap.vpReact || 0;
    } });
    const rev = VP().reversals(hs, 10);
    // the cruise: from the top of climb to the top of descent (the climb out of HOME is under the cruise's clearance by design -
    // the departure's circuit height - and the reactive guard watches it)
    const toc = vpSum ? vpSum.toc : null;
    const before = clr.filter(q => q.s != null && tod != null && q.s >= toc && q.s < tod), after = clr.filter(q => q.s != null && tod != null && q.s >= tod);
    const minB = before.length ? Math.min(...before.map(q => q.c)) : null, minA = after.length ? Math.min(...after.map(q => q.c)) : null;
    const dur = clr.length ? clr[clr.length - 1].t - clr[0].t : 0;
    out[name] = { outcome: res.outcome, phases: res.phases.length, plan: vpSum, legL: legL ? Math.round(legL) : null, cruiseS: Math.round(dur), reversals: rev,
                  perMin: r2(rev / Math.max(1e-9, dur / 60)), clearBeforeTod: minB != null ? Math.round(minB) : null, clearAfterTod: minA != null ? Math.round(minA) : null,
                  hClear, margEnd: marg2, react, full };
  }
  return out;
}

// ---- 3 the approach over trees ---------------------------------------------------------------------------------------
function caseTrees() {
  const PT = require(path.join(T, 'pilot_trace.js'));
  PT.loadPanel();
  const C = require(CORE);
  const world = jolene(TREES);
  const R_OF = Tr => 0.7 * Tr.s + 0.12;                         // the solver's tree cylinder (30_solver.js), as RWYTREES 8
  const def = C.buildGen(PT.specOf(BUILDS.cub).spec);
  const sim = C.makeSim(def, world); sim.reset(0);
  const a = world.aerodromes.find(q => q.id === 'nv_strip'), site = C.siteOf('nv_strip');
  if (sim.stance) sim.stance(); C.placeAtStand(sim, a, site.stand);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world, { style: 'normal' });
  ap.setRoute(a, a); ap.departFrom(a, a, site);
  const out = [];
  let contact = 0, contactAt = null, minNear = Infinity, minVert = Infinity, vertAt = null, appr = null, gaN = 0;
  for (let k = 0; k < 60 * 900; k++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (k % 6) continue;
    const cg = sim.cgPos();
    const near = world.treesNear(cg[0], cg[2], out);
    // the threshold the aeroplane lands over: 60 m short of it the final is still over the approach's ground
    let toThr = null;
    if (ap.phase === 'FINAL' && ap.frame && ap.appr) {
      const F = ap.frame, sAl = (cg[0] - F.ox) * F.ux + (cg[2] - F.oz) * F.uz;
      toThr = (ap.xAim - ap.appr.aimIn) - sAl;
      appr = ap.appr;
    }
    let lowY = Infinity; for (let i = 0; i < sim.n; i++) lowY = Math.min(lowY, sim.p[i * 3 + 1]);
    for (const ti of near) {
      const Tr = world.trees[ti], R = R_OF(Tr), top = Tr.h + 4.6 * Tr.s;
      for (let i = 0; i < sim.n; i++) {
        if (sim.p[i * 3 + 1] > top) continue;
        const d = Math.hypot(sim.p[i * 3] - Tr.x, sim.p[i * 3 + 2] - Tr.z) - R;
        if (d < minNear) minNear = d;
        if (d <= 0) { contact++; if (!contactAt) contactAt = ap.phase + ' at ' + cg.map(q => q.toFixed(0)).join(','); }
      }
      if (toThr != null && toThr > 60 && Math.hypot(cg[0] - Tr.x, cg[2] - Tr.z) < 15) {
        const v = lowY - top;
        if (v < minVert) { minVert = v; vertAt = Math.round(toThr) + ' m before the threshold'; }
      }
    }
    if (ap.phase === 'STOPPED') break;
  }
  gaN = ap.report.verdicts.filter(v => v.code === 'go-around').length;
  return { phase: ap.phase, t: Math.round(ap.t), outcome: ap.report.outcome, contact, contactAt, minNear: r1(minNear), minVert: Number.isFinite(minVert) ? r1(minVert) : null, vertAt,
           goArounds: gaN, appr: appr ? { technique: appr.technique, gs: appr.gs, reqGs: appr.reqGs, aimIn: appr.aimIn, displaced: appr.displaced || null } : null,
           verdicts: ap.report.verdicts.filter(v => /aim-displaced|go-around|divert|vx-climb|terrain/.test(v.code)).map(v => v.code + '@' + v.t) };
}

// ---- the runner ------------------------------------------------------------------------------------------------------
const one = arg('case', null);
if (one) {
  const r = one === '1' ? caseClimb() : one === '2' ? caseTrip() : caseTrees();
  console.log('CASE ' + JSON.stringify(r));
  process.exit(0);
}
(async () => {
  const t0 = Date.now();
  const run = n => new Promise(res => {
    const p = spawn(process.execPath, ['--max-old-space-size=6000', __filename, '--case=' + n, '--trees=' + TREES], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = '';
    p.stdout.on('data', d => so += d); p.stderr.on('data', d => se += d);
    p.on('close', code => { const l = so.split('\n').filter(x => x.startsWith('CASE ')).pop(); res(l ? JSON.parse(l.slice(5)) : { error: 'exit ' + code + ' ' + se.slice(-600) }); });
  });
  const [c1, c2, c3] = await Promise.all([run(1), run(2), run(3)]);
  const fail = [];
  const check = (ok, label, note) => { console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label + (note ? ' - ' + note : '')); if (!ok) fail.push(label); };
  console.log('GATE PROFILE - the climb on speed, the planned vertical profile, the rough perception of obstacles');
  console.log('1 THE CLIMB (HOME, calm; off the wheels to 15 m, then from 15 m to the end of CLIMB)');
  if (c1.error) check(false, '1 ran', c1.error);
  else for (const [n, r] of Object.entries(c1)) {
    check(r.toVs >= 1.1, '1 ' + n + ': off the wheels to the screen height (15 m) never under 1.1 Vs', 'min ' + r.toVs + ' Vs (' + r.toV + ' m/s)');
    check(r.n > 100 && r.VminVs >= 1.3, '1 ' + n + ': the climb (from 15 m) never under 1.3 Vs in the flap flown', 'min ' + r.VminVs + ' Vs (' + r.Vmin + ' m/s, ' + r.at + '), Vs ' + r.Vs + ', Vy ' + r.Vy);
    check(r.cap != null && r.thMax <= r.cap, '1 ' + n + ': the attitude never over the type\'s cap', 'max ' + r.thMax + ' deg, cap ' + r.cap);
    check(r.thClimb >= 2 && r.thClimb <= 14, '1 ' + n + ': the settled climb attitude inside 2..14 deg', r.thClimb + ' deg at ' + r.Vclimb + ' m/s');
  }
  console.log('2 THE MOUNTAIN TRIP (Jolene, HOME -> Jumbo Mine, 17 km over the 631 m ridge)');
  if (c2.error) check(false, '2 ran', c2.error);
  else for (const [n, r] of Object.entries(c2)) {
    const P = r.plan;
    check(!!(P && P.cruise != null && P.toc != null && P.tod != null), '2 ' + n + ': a planned profile on the enroute leg',
      P ? 'cruise ' + P.cruise + ' m, top of climb ' + P.toc + ' m, top of descent ' + P.tod + ' m of ' + r.legL + ' m, plan clears ' + P.minClear + ' m' + (P.climbLimited ? ', climb-limited at ' + P.climbLimited.s + ' m' : '') : 'none');
    check(r.reversals <= 2, '2 ' + n + ': altitude reversals in the cruise near zero', r.reversals + ' in ' + r.cruiseS + ' s (' + r.perMin + ' / min); the reactive guard fired ' + r.react + 'x');
    check(r.clearBeforeTod != null && r.clearBeforeTod >= r.hClear - 10, '2 ' + n + ': the terrain under the aeroplane >= the plan\'s clearance from the top of climb to the top of descent', r.clearBeforeTod + ' m (hClear ' + r.hClear + ')');
    check(r.clearAfterTod == null || r.clearAfterTod >= r.margEnd, '2 ' + n + ': ... and >= the arrival\'s 2 hSafe after it', r.clearAfterTod + ' m (' + r.margEnd + ')');
    if (r.full) check(r.outcome === 'completed', '2 ' + n + ': landed at Jumbo Mine', r.outcome);
  }
  console.log('3 AN APPROACH OVER TREES (Jolene \'' + TREES + '\', East Point Clearing, the Cub\'s circuit to a stop)');
  if (c3.error) check(false, '3 ran', c3.error);
  else {
    check(c3.phase === 'STOPPED' && c3.contact === 0, '3 the Cub flies East Point\'s circuit to a stop and touches no tree',
      c3.phase + ' at ' + c3.t + ' s, ' + c3.contact + ' contacts' + (c3.contactAt ? ' (first ' + c3.contactAt + ')' : '') + ', nearest node to a cylinder ' + c3.minNear + ' m; ' + c3.goArounds + ' go-arounds; ' + c3.verdicts.join(' '));
    check(c3.minVert == null || c3.minVert >= 10, '3 on final the lowest node >= 10 m over every tree top within 15 m of the track',
      (c3.minVert == null ? 'no tree under the final' : c3.minVert + ' m (' + c3.vertAt + ')') + '; the approach ' + JSON.stringify(c3.appr));
  }
  console.log('(' + Math.round((Date.now() - t0) / 1000) + ' s)');
  console.log('GATE PROFILE: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
})();
