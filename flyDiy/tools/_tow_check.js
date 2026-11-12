#!/usr/bin/env node
// GATE TOW (TOW-LAUNCH phase 3, 2026-11-12) - THE GLIDER AUTO-TOW behind the car down Jolene AFB's 13/31 (2325 m, paved).
// src/vehicle/tow.js's line (tension-only, through the solver's own sim.onSubstep + sim.impulse: no solver change) between
// the Conquer's hitch (vehicle.js, its pull back as car.extF) and the glider's nose hook; the car driven by its AI
// (vehicle_drive.js) down the runway's road (vehicle_island.js) at the tow speed; the glider the MOTORGLIDER archetype with
// its engine switched off (sim.setEngine(0, { key: 'off' }), GATE SOAR's way - the Archaeopteryx card, on its own branch,
// drops in when it lands: the hook is found off any build), flown by tow.js's hands (the page's player flies it himself).
//   LAUNCH  lined up at runway 13's end, 400 m of line, the car at 28 m/s: lift-off, the climb, the release at the top
//   GLIDE   after the release the glider flies on: 15 s, wings level, the speed held
//   RELEASE the pilot's key at 100 m: the line off at once, the car's pull gone
//   WEAK    a weak link of 1.2 kN: it breaks in the roll's snatch, said so - never a glider dragged past its link
//   PERF    the line's cost a frame (the aeroplane's frame with it against without it)
// ~2 min. node tools/_tow_check.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
// the archetypes' panel (tools/arch_fly.js's loader: the gates and the probes build an archetype card this way)
{ const T = __dirname, src = fs.readFileSync(path.join(__dirname, 'arch_fly.js'), 'utf8');
  eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(__dirname)).replace('function loadPanel()', 'global.loadPanel = function ()')); global.loadPanel(); }
const DS = require('./_cage_design.js'), C = require('./flight_core.js'), IN = require('./island_node.js');
const V = require(path.join(ROOT, 'src/vehicle/vehicle.js')), Dr = require(path.join(ROOT, 'src/vehicle/vehicle_drive.js'));
const VI = require(path.join(ROOT, 'src/vehicle/vehicle_island.js')), TW = require(path.join(ROOT, 'src/vehicle/tow.js'));
const SHEET = require(path.join(ROOT, 'src/cars/car_conquer.json'));
let fails = 0;
const row = (id, ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + id.padEnd(8) + ' ' + msg); if (!ok) fails++; };
const f = (x, n = 1) => (+x).toFixed(n);

const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') });
const st = C.siteOf('HOME').stand;
const I = VI.vehIslandFromWorld(W, { siteOf: C.siteOf, fieldName: C.fieldName, town: null, from: [st.x, st.z] });
const G = Dr.vehRoadGraph(I.spec);
const A = DS.ARCHETYPES.find(x => x.key === 'motorglider');
const def = C.buildGen(DS.designBake(A.sel, A.over));
const aH = W.aerodromes.find(a => a.id === 'HOME');
const P0 = G.places['rwy:HOME:0'], P1 = G.places['rwy:HOME:1'];
const dl = Math.hypot(P1.x - P0.x, P1.z - P0.z), dx = (P1.x - P0.x) / dl, dz = (P1.z - P0.z) / dl;

