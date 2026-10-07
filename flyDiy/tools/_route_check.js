#!/usr/bin/env node
// GATE ROUTE (G2120-G2124 ROUTE-DRAW) — THE DRAWN ROUTE IS THE ONE FLOWN.
//
// The user (2026-10-07): "regarding autopilot, can we now draw a trajectory (control points + altitude) for the
// autopilots?" 38c_route.js is the record and its profile (the drawing's verdicts); 43_pilot.js ap.flyRoute flies it
// (the ROUTE phase, then the record's end). Everything here flies the REAL sim and the REAL pilot on Jolene, the
// validated builds only (the user's Cub builds/cub_2026-09-20_corrected.json, the Jodel, the metal Cessna -
// tools/_treecrash_lib.js BUILDS), the damage model ON, lined up at HOME with the route drawn before the take-off.
//
//   node tools/_route_check.js                  -> "GATE ROUTE: PASS|FAIL"
//   node tools/_route_check.js --show           -> the per-point lines
//   node tools/_route_check.js --only fly:cub   a part of it
//   node tools/_route_check.js --selftest       -> negative verification (a doctored profile and a doctored pilot go red)
//
// A. THE MODEL (no flight): a record normalises (junk points dropped, the end and the margin sound, JSON round trip);
//    a new point's default is ROUTE_AGL_DEFAULT over the highest ground about it; MSL <-> AGL keeps the altitude; the
//    profile of a point drawn under a hill is red (a conflict, said), a point too steep for the aeroplane is flagged
//    with what it asks against the limit, the take-off's climb-out is not a conflict; a point's speed is clamped to the
//    aeroplane's; the legs carry the drawn altitudes.
// C. THE DRAWING (no browser): route_draw.js in a vm - points added at their safe default, inserted into a leg, every
//    edit remembered (flydiy.routeDraw), FLY THIS ROUTE arming the pilot, a new flight's pilot handed it, a reload
//    bringing it back, leaving it disarming. (Its gestures are real pointer input in tools/route_draw_shot.js.)
// B. THE FLIGHTS (fly:<build>): the same 5-point route over Jolene (170 / 350 / 300 / 220 / 170 m MSL - climbs, a
//    descent over the sea, a descent back to the field), its profile CLEAN for that aeroplane at drawing time; armed on
//    the ground, taken over at the climb-out; then, against the gate's own trace:
//      every point captured inside its radius (routeCaptureR: the fly-by's own miss at that corner + 80 m, >= 150 m)
//      the altitude at each point within +-15 m of the drawn one
//      the vertical speed asked inside TECS's published limits every step, the one flown inside them (+0.5 m/s, 1 s mean;
//        from 10 s after the climb-out's hand-over - its own climb arrives with it, logged)
//      no terrain conflict: the aeroplane >= 40 m over the ground on the route, no 'terrain-react' (PILOT-PROFILE's guard)
//      the hands: aileron and rudder reversals per minute on the route under PILOTACT's limit for legs (12)
//      the plan published: ap.intent.route is the state, intent.to the active point, intent.h the height TECS was asked
//    and the end as drawn: the Cub 'home' (lands back at HOME, completed), the Jodel 'hold' (150 s orbiting the last
//    point: within 15 m of its altitude, 80 m of the circle), the metal Cessna 'land' (the nearest strip it lands on).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const L = require(path.join(T, '_treecrash_lib.js'));
const C = L.core();
const IN = require(path.join(T, 'island_node.js'));
const SH = require(path.join(T, '_shard.js'));
const { ACT_LIMIT } = require(path.join(T, 'pilot_matrix.js'));

const argv = process.argv.slice(2);
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest');
const ONLY = (() => { const i = argv.indexOf('--only'); return i >= 0 ? argv[i + 1].split(',') : null; })();
const log = s => { if (SHOW) console.log('  ' + s); };
const jolene = () => IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });

