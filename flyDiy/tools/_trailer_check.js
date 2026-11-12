#!/usr/bin/env node
// GATE TRAILER (TOW-LAUNCH phase 4, 2026-11-12) - FLOATPLANES AND FLYING BOATS LAUNCHED FROM A TRAILER behind the car down
// Jolene AFB's 13/31 (2325 m, paved): src/vehicle/trailer.js (the cradle fitted to the build's keels, the trailer behind
// the Conquer's ball, its loads back to the car as car.extF; the bunks push up only, the latch opens when the wing
// carries the weight - the glider study's probe_trailer, made a module) and src/vehicle/trailer_model.js (the trailer
// drawn). The floatplane is the Twin-582 floatplane archetype; the flying boat the classic-V hull with a pylon O-540 off
// the Cessna-on-floats build (tools/fixtures/trailer_hull_classic_pylon.json: `node tools/hull_matrix.js
// --one=classic:pylon --fitonly --save=...`, the hull fit's cycle), each flown by trailer.js's hands (the page's player
// flies himself).
//   FIT     the floatplane on its trailer at rest: a pad under each float's keel fore and aft, the cradle's attitude,
//           the bunks carrying the weight, their give, the tongue's share at the ball, the nose clear of the car
//   FLOATS  the floatplane's launch: the latch opens when the wing carries it, it flies off and climbs; the car stops
//           on the runway
//   HULL    the flying boat's: a keel and its chines on the bunks; the same launch
//   HOLD    the floatplane at idle, the car short of its rotation speed: no lift-off - the car gives up 20 s on and
//           stops, the plane still on its bunks (the bunks and the latch hold it through the run and the braking)
//   PERF    the cradle's cost on the aeroplane's frame; the trailer's own a frame
//   MODEL   the trailer's model in node (three.js): its triangles, draw calls, materials, its size; the build's time
//   PAGE    drive_mode.js run in node on the island (three.js, the lazy modules as the page loads them): the drive
//           mode, the glider tow and the trailer each started, stepped, drawn, worded and stopped - and app.js's wiring
// ~3 min. node tools/_trailer_check.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
{ const T = __dirname, src = fs.readFileSync(path.join(__dirname, 'arch_fly.js'), 'utf8');
  eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(__dirname)).replace('function loadPanel()', 'global.loadPanel = function ()')); global.loadPanel(); void T; }
const DS = require('./_cage_design.js'), C = require('./flight_core.js'), IN = require('./island_node.js');
const V = require(path.join(ROOT, 'src/vehicle/vehicle.js')), Dr = require(path.join(ROOT, 'src/vehicle/vehicle_drive.js'));
const VI = require(path.join(ROOT, 'src/vehicle/vehicle_island.js')), TRL = require(path.join(ROOT, 'src/vehicle/trailer.js'));
const SHEET = require(path.join(ROOT, 'src/cars/car_conquer.json'));
let fails = 0;
const row = (id, ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + id.padEnd(8) + ' ' + msg); if (!ok) fails++; };
const f = (x, n = 1) => (+x).toFixed(n);

const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') });
const st = C.siteOf('HOME').stand;
const I = VI.vehIslandFromWorld(W, { siteOf: C.siteOf, fieldName: C.fieldName, town: null, from: [st.x, st.z] });
const G = Dr.vehRoadGraph(I.spec);
const aH = W.aerodromes.find(a => a.id === 'HOME');
const P0 = G.places['rwy:HOME:0'], P1 = G.places['rwy:HOME:1'];
const dl = Math.hypot(P1.x - P0.x, P1.z - P0.z), dx = (P1.x - P0.x) / dl, dz = (P1.z - P0.z) / dl, hdg = Math.atan2(dz, dx);
const A = DS.ARCHETYPES.find(x => x.key === 'floatplane');
const DEF = { floats: C.buildGen(DS.designBake(A.sel, A.over)),
              hull: C.buildGen(C.genMigrateSpec(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'trailer_hull_classic_pylon.json'), 'utf8')).spec)) };