// one launch: the glider lined up on runway 13's end, the car L0 ahead; opts: { L0, Vtow, weak, releaseAt (m), T (s), noLine }
function launch(o) {
  o = Object.assign({ L0: 400, Vtow: 28, T: 150 }, o || {});
  const sim = C.makeSim(def, W); sim.reset(0);
  let hdg = Math.atan2(dz, dx);
  C.placeAtLineup(sim, aH, { x: P0.x, z: P0.z, hdg }, W, def.refs); for (let i = 0; i < 120; i++) sim.step(1 / 60);
  let xA = sim.axes()[0];
  if (-xA[0] * dx - xA[2] * dz < 0) { sim.reset(0); hdg += Math.PI; C.placeAtLineup(sim, aH, { x: P0.x, z: P0.z, hdg }, W, def.refs); for (let i = 0; i < 120; i++) sim.step(1 / 60); xA = sim.axes()[0]; }
  sim.setEngine(0, { key: 'off' });
  const hook = TW.towHookNodes(sim), hp = [0, 0];
  for (const i of hook) { hp[0] += sim.p[i * 3] / hook.length; hp[1] += sim.p[i * 3 + 2] / hook.length; }
  const car = V.makeVehicle(V.vehicleDef(SHEET), W), rear = car.def.foot.rear;
  car.place(hp[0] + dx * (o.L0 - 2 + rear), hp[1] + dz * (o.L0 - 2 + rear), Math.atan2(dz, dx)); for (let i = 0; i < 30; i++) car.step(1 / 60);
  const D = Dr.makeDriver(car, G, { vCruise: o.Vtow }); const a0 = D.setDest('rwy:HOME:1');
  const tow = o.noLine ? null : TW.makeTowLine(sim, car, { L0: o.L0, weak: o.weak, hook, groundAt: (x, z) => W.terrainH(x, z) });
  const hands = TW.makeTowHands(sim, { ground: W.terrainH(hp[0], hp[1]) });
  const R = { nose: -xA[0] * dx - xA[2] * dz, mass: sim.totalM, hook: hook.length, a0, lift: null, rel: null, relT: null, relH: null, relV: null, maxH: 0, bad: false, soft: 0,
              after: [], ms: 0, n: 0, car, tow, D };
  const dt = 1 / 60;
  for (let fr = 0, t = 0; fr < o.T * 60; fr++, t = fr * dt) {
    if (tow) tow.before();
    hands(tow, dt);
    const a = process.hrtime.bigint(); sim.step(dt); R.ms += Number(process.hrtime.bigint() - a) / 1e6; R.n++;
    if (tow) tow.after(dt);
    D.step(dt); car.step(dt);
    if (sim.stats().bad) { R.bad = true; break; }
    const cg = sim.cgPos(), cv = sim.cgVel(), agl = cg[1] - W.terrainH(cg[0], cg[2]), Vg = Math.hypot(cv[0], cv[1], cv[2]);
    R.maxH = Math.max(R.maxH, agl);
    if (R.lift === null && !sim.wheelsOnGround()) R.lift = { t, V: Vg, x: Math.hypot(cg[0] - P0.x, cg[2] - P0.z) };
    if (tow && o.releaseAt && tow.on && agl >= o.releaseAt) tow.release();
    if (tow && !tow.on && R.rel === null) { R.rel = tow.released; R.relT = t; R.relH = agl; R.relV = Vg; R.carU = car.out.u; R.extAfter = car.extF; }
    if (R.rel !== null) { const zR = sim.axes()[2]; R.after.push([t - R.relT, Vg, Math.abs(Math.asin(Math.max(-1, Math.min(1, zR[1]))) * 57.3), agl]); if (t - R.relT >= 15) break; }
    if (fr % 15 === 0) for (const c of car.footprint()) { const sf = W.surface(c[0], c[1]); if (sf !== 5 && sf !== 6) R.soft++; }
  }
  return R;
}