// THE ROUTE: offsets from HOME's centre (m) and the altitude asked (m MSL)
// (G2125 rebase: PILOT-PROFILE's planner lifts a leg to its minimum en-route altitude over its whole length - the old
// route's WP2 sat on the hill north-west of the field and its leg's 219 m floor lifted WP1 from 170 to 214 m; WP2 is
// over the sea now, and the planner flies every point as drawn for all three)
const ROUTE_PTS = [[1500, -2500, 175], [-3000, -5000, 320], [-4500, -2000, 260], [-3500, 1000, 215], [-1500, 2500, 170]];
function gateRoute(W, end) {
  const H = W.aerodromes.find(a => a.id === 'HOME');
  const R = C.routeNew('gate');
  R.end = end;
  for (const [dx, dz, h] of ROUTE_PTS) R.pts.push({ x: Math.round(H.x + dx), z: Math.round(H.z + dz), alt: h, ref: 'msl', V: null });
  return R;
}

// lined up where the taxi from HOME's stand would end (GATE LINEUP's / DESTTO's way)
function startAt(def, W, a) {
  const sim = C.makeSim(def, W);
  sim.reset(0); if (sim.stance) sim.stance();
  const site = C.siteOf(a.id);
  C.placeAtStand(sim, a, site.stand);
  C.seatOnGround(sim, (x, z) => W.terrainH(x, z), def.refs);
  const q = C.makePilot(sim, def, W, {});
  q.setRoute(a, a); q.departFrom(a, a, site);
  const pose = q.lineupPose();
  sim.reset(0); if (sim.stance) sim.stance();
  C.placeAtLineup(sim, a, pose, W, def.refs);
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
  return { sim, pose, site };
}

// pilot_trace.js's reversal counter (G630: a turn of the surface's motion after it moved ACT_H from the last extreme)
const ACT_H = 0.03;
function revCounter() {
  const R = { r: 0, d: 0, x: null };
  return { step(v) { if (R.x == null) { R.x = v; return; } const dv = v - R.x;
    if (R.d === 0) { if (Math.abs(dv) > ACT_H) { R.d = Math.sign(dv); R.x = v; } } else if (R.d * dv > 0) R.x = v;
    else if (-R.d * dv > ACT_H) { R.r++; R.d = -R.d; R.x = v; } }, get n() { return R.r; } };
}