// the rig at runway 13's end: the car 14 m in, the aeroplane settled on its keels behind it, then seated on the trailer
function rig(which, o) {
  o = o || {};
  const def = DEF[which], sim = C.makeSim(def, W); sim.reset(0);
  const car = V.makeVehicle(V.vehicleDef(SHEET), W);
  car.place(P0.x + dx * 14, P0.z + dz * 14, hdg); for (let i = 0; i < 30; i++) car.step(1 / 60);
  C.placeAtLineup(sim, aH, { x: P0.x - dx * 6, z: P0.z - dz * 6, hdg }, W, def.refs); for (let i = 0; i < 90; i++) sim.step(1 / 60);
  const L = TRL.makeTrailerLaunch(sim, car, W, Object.assign({ def }, o.launch || {}));
  return { def, sim, car, L };
}
// a run: o { T (s), idle (no power, the stick neutral), go (s: the car sets off) }
function run(which, o) {
  o = Object.assign({ T: 60, go: 2 }, o || {});
  const R = rig(which, o), { sim, car, L } = R;
  const D = Dr.makeDriver(car, G, { vCruise: L.vCar });
  const hands = TRL.makeTrailerHands(sim, L);
  const out = { R, open: null, clear: null, abort: null, maxH: 0, bad: false, soft: 0, ballMax: 0, keelMax: -1, loadEnd: null, carEnd: null, msP: 0, msT: 0, n: 0, rest: null };
  const dt = 1 / 60; let started = false;
  for (let fr = 0; fr < o.T * 60; fr++) {
    const t = fr * dt;
    if (!started && t >= o.go) { started = true; out.a0 = D.setDest('rwy:HOME:1'); }
    if (started && !o.idle) hands(); else { sim.ctl.thr = 0; sim.ctl.de = 0; }
    L.before();
    const a = process.hrtime.bigint(); sim.step(dt); out.msP += Number(process.hrtime.bigint() - a) / 1e6; out.n++;
    L.after(dt);
    if (started) D.step(dt); else { car.ctl.thr = 0; car.ctl.brake = 1; }
    L.carCtl(car);
    const b = process.hrtime.bigint(); car.step(dt); L.carAfter(dt); out.msT += Number(process.hrtime.bigint() - b) / 1e6;
    if (sim.stats().bad) { out.bad = true; break; }
    const cg = sim.cgPos(), cv = sim.cgVel(), Vg = Math.hypot(cv[0], cv[1], cv[2]), agl = cg[1] - W.terrainH(cg[0], cg[2]);
    out.maxH = Math.max(out.maxH, agl);
    if (t > o.go + 1) out.ballMax = Math.max(out.ballMax, Math.hypot(...L.trailer.Hb));
    if (L.phase === 'loaded' || o.idle) out.keelMax = Math.max(out.keelMax, L.keelUp);
    if (t < o.go && fr > 60) out.rest = { load: L.cradle.loadAvg, keel: L.keelUp, ball: L.trailer.Hb.slice(), pitch: Math.asin(-sim.axes()[0][1]) * 57.3, latched: L.cradle.latched };
    if (!out.open && L.phase !== 'loaded' && L.phase !== 'abort') out.open = { t: t - o.go, V: Vg, why: L.cradle.opened, x: Math.hypot(cg[0] - P0.x, cg[2] - P0.z), vRot: L.vRot };
    if (!out.clear && L.phase === 'clear') out.clear = { t: t - o.go, agl };
    if (!out.abort && L.phase === 'abort') out.abort = { t: t - o.go, why: L.why };
    if (fr % 15 === 0) for (const c of car.footprint()) { const sf = W.surface(c[0], c[1]); if (sf !== 5 && sf !== 6) out.soft++; }
  }
  out.loadEnd = L.cradle.loadAvg; out.keelEnd = L.keelUp; out.carEnd = car.out.u;
  { const cp = car.refPoint(); out.carX = (cp[0] - P0.x) * dx + (cp[2] - P0.z) * dz; }
  return out;
}