// ---- LAUNCH + GLIDE ----
const L = launch({});
{
  const ok = L.nose > 0.95 && L.a0 === 'replan' && !L.bad && L.lift && L.lift.t < 25 && L.rel && /top of the launch/.test(L.rel) && L.relH > 150 && L.tow.Tmax < L.tow.weak && L.soft === 0;
  row('LAUNCH', ok, 'the motorglider (engine off, ' + f(L.mass, 0) + ' kg; the hook ' + L.hook + ' nodes) on 400 m of line behind the Conquer at 28 m/s, Jolene AFB 13/31 from runway 13\'s end: ' +
    'lift-off ' + (L.lift ? f(L.lift.t) + ' s, ' + f(L.lift.V) + ' m/s, ' + f(L.lift.x, 0) + ' m down the runway' : 'NONE') + '; released at ' + (L.relH != null ? f(L.relH, 0) + ' m, ' + f(L.relT, 0) + ' s (' + L.rel + ')' : 'NEVER') +
    '; ' + f(L.maxH, 0) + ' m at most; the line ' + f(L.tow.Tmax / 1000, 2) + ' kN at most (weak link ' + f(L.tow.weak / 1000, 1) + ' kN, k ' + f(L.tow.k, 0) + ' N/m, c ' + f(L.tow.c, 0) + ' N s/m); the car on the runway (' + L.soft + ' corner samples off it)');
}
{
  const A2 = L.after, last = A2[A2.length - 1] || [0, 0, 0, 0], vMin = Math.min(...A2.map(a => a[1])), vMax = Math.max(...A2.map(a => a[1])), bMax = Math.max(...A2.map(a => a[2]));
  row('GLIDE', A2.length > 0 && last[0] >= 14.9 && vMin > 18 && vMax < 45 && bMax < 15 && last[3] > 100, 'released, 15 s gliding (tow.js\'s hands: wings level, the glide attitude): ' + f(vMin) + '-' + f(vMax) + ' m/s, bank ' + f(bMax) + ' deg at most, ' + f(last[3], 0) + ' m at the end');
}
// ---- RELEASE: the pilot's key at 100 m ----
{
  const R = launch({ releaseAt: 100, T: 90 });
  row('RELEASE', R.rel === 'released by the pilot' && Math.abs(R.relH - 100) < 6 && R.extAfter === null && !R.bad, 'the key at 100 m: off at ' + (R.relH != null ? f(R.relH) : '-') + ' m (' + R.rel + '); the car\'s pull ' + (R.extAfter === null ? 'gone' : 'STILL ON') + ', the car at ' + f(R.carU) + ' m/s');
}
// ---- WEAK: a 1.2 kN link breaks in the roll ----
{
  const R = launch({ weak: 1200, T: 60 });
  row('WEAK', /weak link/.test(R.rel || '') && R.relH < 20 && !R.bad, 'a 1.2 kN weak link: ' + (R.rel || 'NOT BROKEN') + ' at ' + (R.relT != null ? f(R.relT) + ' s, ' + f(R.relH) + ' m up' : '-') + ' - the glider let go, never dragged past its link');
}
// ---- PERF: the aeroplane's frame with the line and without ----
{
  const N = launch({ noLine: true, T: 20 }), Wl = launch({ T: 20 });
  const a = N.ms / N.n, b = Wl.ms / Wl.n;
  row('PERF', b < a * 1.5 + 0.3, 'the glider\'s frame ' + f(a, 3) + ' ms without the line, ' + f(b, 3) + ' ms with it (its per-substep pull: the solver\'s second loop and ' + L.hook + ' impulses a substep); the car 0.1 ms (GATE DRIVE-TRIP)');
}
// ---- PAGE: the tow's wiring by its source (the page rig: tools/drive_shot.js with ?tow=1) ----
{
  const B = require('./build.js'), lazy = B.MANIFEST.lazy.map(([d, f2]) => d + '/' + f2);
  const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), LINK = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'sim_link.js'), 'utf8'), DM = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'drive_mode.js'), 'utf8');
  const hooks = { wanted: /def\.params\.nEngines === 0/.test(APP) && /genSpec\.motorOff === true/.test(APP), lineup: /if \(skipAble\(\)\) skipToLineup\(\);/.test(APP),
    motorOff: /setEngine\(i, \{ key: 'off' \}\)/.test(APP), hands: /setManual\(true, 'tow'\)/.test(APP), step: /TWm\.towPre\(\)/.test(APP) && /TWm\.towPost\(1 \/ 60\)/.test(APP),
    inline: /FLYDIY_TOW_WANTED\(\)\) return 'the glider tow/.test(LINK), release: /e\.code === 'KeyR' && towOn\(\)/.test(APP), plate: /flNoticeK'\)\.textContent = 'glider tow'/.test(APP),
    restart: /T\.towStop\(\); TOWS\.busy = false/.test(APP), module: /DM\.towStart = async function/.test(DM) };
  const miss = Object.keys(hooks).filter(k => !hooks[k]);
  row('PAGE', lazy.includes('src/vehicle/tow.js') && !B.MANIFEST.core.some(n => /tow|vehicle/.test(n)) && !miss.length,
    'tow.js lazy (not in MANIFEST.core); app.js / sim_link.js / drive_mode.js: ' + (Object.keys(hooks).length - miss.length) + ' of ' + Object.keys(hooks).length + ' (an engineless build or a motor off -> lined up, motor off, by hand, the car and the line ahead; the flight inline; R or the plate; Restart lays it out again)' + (miss.length ? ' MISSING: ' + miss.join(', ') : ''));
}
console.log('GATE TOW: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