// ---- A. the model -------------------------------------------------------------------------------------------------
function model(check, doctor) {
  const W = jolene(), H = W.aerodromes.find(a => a.id === 'HOME');
  const n = C.routeNormalise({ name: '  my route ', end: 'nowhere', margin: 'x', pts: [{ x: 1, z: 2, alt: 300 }, { x: 'a', z: 0, alt: 1 }, null, { x: 5, z: 6, alt: 200, ref: 'agl', V: 40 }] });
  check(n && n.pts.length === 2 && n.name === 'my route' && n.end === 'hold' && n.margin === C.ROUTE_MARGIN && n.pts[1].ref === 'agl' && n.pts[1].V === 40,
        'a record normalises: junk points dropped, the end and the margin sound', JSON.stringify(n));
  check(JSON.stringify(C.routeNormalise(JSON.parse(JSON.stringify(n)))) === JSON.stringify(n), 'the record round-trips through JSON (the save, the library, the career map)');
  check(C.routeNormalise(null) === null && C.routeNormalise({ pts: 3 }) === null, 'a non-record is none');
  // the default altitude
  const hx = H.x + 3000, hz = H.z - 4200, safe = C.routeSafeAlt(W, hx, hz);
  let top = -1e9; for (let r = 0; r <= 500; r += 250) for (let k = 0; k < 8; k++) top = Math.max(top, C.routeGroundAt(W, hx + r * Math.cos(k * Math.PI / 4), hz + r * Math.sin(k * Math.PI / 4), true));
  check(safe >= top + C.ROUTE_AGL_DEFAULT && safe < top + C.ROUTE_AGL_DEFAULT + 10, 'a new point defaults to ' + C.ROUTE_AGL_DEFAULT + ' m over the highest ground about it', safe + ' m over ' + top.toFixed(0));
  const R0 = C.routeNew('t'); const p = C.routeAddPt(R0, W, hx, hz, null, 'agl');
  check(p && p.ref === 'agl' && Math.abs(C.routeAltMSL(p, W) - safe) < 1, 'an AGL point is the same default over the ground', p && p.alt + ' agl');
  const msl0 = C.routeAltMSL(p, W); C.routeSetRef(p, 'msl', W);
  check(p.ref === 'msl' && Math.abs(p.alt - msl0) <= 0.5, 'AGL -> MSL keeps the altitude', p.alt + ' vs ' + msl0.toFixed(1));
  // the profile's verdicts, for the Cub
  const def = L.defOf('cub'), sim = C.makeSim(def, W); sim.reset(0);
  const perf = C.makePilot(sim, def, W, {}).routePerf();
  const prof = (R, from) => doctor && doctor.profile ? doctor.profile(R, W, perf) : C.routeProfile(R, W, { perf, from });
  const R1 = gateRoute(W, 'home');
  const P1 = prof(R1, { x: H.x, z: H.z, h: H.elev });
  check(P1.pts.every(q => Math.abs(q.hPlan - q.h) <= 3), 'PILOT-PROFILE\'s planner (VPROFILE.plan, drawn) flies the gate route as drawn', P1.pts.map(q => Math.round(q.h) + '->' + Math.round(q.hPlan)).join(' '));
  check(P1.ok && !P1.unsafe && P1.samples[0].join, 'the gate route from the field is clean (the climb-out not a conflict)', P1.warnings.join('; ') || 'min clearance ' + P1.minClr.toFixed(0) + ' m');
  // a point drawn under the hill north-east of the field (ground ~ 600 m)
  const R2 = gateRoute(W, 'home'); R2.pts.splice(2, 0, { x: Math.round(H.x + 6000), z: Math.round(H.z - 2000), alt: 400, ref: 'msl', V: null });
  const P2 = prof(R2, { x: H.x, z: H.z, h: H.elev });
  check(P2.unsafe && P2.conflicts.length > 0 && P2.minClr < 0 && /TERRAIN/.test(P2.warnings.join(' ')), 'a point drawn under a hill is red, and said', P2.warnings.join('; '));
  check(P1.raised.length === 0 && P2.raised.length > 0 && P2.samples.some(q => q.hPlan - q.h > 50), 'a drawing under a leg\'s minimum en-route altitude is flown higher, and flagged', P2.raised.map(i => 'WP' + (i + 1)).join(' '));
  // a climb the Cub cannot make: 600 m in 2 km
  const R3 = gateRoute(W, 'home'); R3.pts[1].alt = 900;
  const P3 = prof(R3, { x: H.x, z: H.z, h: H.elev });
  check(P3.steep.includes(1) && !P3.pts[1].ok && /climbs .* plan limit \+/.test(P3.pts[1].why), 'a point too steep for the aeroplane is flagged at drawing time', P3.pts[1].why);
  check(perf.climb > 0 && perf.climb < perf.vsUp && perf.sink > 0 && perf.sink < -perf.vsDn, 'the plan limits sit inside the law\'s', JSON.stringify({ climb: perf.climb, vsUp: perf.vsUp, sink: perf.sink, vsDn: perf.vsDn }));
  check(C.routeSpeedOf({ V: 1 }, perf) === perf.Vmin && C.routeSpeedOf({ V: 500 }, perf) === perf.Vmax && C.routeSpeedOf({ V: null }, perf) === perf.V, 'a point\'s speed is the aeroplane\'s (clamped), none = the cruise');
  const Lg = C.routeLegs(R1, W);
  check(Lg.length === 5 && Lg[0].A === null && Lg[1].A[0] === R1.pts[0].x && Lg.every((l, i) => l.hB === ROUTE_PTS[i][2] && l.drawn && l.name === 'WP' + (i + 1)), 'the legs carry the drawn altitudes, WP1..WP5');
  log('model: safe ' + safe + ' m; gate route min clearance ' + P1.minClr.toFixed(0) + ' m; hill ' + P2.minClr.toFixed(0) + ' m; steep ' + P3.pts[1].why);
}