// ---- FIT ----
let FL = null;
{
  const R = run('floats', { T: 4, go: 99 }), L = R.R.L, fit = L.fit, Wt = R.R.sim.totalM * 9.81;
  const keels = fit.pads.filter(p => p.kind === 'keel'), sides = new Set(keels.map(p => p.float));
  const tongue = -R.rest.ball[1] / ((L.trailer.m + R.R.sim.totalM) * 9.81);
  const ok = fit.kind === 'floats' && keels.length === 4 && sides.size === 2 && Math.abs(fit.pitch - 6) < 1e-9 && R.rest && R.rest.latched &&
    Math.abs(R.rest.load - 1) < 0.06 && R.rest.keel < 0 && R.rest.keel > -0.035 && tongue > 0.04 && tongue < 0.15 && fit.Ld - fit.front >= 1.0 && !R.bad;
  row('FIT', ok, 'the floatplane (' + f(R.R.sim.totalM, 0) + ' kg) at rest on its trailer: ' + keels.length + ' pads on ' + sides.size + ' float keels (fore and aft of the step, ' + f(Math.abs(keels[0].at[2]), 2) + ' m out), the cradle ' + fit.pitch + ' deg nose-up; ' +
    'the bunks carry ' + f(R.rest.load * 100, 0) + ' % of the weight, give ' + f(-R.rest.keel * 100, 1) + ' cm; the ball ' + f(-R.rest.ball[1], 0) + ' N down (' + f(tongue * 100, 1) + ' % of the train behind it); the nose ' + f(fit.Ld - fit.front, 2) + ' m behind the ball; the latch ' + (R.rest.latched ? 'shut' : 'OPEN'));
  void Wt;
}
// ---- FLOATS ----
{
  const R = FL = run('floats', { T: 50 });
  const o = R.open, ok = !R.bad && o && /wing carries it/.test(o.why || '') && o.V > 1.0 * o.vRot && o.V < 1.7 * o.vRot && o.x < 450 && R.clear && R.maxH > 100 &&
    Math.abs(R.carEnd) < 0.5 && R.soft === 0 && R.ballMax < 5000 && R.carX < dl - 50;
  row('FLOATS', ok, 'the floatplane down 13/31 behind the Conquer (to ' + Math.round(R.R.L.vCar * 3.6) + ' km/h, 1.6 VRot): the latch open ' + (o ? f(o.t) + ' s on at ' + f(o.V) + ' m/s (' + f(o.V / o.vRot, 2) + ' VRot), ' + f(o.x, 0) + ' m down the runway - ' + o.why : 'NEVER') +
    '; off the bunks ' + (R.clear ? f(R.clear.t) + ' s' : 'NEVER') + '; ' + f(R.maxH, 0) + ' m up at 48 s; the car stopped ' + f(R.carX, 0) + ' m down the runway (of ' + f(dl, 0) + '), on it (' + R.soft + ' samples off), the ball ' + f(R.ballMax / 1000, 2) + ' kN at most');
}
// ---- HULL ----
{
  const R = run('hull', { T: 55 }), o = R.open, fit = R.R.L.fit;
  const nK = fit.pads.filter(p => p.kind === 'keel').length, nC = fit.pads.filter(p => p.kind === 'chine').length;
  const ok = !R.bad && fit.kind === 'hull' && nK === 2 && nC === 4 && o && /wing carries it/.test(o.why || '') && o.x < 900 && R.clear && R.maxH > 30 && Math.abs(R.carEnd) < 0.5 && R.soft === 0 && R.carX < dl - 50;
  row('HULL', ok, 'the classic-V flying boat (' + f(R.R.sim.totalM, 0) + ' kg, a pylon O-540): ' + nK + ' keel pads (rollers), ' + nC + ' chine pads (bunks); the latch open ' + (o ? f(o.t) + ' s on at ' + f(o.V) + ' m/s (' + f(o.V / o.vRot, 2) + ' VRot), ' + f(o.x, 0) + ' m down' : 'NEVER') +
    '; off the bunks ' + (R.clear ? f(R.clear.t) + ' s' : 'NEVER') + ', ' + f(R.maxH, 0) + ' m up; the car stopped ' + f(R.carX, 0) + ' m down the runway (' + R.soft + ' samples off)');
}
// ---- HOLD ----
{
  const R = run('floats', { T: 70, idle: true, launch: { vCar: 15 } });
  const ok = !R.bad && R.abort && !R.open && R.keelMax < 0.03 && Math.abs(R.loadEnd - 1) < 0.08 && Math.abs(R.carEnd) < 0.3 && R.soft === 0;
  row('HOLD', ok, 'the floatplane at idle, the car at 54 km/h (under its 1.05 VRot): ' + (R.abort ? 'the run abandoned ' + f(R.abort.t, 0) + ' s on - ' + R.abort.why : 'NOT abandoned') + '; the latch ' + (R.open ? 'OPENED' : 'shut') +
    '; the keel ' + f(R.keelMax * 100, 1) + ' cm over its bunks at most; at the end the car at ' + f(R.carEnd, 2) + ' m/s, the bunks carrying ' + f(R.loadEnd * 100, 0) + ' %');
}
// ---- PERF: the aeroplane's frame on the trailer (the cradle) against standing on the runway ----
{
  const R = rig('floats'); const { sim, L, car } = R;
  let a = 0, b = 0, tr = 0; const n = 240;
  for (let i = 0; i < n; i++) { L.before(); const t0 = process.hrtime.bigint(); sim.step(1 / 60); a += Number(process.hrtime.bigint() - t0) / 1e6; L.after(1 / 60);
    car.ctl.brake = 1; car.step(1 / 60); const t1 = process.hrtime.bigint(); L.carAfter(1 / 60); tr += Number(process.hrtime.bigint() - t1) / 1e6; }
  const sim2 = C.makeSim(DEF.floats, W); sim2.reset(0); C.placeAtLineup(sim2, aH, { x: P0.x - dx * 6, z: P0.z - dz * 6, hdg }, W, DEF.floats.refs);
  for (let i = 0; i < 60; i++) sim2.step(1 / 60);
  for (let i = 0; i < n; i++) { const t0 = process.hrtime.bigint(); sim2.step(1 / 60); b += Number(process.hrtime.bigint() - t0) / 1e6; }
  a /= n; b /= n; tr /= n;
  row('PERF', a < b * 1.5 + 0.5 && tr < 0.05, 'the floatplane\'s frame ' + f(b, 3) + ' ms on the runway, ' + f(a, 3) + ' ms on its trailer (the cradle: ' + L.fit.pads.length + ' pads a substep, ' + (sim.p ? '' : '') + 'their impulses); the trailer\'s pose and loads ' + f(tr * 1000, 1) + ' us a frame; the car 0.1 ms (GATE DRIVE-TRIP); the run\'s ' + f(FL.msT / FL.n, 3) + ' ms car + trailer');
}
// ---- MODEL ----
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const TM = require(path.join(ROOT, 'src/vehicle/trailer_model.js'));
{
  const out = [];
  let ok = true;
  for (const which of ['floats', 'hull']) {
    const R = rig(which), t0 = Date.now(), M = TM.buildTrailerModel(THREE, R.L.trailer), ms = Date.now() - t0;
    M.update(R.L.trailer, true);
    const box = new THREE.Box3().setFromObject(M.group);
    const s = M.stats, len = s.x[1] - s.x[0];
    ok = ok && s.tris < 40000 && s.draws <= 18 && s.width < 2.6 && Math.abs(s.x[1] - R.L.fit.Ld) < 0.1 && ms < 400 && M.strap && box.isEmpty() === false;
    out.push(which + ': ' + s.tris + ' triangles, ' + s.draws + ' draw calls (' + s.materials + ' materials + the wheels instanced x5), ' + f(len, 2) + ' x ' + f(s.width, 2) + ' m, built in ' + ms + ' ms');
  }
  const H = TM.buildTowHitch(THREE);
  row('MODEL', ok && H.children.length >= 4, 'the trailer\'s model (three.js r' + THREE.REVISION + ' in node) - ' + out.join('; ') + '; the car\'s ball mount ' + H.children.length + ' parts');
}
// ---- PAGE: drive_mode.js run in node on the island ----
{
  const errs = [], did = [];
  try {
    // the page's globals: the lazy modules as the page loads them (top-level functions), the core's, a DOM's few
    Object.assign(global, V, Dr, VI, TRL, TM, require(path.join(ROOT, 'src/vehicle/tow.js')));
    global.THREE = THREE; global.placeAtLineup = C.placeAtLineup; global.siteOf = C.siteOf; global.fieldName = C.fieldName;
    global.window = global.window || {}; global.location = { search: '' };
    global.document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, body: { classList: { add() {}, remove() {} } } };
    global.performance = global.performance || { now: () => Date.now() };
    global.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(SHEET)) });
    delete require.cache[require.resolve(path.join(ROOT, 'src/viewer/drive_mode.js'))];
    require(path.join(ROOT, 'src/viewer/drive_mode.js'));
    const DM = global.window.DRIVE_MODE, scene = new THREE.Scene();
    (async () => {
      // the drive mode
      await DM.enter({ THREE, scene, world: W, at: [st.x, 0, st.z] }); for (let i = 0; i < 30; i++) DM.frame(1); DM.words(); DM.trip(); DM.choices(); DM.leave(); did.push('drive');
      // the glider tow
      const gA = DS.ARCHETYPES.find(x => x.key === 'motorglider'), gD = C.buildGen(DS.designBake(gA.sel, gA.over)), gs = C.makeSim(gD, W); gs.reset(0);
      C.placeAtLineup(gs, aH, { x: P0.x, z: P0.z, hdg }, W, gD.refs); for (let i = 0; i < 60; i++) gs.step(1 / 60);
      await DM.towStart({ THREE, scene, world: W, sim: gs }); DM.tow.start();
      for (let i = 0; i < 30; i++) { DM.towPre(); gs.step(1 / 60); DM.towPost(1 / 60); DM.towDraw(); } DM.towWords(); DM.towStop(); did.push('tow');
      // the trailer
      const ts = C.makeSim(DEF.floats, W); ts.reset(0);
      await DM.trailerStart({ THREE, scene, world: W, sim: ts, def: DEF.floats }); const w0 = DM.towWords(); DM.tow.start();
      for (let i = 0; i < 60; i++) { DM.towPre(); ts.step(1 / 60); DM.towPost(1 / 60); DM.towDraw(); }
      const w1 = DM.towWords(), inScene = !!scene.getObjectByName('trailer'), hitch = !!scene.getObjectByName('car:hitch');
      DM.towStop(); did.push('trailer'); did.push(w0 && w1 && inScene && hitch && !scene.getObjectByName('trailer') ? 'drawn' : 'NOT DRAWN');
    })().then(finish, e => { errs.push(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)); finish(); });
  } catch (e) { errs.push(e && e.message); finish(); }
  function finish() {
    const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), B = require('./build.js'), lazy = B.MANIFEST.lazy.map(([d, f2]) => d + '/' + f2);
    const hooks = { wanted: /function trailerWanted\(\)/.test(APP), menu: /'Launch from the trailer'/.test(APP), inline: /FLYDIY_TOW_WANTED = \(\) => towWanted\(\) \|\| trailerWanted\(\)/.test(APP),
      lazy: /'trailer', 'trailer_model', 'drive_mode'/.test(APP), start: /DRIVE_MODE\.trailerStart\(/.test(APP), plate: /'trailer launch'/.test(APP) };
    const miss = Object.keys(hooks).filter(k => !hooks[k]);
    const okL = lazy.includes('src/vehicle/trailer.js') && lazy.includes('src/vehicle/trailer_model.js') && !B.MANIFEST.core.some(n => /trailer/.test(n));
    row('PAGE', !errs.length && did.join(',') === 'drive,tow,trailer,drawn' && !miss.length && okL,
      'drive_mode.js in node on the island: ' + (did.join(', ') || 'nothing') + (errs.length ? ' - THREW: ' + errs.join('; ') : '') + '; app.js ' + (Object.keys(hooks).length - miss.length) + ' of ' + Object.keys(hooks).length +
      ' (the menu row, ?trailer=1, inline, the lazy fetch, the plate)' + (miss.length ? ' MISSING: ' + miss.join(', ') : '') + '; trailer.js, trailer_model.js lazy' + (okL ? '' : ' - NOT'));
    console.log('GATE TRAILER: ' + (fails ? 'FAIL' : 'PASS'));
    process.exit(fails ? 1 : 0);
  }
}