// ---- C. the drawing (route_draw.js, no browser): the page's module in a vm with the core's globals and stub doors ----
function drawing(check, doctor) {
  const vm = require('vm');
  const W = jolene(), H = W.aerodromes.find(a => a.id === 'HOME');
  const store = {};
  const def = L.defOf('cub'), sim = C.makeSim(def, W); sim.reset(0);
  let ap = C.makePilot(sim, def, W, {});
  const ctx = vm.createContext(Object.assign({ console, Date, JSON, Math, Map, setTimeout, clearTimeout }, C));
  vm.runInContext(fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'route_draw.js'), 'utf8') + '\n;this.RD = ROUTE_DRAW;', ctx);
  const RD = ctx.RD;
  let redraws = 0;
  const deps = { ap: () => ap, sim: () => sim, world: () => W, started: () => false, prefGet: (k, d) => (k in store ? store[k] : d), prefSet: (k, v) => { store[k] = v; },
                 simw: () => null, box: () => ({ x0: -14000, z0: -30000, size: 39000 }), redraw: () => { redraws++; }, mapOpen: () => {} };
  RD.attach(deps);
  check(RD.route() === null && !RD.armed(), 'the drawing starts empty, nothing armed');
  for (const [dx, dz] of ROUTE_PTS) RD.add(H.x + dx, H.z + dz);
  const R = RD.route();
  check(R && R.pts.length === 5 && R.pts.every(p => p.ref === 'msl' && p.alt === C.routeSafeAlt(W, p.x, p.z)), 'five points added, each at its safe default', R && R.pts.map(p => p.alt).join(' '));
  const saved = JSON.parse(store['flydiy.routeDraw'] || 'null');
  check(saved && saved.route && saved.route.pts.length === 5 && saved.fly === false && redraws >= 5, 'every edit is remembered with the flight (flydiy.routeDraw) and redrawn');
  RD.add(H.x + 3000, H.z - 4000, 1);
  check(RD.route().pts.length === 6 && RD.route().pts[1].x === Math.round(H.x + 3000), 'a point inserted into a leg lands between its ends');
  RD.load(Object.assign(gateRoute(W, 'hold'), { name: 'lib' }));
  RD.fly();
  check(RD.armed() && ap.drawn && ap.drawn.state === 'armed' && ap.drawn.route.name === 'lib', 'FLY THIS ROUTE arms the flying pilot', ap.drawn && ap.drawn.state);
  check(JSON.parse(store['flydiy.routeDraw']).fly === true, 'armed, remembered');
  // a new flight (the reset): the page's mkPilot hands the armed route to its new pilot
  ap = C.makePilot(sim, def, W, {});
  RD.onPilot(ap);
  check(ap.drawn && ap.drawn.state === 'armed' && ap.drawn.legs.length === 5, 'a new flight\'s pilot is handed the armed route', ap.drawn && ap.drawn.state);
  // a page reload: the draft and the arming come back from the pref
  const ctx2 = vm.createContext(Object.assign({ console, Date, JSON, Math, Map, setTimeout, clearTimeout }, C));
  vm.runInContext(fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'route_draw.js'), 'utf8') + '\n;this.RD = ROUTE_DRAW;', ctx2);
  ctx2.RD.attach(deps);
  check(ctx2.RD.armed() && ctx2.RD.route() && ctx2.RD.route().name === 'lib' && ctx2.RD.route().pts.length === 5, 'reloaded, the drawn route and its arming are back');
  RD.leave();
  check(!RD.armed() && JSON.parse(store['flydiy.routeDraw']).fly === false, 'leaving it disarms, remembered');
  const P = RD.profile();
  check(P && P.ok && P.samples.length > 50, 'the panel\'s profile is routeProfile\'s, clean for the gate route', P && P.warnings.join('; '));
}

// ---- B. a flight --------------------------------------------------------------------------------------------------
// `persona` (G2085, train 40): a PILOT_PROFILES name flying the same route - the expert's laws with the person's traits
// on top; the capture radius is that person's own (routePerf at their bank), the altitude +-25 m, and the hands' checks
// (the reversals, the vertical speed flown) are logged, not judged: unsteady hands are the person
function flight(key, end, check, doctor, persona) {
  const W = jolene(), H = W.aerodromes.find(a => a.id === 'HOME');
  const def = L.defOf(key);                     // the damage model ON (_treecrash_lib: damage unless `elastic`)
  const tag = 'fly:' + key + (persona ? '/' + persona : '') + ': ';
  const { sim, pose, site } = startAt(def, W, H);
  const ap = C.makePilot(sim, def, W, persona ? { profile: persona } : {});
  if (persona) check(ap.profile && ap.profile !== 'expert', tag + 'the persona flies (' + ap.profile + ')', ap.profile);
  const tolH = persona ? 25 : 15;
  ap.departFrom(H, H, site, { atHold: pose });
  const R = gateRoute(W, end), perf = ap.routePerf();
  const prof = C.routeProfile(R, W, { perf, from: { x: H.x, z: H.z, h: H.elev } });
  check(prof.ok, tag + 'the drawn profile is clean for this aeroplane (no conflict, no point it cannot make)', prof.warnings.join('; ') || 'min clearance ' + prof.minClr.toFixed(0) + ' m, vs ' + prof.pts.map(p => p.vs.toFixed(1)).join(' '));
  const flown = doctor && doctor.flown ? doctor.flown(R) : R;
  const how = ap.flyRoute(flown);
  check(how === 'armed' && ap.drawn && ap.drawn.state === 'armed', tag + 'drawn on the ground, the route is armed', how);
  const capR = R.pts.map((_, i) => C.routeCaptureR(R, i, perf));
  const best = R.pts.map(() => ({ d: Infinity, dh: null, t: null }));
  const hB = R.pts.map(p => C.routeAltMSL(p, W));
  const da = revCounter(), dr = revCounter();
  let vsEntry = -Infinity, routeSteps = 0, startT = null, endT = null, aglMin = Infinity, vsAskBad = 0, vsFlyBad = 0, vsWorst = 0, pubBad = 0, holdT = 0, holdHmax = 0, holdRmax = 0;
  const vsWin = []; let vsSum = 0;
  const phases = []; let last = null, s = 0;
  const maxS = end === 'hold' ? 1400 : 1700;
  for (; s < maxS * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase !== last) { phases.push(ap.phase); last = ap.phase; }
    const c = sim.cgPos(), v = sim.cgVel(), I = ap.intent;
    if (I.phase === 'ROUTE') {
      if (startT == null) startT = ap.t;
      routeSteps++;
      da.step(sim.ctl.da || 0); dr.step(sim.ctl.dr || 0);
      const g = C.routeGroundAt(W, c[0], c[2], false); aglMin = Math.min(aglMin, c[1] - g);
      if (I.vsCmd != null && (I.vsCmd > I.vsUp + 1e-9 || I.vsCmd < I.vsDn - 1e-9)) vsAskBad++;
      vsWin.push(v[1]); vsSum += v[1]; if (vsWin.length > 60) vsSum -= vsWin.shift();
      // (judged from 10 s after the hand-over: the climb-out's own climb arrives with it - train 40's take-off climb on
      // speed, at Vx, decelerating, read +3.7 m/s against the steady 2.97 for 2.5 s on the Cub; logged as `entry`)
      if (vsWin.length === 60) { const m = vsSum / 60, out = Math.max(m - I.vsUp, I.vsDn - m) - 0.5;
        if (ap.t - startT < 10) vsEntry = Math.max(vsEntry, out + 0.5);
        else if (out > 0) { vsFlyBad++; vsWorst = Math.max(vsWorst, out + 0.5); } }
      const Lg = I.legs && I.legs[I.legI];
      if (I.route !== ap.drawn || !Lg || I.to !== Lg.name || !(Math.abs(I.h - ap.afcs.sel.alt) < 1e-6)) pubBad++;
    } else if (startT != null && endT == null) endT = ap.t;
    if (startT != null) for (let i = 0; i < best.length; i++) {
      const d = Math.hypot(R.pts[i].x - c[0], R.pts[i].z - c[2]);
      if (d < best[i].d) { best[i].d = d; best[i].dh = c[1] - hB[i]; best[i].t = ap.t; }
    }
    if (ap.phase === 'LOITER') {
      holdT += 1 / 60;
      const Hd = ap.drawn.hold;
      if (holdT > 60) { holdHmax = Math.max(holdHmax, Math.abs(c[1] - Hd.h)); holdRmax = Math.max(holdRmax, Math.abs(Math.hypot(c[0] - Hd.x, c[2] - Hd.z) - Hd.R)); }
      if (holdT > 150) break;
    }
    if (!L.finite(sim)) break;
    if (ap.phase === 'STOPPED' && ap.t > 3) break;
    const o = ap.report && ap.report.outcome;
    if (o && o !== 'completed') break;
    if (sim.damage && sim.damage().crashed) break;
  }
  const verdicts = (ap.report && ap.report.verdicts) || [];
  const vsay = () => verdicts.map(q => q.t + ' ' + q.code + ': ' + q.note).join(' / ');
  check(startT != null && phases.indexOf('ROUTE') > phases.indexOf('CLIMB') && phases.indexOf('CLIMB') > 0, tag + 'the climb-out hands over to the drawn route', phases.join('>'));
  for (let i = 0; i < best.length; i++) {
    const b = best[i];
    check(b.d <= capR[i], tag + 'WP' + (i + 1) + ' captured inside ' + capR[i].toFixed(0) + ' m', b.d.toFixed(0) + ' m at t=' + (b.t == null ? '-' : b.t.toFixed(0)));
    check(b.dh != null && Math.abs(b.dh) <= tolH, tag + 'WP' + (i + 1) + ' at ' + hB[i].toFixed(0) + ' m +-' + tolH, b.dh == null ? 'never' : (b.dh >= 0 ? '+' : '') + b.dh.toFixed(1) + ' m');
    log(tag + 'WP' + (i + 1) + ' ' + b.d.toFixed(0) + ' m of ' + capR[i].toFixed(0) + ', ' + (b.dh == null ? '-' : (b.dh >= 0 ? '+' : '') + b.dh.toFixed(1)) + ' m');
  }
  check(vsAskBad === 0, tag + 'the vertical speed asked stays inside the published limits', vsAskBad + ' of ' + routeSteps + ' steps outside');
  if (!persona) check(vsFlyBad === 0, tag + 'the vertical speed flown stays inside them (1 s mean, +-0.5 m/s)', (vsFlyBad / 60).toFixed(1) + ' s outside (' + vsFlyBad + ' steps), worst ' + vsWorst.toFixed(2) + ' m/s past');
  check(aglMin >= 40 && !verdicts.some(q => q.code === 'terrain-react'), tag + 'no terrain conflict on the route (>= 40 m over the ground, no floor flown)', 'min ' + aglMin.toFixed(0) + ' m over the ground');
  const mins = Math.max(0.5, routeSteps / 3600), rA = da.n / mins, rR = dr.n / mins;
  if (!persona) check(Math.max(rA, rR) <= ACT_LIMIT.legs, tag + 'the hands: reversals on the route under PILOTACT\'s ' + ACT_LIMIT.legs + '/min', 'da ' + rA.toFixed(1) + ' dr ' + rR.toFixed(1) + ' /min over ' + (routeSteps / 60).toFixed(0) + ' s');
  check(routeSteps > 0 && pubBad === 0, tag + 'the plan published: the route state, the active point, the height asked', pubBad + ' of ' + routeSteps + ' steps wrong');
  check(ap.drawn && ap.drawn.cap.every((q, i) => Math.abs(q.d - best[i].d) < 40), tag + 'the pilot\'s own captures agree with the trace', ap.drawn ? ap.drawn.cap.map(q => q.d.toFixed(0)).join(' ') : '-');
  const crashed = sim.damage && sim.damage().crashed;
  if (end === 'hold') {
    check(ap.phase === 'LOITER' && holdT > 150 && !crashed, tag + 'the end: holding over WP5', ap.phase + ' ' + holdT.toFixed(0) + ' s | ' + vsay());
    check(holdHmax <= 15 && holdRmax <= 80, tag + 'the hold flies the last point\'s altitude (+-15 m) on its circle (+-80 m)', holdHmax.toFixed(1) + ' m, ' + holdRmax.toFixed(0) + ' m off the circle');
  } else {
    const c = sim.cgPos(), w = C.flightWhere(W, c[0], c[2], {});
    const want = end === 'home' ? 'HOME' : ap.route.to && ap.route.to.id;
    check(ap.report.outcome === 'completed' && ap.phase === 'STOPPED' && w.id === want && !crashed, tag + 'the end (' + end + '): landed and stopped on ' + want,
          (ap.report.outcome || '-') + ' ' + ap.phase + ' ' + w.kind + ' ' + w.id + ' after ' + (s / 60).toFixed(0) + ' s: ' + phases.join('>') + ' | ' + vsay());
    if (end === 'land') {
      let near = null, nd = Infinity; const z = R.pts[R.pts.length - 1];
      const need = Math.max(350, 1.4 * ((ap.sheet && ap.sheet.LDGrun) || 0));
      for (const a of W.aerodromes) { if (a.kind === 'meadow' || !(a.len >= need) || !C.stripAllows(ap.gear, a).ok) continue; const d = Math.hypot(a.x - z.x, a.z - z.z); if (d < nd) { nd = d; near = a; } }
      check(near && want === near.id, tag + 'the nearest strip it lands on', want + ' vs ' + (near && near.id));
    }
  }
  log(tag + phases.join('>') + ' in ' + (s / 60).toFixed(0) + ' s; vs flown outside ' + (vsFlyBad / 60).toFixed(1) + ' s (worst ' + vsWorst.toFixed(2) + ', the hand-over\'s first 10 s ' + vsEntry.toFixed(2) + ' m/s past); route ' + (startT || 0).toFixed(0) + '-' + (endT || 0).toFixed(0) + ' s, min ' + aglMin.toFixed(0) + ' m agl, reversals ' + rA.toFixed(1) + '/' + rR.toFixed(1));
}

const CASES = [
  { id: 'fly:cub', run: (c, d) => flight('cub', 'home', c, d) },
  { id: 'fly:jodel', run: (c, d) => flight('jodel', 'hold', c, d) },
  { id: 'fly:metal', run: (c, d) => flight('metal', 'land', c, d) },
  // G2085 PILOT-PERSONA (train 40): the same route by the Cub's three people (A0: "build your laws as the expert
  // baseline that the persona traits act on top of")
  { id: 'persona:club', run: (c, d) => flight('cub', 'home', c, d, 'club') },
  { id: 'persona:student', run: (c, d) => flight('cub', 'home', c, d, 'student') },
  { id: 'persona:hamfist', run: (c, d) => flight('cub', 'home', c, d, 'hamfist') },
];

function battery(doctor, only) {
  only = only || ONLY;
  const fail = [];
  const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null && extra !== '' ? ' - ' + extra : '')); if (SHOW && ok) console.log('  ok   ' + label + (extra ? '  (' + extra + ')' : '')); return ok; };
  if (SH.first && (!only || only.includes('model'))) {
    const n0 = fail.length;
    try { model(check, doctor); } catch (e) { check(false, 'model threw', e.stack.split('\n').slice(0, 3).join(' | ')); }
    try { drawing(check, doctor); } catch (e) { check(false, 'the drawing threw', e.stack.split('\n').slice(0, 3).join(' | ')); }
    console.log('  model: ' + (fail.length === n0 ? 'ok' : (fail.length - n0) + ' failed'));
  }
  for (const K of CASES) {
    if (!SH.take()) continue;
    if (only && !only.includes(K.id)) continue;
    const t0 = Date.now(), n0 = fail.length;
    try { K.run(check, doctor); } catch (e) { check(false, K.id + ' threw', e.stack.split('\n').slice(0, 3).join(' | ')); }
    console.log('  ' + K.id + ': ' + (fail.length === n0 ? 'ok' : (fail.length - n0) + ' failed') + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)' + SH.tag);
  }
  return fail;
}

if (SELF) {
  // the negatives: (1) a profile that never judges the ground (the hill and the steep point must go red);
  // (2) a pilot handed the route with every altitude 60 m higher than drawn (the +-15 m check must go red)
  const neg = battery({
    profile: (R, W, perf) => { const P = C.routeProfile(R, W, { perf, from: null }); P.unsafe = false; P.conflicts = []; P.steep = []; P.ok = true; P.warnings = []; P.pts.forEach(p => { p.ok = true; p.why = ''; }); P.minClr = 999; return P; },
    flown: R => Object.assign({}, R, { pts: R.pts.map(p => Object.assign({}, p, { alt: p.alt + 60 })) }),
  }, ONLY || ['model', 'fly:cub']);
  const caught = ['under a hill is red', 'too steep', 'm +-15'].filter(k => neg.some(f => f.includes(k)));
  console.log('selftest: ' + neg.length + ' failures under the doctored profile / pilot; caught: ' + caught.join(', '));
  const ok = caught.length === 3;
  console.log('GATE ROUTE: ' + (ok ? 'PASS' : 'FAIL') + ' (selftest)');
  process.exit(ok ? 0 : 1);
}
const t0 = Date.now();
const fail = battery(null);
for (const f of fail) console.log('  FAIL ' + f);
console.log('ROUTE: ' + fail.length + ' failure(s), ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s' + SH.tag);
console.log('GATE ROUTE: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
