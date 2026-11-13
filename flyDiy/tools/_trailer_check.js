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
//   AUTOPILOT the launch's hands, then the game's pilot re-engaged at CLIMB flies on (the page's handover)
//   JOINED  the floatplane as the game loads it (the garage's chain) seated: nothing breaks (the seat's frame square)
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
  { const d = sim.damage(); out.broken = d.broken.length; out.firstBreak = d.firstBreak; }
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
    Math.abs(R.carEnd) < 0.5 && R.soft === 0 && R.ballMax < 5000 && R.carX < dl - 50 && R.broken === 0;
  row('FLOATS', ok, 'the floatplane down 13/31 behind the Conquer (to ' + Math.round(R.R.L.vCar * 3.6) + ' km/h, 1.6 VRot): the latch open ' + (o ? f(o.t) + ' s on at ' + f(o.V) + ' m/s (' + f(o.V / o.vRot, 2) + ' VRot), ' + f(o.x, 0) + ' m down the runway - ' + o.why : 'NEVER') +
    '; off the bunks ' + (R.clear ? f(R.clear.t) + ' s' : 'NEVER') + '; ' + f(R.maxH, 0) + ' m up at 48 s; the car stopped ' + f(R.carX, 0) + ' m down the runway (of ' + f(dl, 0) + '), on it (' + R.soft + ' samples off), the ball ' + f(R.ballMax / 1000, 2) + ' kN at most');
}
// ---- HULL ----
{
  const R = run('hull', { T: 55 }), o = R.open, fit = R.R.L.fit;
  const nK = fit.pads.filter(p => p.kind === 'keel').length, nC = fit.pads.filter(p => p.kind === 'chine').length;
  const ok = !R.bad && fit.kind === 'hull' && nK === 2 && nC === 4 && o && /wing carries it/.test(o.why || '') && o.x < 900 && R.clear && R.maxH > 30 && Math.abs(R.carEnd) < 0.5 && R.soft === 0 && R.carX < dl - 50 && R.broken === 0;
  row('HULL', ok, 'the classic-V flying boat (' + f(R.R.sim.totalM, 0) + ' kg, a pylon O-540): ' + nK + ' keel pads (rollers), ' + nC + ' chine pads (bunks); the latch open ' + (o ? f(o.t) + ' s on at ' + f(o.V) + ' m/s (' + f(o.V / o.vRot, 2) + ' VRot), ' + f(o.x, 0) + ' m down' : 'NEVER') +
    '; off the bunks ' + (R.clear ? f(R.clear.t) + ' s' : 'NEVER') + ', ' + f(R.maxH, 0) + ' m up; the car stopped ' + f(R.carX, 0) + ' m down the runway (' + R.soft + ' samples off)');
}
// ---- HOLD ----
{
  const R = run('floats', { T: 70, idle: true, launch: { vCar: 15 } });
  const ok = !R.bad && R.abort && !R.open && R.keelMax < 0.03 && Math.abs(R.loadEnd - 1) < 0.08 && Math.abs(R.carEnd) < 0.3 && R.soft === 0 && R.broken === 0;
  row('HOLD', ok, 'the floatplane at idle, the car at 54 km/h (under its 1.05 VRot): ' + (R.abort ? 'the run abandoned ' + f(R.abort.t, 0) + ' s on - ' + R.abort.why : 'NOT abandoned') + '; the latch ' + (R.open ? 'OPENED' : 'shut') +
    '; the keel ' + f(R.keelMax * 100, 1) + ' cm over its bunks at most; at the end the car at ' + f(R.carEnd, 2) + ' m/s, the bunks carrying ' + f(R.loadEnd * 100, 0) + ' %');
}
// ---- JOINED: the floatplane as the GAME loads it (the garage's chain, _load_build.js gameSpecFull: the join measured) -
//      the page's build, not the card's: its solver axes are not square (the seat once sheared it - 20 members broken in
//      the page's first step on the bunks, found by the page rig, 12 Nov) ----
{
  const LB = require('./_load_build.js');
  const sp = LB.gameSpecFull({ spec: DS.designBake(A.sel, A.over) }).spec;
  DEF.joined = C.buildGen(C.genMigrateSpec(sp));
  const R = rig('joined'), { sim, car, L } = R;
  sim.stance && sim.stance();
  let keelMin = 0;
  for (let i = 0; i < 180; i++) { L.before(); sim.step(1 / 60); L.after(1 / 60); car.ctl.brake = 1; car.step(1 / 60); L.carAfter(1 / 60); keelMin = Math.min(keelMin, L.keelUp); }
  const d = sim.damage();
  row('JOINED', d.broken.length === 0 && !sim.stats().bad && Math.abs(L.cradle.loadAvg - 1) < 0.06 && keelMin > -0.04, 'the floatplane as the game loads it (the garage\'s chain), 3 s on its bunks: ' + d.broken.length + ' members broken' + (d.firstBreak ? ' (first: beam ' + d.firstBreak.beam + ', ' + d.firstBreak.cls + ', ' + d.firstBreak.how + ')' : '') + ', the bunks carry ' + f(L.cradle.loadAvg * 100, 0) + ' %, give ' + f(-keelMin * 100, 1) + ' cm');
}
// ---- AUTOPILOT: the page's way (app.js LAUNCH) - the launch's hands to clear of the bunks and 20 m up, then THE PILOT
//      (makePilot, the game's) re-engaged at CLIMB flies on: the user, 12 Nov, "the autopilot should be able to fly
//      everything" ----
{
  const R = rig('floats'), { sim, car, L } = R;
  const ap = C.makePilot(sim, DEF.floats, W); ap.setRoute(aH, aH);
  const D = Dr.makeDriver(car, G, { vCruise: L.vCar }), hands = TRL.makeTrailerHands(sim, L);
  let handed = null, bad = false, aglEnd = 0;
  for (let fr = 0; fr < 60 * 90; fr++) {
    const t = fr / 60; if (fr === 60) D.setDest('rwy:HOME:1');
    const cg = sim.cgPos(), agl = cg[1] - W.terrainH(cg[0], cg[2]);
    if (!handed && L.phase === 'clear' && agl > 20) { handed = { t, agl }; ap.reEngage({ phase: 'CLIMB' }); }
    if (handed) ap.update(1 / 60); else if (fr >= 60) hands();
    L.before(); sim.step(1 / 60); L.after(1 / 60); if (fr >= 60) D.step(1 / 60); L.carCtl(car); car.step(1 / 60); L.carAfter(1 / 60);
    if (sim.stats().bad) { bad = true; break; }
    aglEnd = agl;
  }
  const phases = (ap.report.phases || []).map(q => q.phase), water = (ap.report.verdicts || []).find(v => v.code === 'wrong-surface');
  row('AUTOPILOT', !bad && handed && handed.t < 30 && sim.damage().broken.length === 0 && aglEnd > 150 && !/STOPPED|ABORT/.test(ap.phase),
    'the floatplane launched by the autopilot: the launch\'s hands to ' + (handed ? f(handed.t) + ' s, ' + f(handed.agl, 0) + ' m up' : 'NEVER CLEAR') + ', then the pilot: ' + phases.join(' -> ') + ', ' + f(aglEnd, 0) + ' m up 90 s on' +
    (water ? '; it plans its landing on water (' + water.note + ')' : ''));
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
globalThis.AEROWX = require(path.join(ROOT, 'src/viewer/aeroweather.js'));   // (THE WEATHERING's grunge sheet: the planes' noise, as a DataTexture in node)
TM.trailerWeather(THREE);   // (the sheet made once, ~300 ms of noise in node - before the builds are timed; a page has the planes')
// (13 Nov, the user: "ensure there's no clipping of the arches through any wheels"): every vertex and triangle centre of the
// trailer's static parts against its own tyres' volume (within the tread's width, between the hub's 5 cm and the tyre's
// radius) and, on the car deck, against the carried car's tyres - the points inside, and where the worst one is
function clipsOf(M, car, deckY) {
  const S = M.stats, wheels = S.wheels.map(w => ({ c: w, r: S.wheelR, hw: S.wheelW / 2, r0: 0.05, who: 'its own' }));
  if (car) for (const [xa, tr] of [[car.xF, car.trackF || car.track], [car.xR, car.trackR || car.track]]) for (const sz of [-1, 1])
    wheels.push({ c: [xa, deckY + car.tyreR, sz * tr / 2], r: car.tyreR, hw: car.tyreW / 2, r0: 0, who: 'the car\'s' });
  let n = 0, worst = null;
  const test = (x, y, z, name) => { for (const w of wheels) { const dz = Math.abs(z - w.c[2]); if (dz >= w.hw - 0.004) continue;
    const r = Math.hypot(x - w.c[0], y - w.c[1]); if (r > w.r0 && r < w.r - 0.004) { n++; const d = w.r - r; if (!worst || d > worst.d) worst = { d, name, who: w.who }; } } };
  M.group.children.forEach(m => { if (!m.isMesh || m.isInstancedMesh) return; const P = m.geometry.attributes.position.array;
    for (let i = 0; i < P.length; i += 9) { for (let k = 0; k < 9; k += 3) test(P[i + k], P[i + k + 1], P[i + k + 2], m.name);
      test((P[i] + P[i + 3] + P[i + 6]) / 3, (P[i + 1] + P[i + 4] + P[i + 7]) / 3, (P[i + 2] + P[i + 5] + P[i + 8]) / 3, m.name); } });
  return { n, worst };
}
const clipWords = c => (c.n ? c.n + ' points inside a tyre (the worst ' + (c.worst.d * 100).toFixed(1) + ' cm into ' + c.worst.who + ', ' + c.worst.name + ')' : 'no point inside a tyre');
{
  const out = [];
  let ok = true;
  // (the build's time: < 600 ms - the first build carries node's JIT warm-up, 310-410 ms of it; the second ~100-200 ms)
  for (const which of ['floats', 'hull']) {
    const R = rig(which), t0 = Date.now(), M = TM.buildTrailerModel(THREE, R.L.trailer), ms = Date.now() - t0;
    M.update(R.L.trailer, true);
    const box = new THREE.Box3().setFromObject(M.group);
    const s = M.stats, len = s.x[1] - s.x[0];
    const cl = clipsOf(M, null, 0);
    ok = ok && s.tris < 40000 && s.draws <= 18 && s.width < 2.6 && Math.abs(s.x[1] - R.L.fit.Ld) < 0.1 && ms < 600 && M.strap && box.isEmpty() === false && cl.n === 0;
    out.push(which + ': ' + s.tris + ' triangles, ' + s.draws + ' draw calls (' + s.materials + ' materials + the wheels instanced x5), ' + f(len, 2) + ' x ' + f(s.width, 2) + ' m, built in ' + ms + ' ms, ' + clipWords(cl));
  }
  // (13 Nov) THE SURFACES: every mesh carries UV0 and UV1; the AO baked (at once, here) into its atlas - the faces that look
  // down darker than those that look up, nothing outside [0, 1]; the bunks each their own board of the plank set
  let surf = '';
  { const R = rig('floats'), M2 = TM.buildTrailerModel(THREE, R.L.trailer, { ao: 'sync' }), A = M2.stats.ao, img = M2.aoMap.image;
    let uvAll = true, up = 0, nUp = 0, dn = 0, nDn = 0;
    M2.group.traverse(m => { if (!m.isMesh) return; const g = m.geometry; if (!g.attributes.uv || !g.attributes.uv1) uvAll = false;
      if (m.isInstancedMesh || !g.attributes.uv1) return;
      const U = g.attributes.uv1.array, N = g.attributes.normal.array;
      for (let i = 0; i < U.length / 2; i += 3) { const ny = N[i * 3 + 1], px = Math.min(img.width - 1, Math.floor(U[i * 2] * img.width)), py = Math.min(img.height - 1, Math.floor(U[i * 2 + 1] * img.height)), v = img.data[(py * img.width + px) * 4] / 255;
        if (ny > 0.9) { up += v; nUp++; } else if (ny < -0.9) { dn += v; nDn++; } } });
    // (the bunks' TOP faces - each bunk's own board: the board a top face's v falls in)
    const plank = M2.group.children.find(m => m.material === M2.materials.plank), V = plank ? plank.geometry.attributes.uv.array : [], PN = plank ? plank.geometry.attributes.normal.array : [];
    const boards = new Set(); for (let i = 0; i < V.length / 2; i += 3) if (PN[i * 3 + 1] > 0.85) boards.add(Math.floor(((V[i * 2 + 1] / 2.2) % 1 + 1) % 1 * 12));
    const aUp = up / Math.max(1, nUp), aDn = dn / Math.max(1, nDn);
    const okS = uvAll && A.done && A.texels > 10000 && A.mean > 0.4 && A.mean < 0.95 && aDn < aUp - 0.05 && boards.size >= 3 && A.ms < 15000;
    ok = ok && okS;
    surf = '; THE SURFACES: UV0 + UV1 on every mesh ' + (uvAll ? 'yes' : 'NO') + ', the AO atlas ' + A.W + ' x ' + A.H + ' (' + A.charts + ' charts, ' + A.texels + ' texels x ' + A.rays + ' rays, baked in ' + A.ms + ' ms in node), mean ' + f(A.mean, 2) +
      ', the faces looking up ' + f(aUp, 2) + ' vs down ' + f(aDn, 2) + '; the 4 bunks\' tops on ' + boards.size + ' different boards of the deckwood set';
  }
  // (13 Nov) THE CAR DECK (the CAR session's fit.kind 'car', mapped onto the surfaces): the roadster's deck, its ramps up and
  // down - built, UV0 + UV1 on every mesh, its deck planks each their own board
  { const wb = 2.9, xR = 0.25 - wb / 2, car = { xR, xF: xR + wb, track: 1.5, trackF: 1.5, trackR: 1.5, tyreR: 0.36, tyreW: 0.16, x0: xR - 0.6, x1: xR + wb + 0.6 };
    const Ld = Math.max(car.x1 + 0.1, car.xF + 0.36 + 0.5, 0.41 + 0.31 + 0.4) + 1.05, said = [];
    for (const ramp of ['up', 'down']) {
      const Tc = { fit: { kind: 'car', car, Ld }, wheelR: 0.31, wheelZ: 0.78, axleDx: 0.82, ballH: 0.48, ramp };
      const t0 = Date.now(), Mc = TM.buildTrailerModel(THREE, Tc, { ao: false }), ms = Date.now() - t0;
      let uvAll = true; Mc.group.traverse(m => { if (m.isMesh && (!m.geometry.attributes.uv || !m.geometry.attributes.uv1)) uvAll = false; });
      const deck = Mc.group.children.find(m => m.material === Mc.materials.timber), V = deck ? deck.geometry.attributes.uv.array : [], PN = deck ? deck.geometry.attributes.normal.array : [];
      const boards = new Set(); for (let i = 0; i < V.length / 2; i += 3) if (PN[i * 3 + 1] > 0.85) boards.add(Math.floor(((V[i * 2 + 1] / 2.2) % 1 + 1) % 1 * 12));
      const cl = clipsOf(Mc, car, Mc.stats.deckY), strapN = Mc.group.children.filter(m => m.material === Mc.materials.strap).length, chock = Mc.group.children.some(m => m.material === Mc.materials.chock);
      // (13 Nov, the user: "why did you remove the metal arch from the flatbed?" - the guards under the deck: galvanised skin on
      //  the arc round every wheel, 55 mm over its tyre)
      const Sx = Mc.stats, Rf = Sx.wheelR + 0.055; let arc = 0;
      for (const m of Mc.group.children) { if (m.material !== Mc.materials.galv) continue; const P = m.geometry.attributes.position.array;
        for (let i = 0; i < P.length; i += 3) for (const w of Sx.wheels) if (Math.abs(Math.hypot(P[i] - w[0], P[i + 1] - w[1]) - Rf) < 0.006 && Math.abs(Math.abs(P[i + 2]) - Math.abs(w[2])) < 0.15 && P[i + 1] > w[1]) { arc++; break; } }
      const okC = uvAll && Mc.stats.tris < 50000 && Mc.stats.draws <= 18 && Mc.stats.deckY > 0.6 && boards.size >= 6 && ms < 600 && cl.n === 0 && strapN === 0 && chock && arc > 200;
      ok = ok && okC;
      said.push('ramps ' + ramp + ': ' + Mc.stats.tris + ' triangles, ' + Mc.stats.draws + ' draw calls, the deck at ' + f(Mc.stats.deckY, 2) + ' m, its planks on ' + boards.size + ' boards, UV0 + UV1 ' + (uvAll ? 'yes' : 'NO') + ', ' + ms + ' ms, ' + clipWords(cl) +
        ', the tyre straps ' + (strapN ? 'STILL THERE' : 'gone') + ', the chocks ' + (chock ? 'moulded rubber' : 'MISSING') + ', the mudguards ' + (arc > 200 ? 'over the wheels (' + arc + ' points on their arcs)' : 'MISSING') + (okC ? '' : ' - FAILED'));
    }
    surf += '; THE CAR DECK (the roadster\'s): ' + said.join('; ');
  }
  // (13 Nov) THE WEATHERING (the user: "a little weathering ... the same system as the planes and the field"): every material
  // patched with the planes' grunge sheet, every anchor of three's physical program hit, its uniforms in, its own program key;
  // the wood at 0.7 of its saturation (13 Nov, the user: "in the middle of the two options"); the macros one shared write
  { const R = rig('floats'), Mw = TM.buildTrailerModel(THREE, R.L.trailer, { ao: false }), bad = [];
    let n = 0;
    for (const [k, m] of Object.entries(Mw.materials)) { if (!m || !m.isMaterial) continue; n++;
      const sh = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
      m.onBeforeCompile(sh);
      const ok1 = m.userData.trlWx && !m.userData.trlWxMiss.length && m.customProgramCacheKey() === 'trl-wx' && sh.uniforms.tTrlG && sh.uniforms.tTrlG.value && sh.uniforms.uTrlMat
        && /trlCov/.test(sh.fragmentShader) && /vTrlP = transformed/.test(sh.vertexShader) && /directDiffuse \*= mix/.test(sh.fragmentShader);
      if (!ok1) bad.push(k + (m.userData.trlWxMiss && m.userData.trlWxMiss.length ? ' (missed ' + m.userData.trlWxMiss.join(', ') + ')' : ''));
    }
    const satW = TM.TRL_WX.mat.timber[3], satP = TM.TRL_WX.mat.plank[3];
    const w0 = TM.trailerWeather(THREE), w1 = TM.trailerWeather(THREE, { mud: 0.8 }), w2 = TM.trailerWeather(THREE, { mud: w0.mud });
    const okW = bad.length === 0 && n >= 12 && satW === 0.7 && satP === 0.7 && w1.mud === 0.8 && w2.mud === w0.mud && w0.age > 0 && w0.age < 0.6;
    ok = ok && okW;
    surf += '; THE WEATHERING: ' + (n - bad.length) + ' / ' + n + ' materials patched (the planes\' grunge sheet, the program \'trl-wx\')' + (bad.length ? ' - NOT ' + bad.join(', ') : '') +
      ', the macros age ' + f(w0.age, 2) + ' mud ' + f(w0.mud, 2) + ' rain ' + f(w0.rain, 2) + ' (one shared write), the wood at ' + satW + ' x its saturation' + (okW ? '' : ' - FAILED');
  }
  const H = TM.buildTowHitch(THREE);
  row('MODEL', ok && H.children.length >= 4, 'the trailer\'s model (three.js r' + THREE.REVISION + ' in node) - ' + out.join('; ') + '; the car\'s ball mount ' + H.children.length + ' parts' + surf);
}
// ---- PAGE: drive_mode.js run in node on the island ----
{
  const errs = [], did = []; let chooser = null;
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
      // (13 Nov) THE SANDBOX'S START CHOOSER's car half: the car's places (no runway end), what the village's roads reach, and
      // a GIVEN car (useCar: the roadster's measured sheet, its own mesh) entered in place of the stock pickup
      const PL = DM.placeList(W), ids = PL.map(p => p.id), R = DM.reachFrom(W, 'car:village');
      const own = new THREE.Group(); own.name = 'garage:car';
      await DM.enter({ THREE, scene, world: W, at: [PL.find(p => p.id === 'car:village').x, 0, PL.find(p => p.id === 'car:village').z], to: 'mk_hall',
        sheet: require(path.join(ROOT, 'src/cars/car_roadster.json')), mesh: own, name: 'the roadster' });
      for (let i = 0; i < 30; i++) DM.frame(1);
      const given = !!scene.getObjectByName('garage:car') && DM.name === 'the roadster' && DM.from === 'car:village' && DM.to === 'mk_hall';
      DM.leave();
      // ...and a LOOP (the chooser's "out and back"): Cedar Harbour's harbour front out to the town hall (0.5 km by road) and
      //  back to the harbour front (the village > the cannery is 13.6 km by road: a 45-minute loop, too long for a row)
      const hb = PL.find(p => p.id === 'car:harbour');
      await DM.enter({ THREE, scene, world: W, at: [hb.x, 0, hb.z], to: 'mk_hall', loop: true });
      let lp = 0, out = false; while (lp < 60 * 900) { DM.frame(60); lp += 60; const ph = DM.words().phase; if (DM.to === 'car:harbour') out = true; if (out && ph === 'ARRIVED') break; }
      const loopOk = out && DM.words().phase === 'ARRIVED' && DM.to === 'car:harbour' && !DM.loop; DM.leave();
      chooser = { n: PL.length, car: ['car:harbour', 'car:village', 'car:tramway', 'car:cannery'].every(i => ids.includes(i)), rwy: ids.some(i => /^rwy:/.test(i)), town: R.has('mk_hall'), given, loop: loopOk, loopMin: +(lp / 3600).toFixed(1) };
      did.push(chooser.car && !chooser.rwy && chooser.town && given && loopOk ? 'chooser' : 'CHOOSER ' + JSON.stringify(chooser));
    })().then(finish, e => { errs.push(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)); finish(); });
  } catch (e) { errs.push(e && e.message); finish(); }
  function finish() {
    const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), B = require('./build.js'), lazy = B.MANIFEST.lazy.map(([d, f2]) => d + '/' + f2);
    const hooks = { wanted: /function trailerWanted\(\)/.test(APP), menu: /'Launch from the trailer'/.test(APP), inline: /FLYDIY_TOW_WANTED = \(\) => towWanted\(\) \|\| trailerWanted\(\)/.test(APP),
      lazy: /'trailer', 'trailer_model', 'drive_mode'/.test(APP), start: /DRIVE_MODE\.trailerStart\(/.test(APP), plate: /'trailer launch'/.test(APP),
      // (12 Nov: the roll-out's choice in the garage; the launch's autopilot and its handover to the pilot)
      chooser: /if \(inGarage && launchAsk\(\)\) return;/.test(APP) && /From the trailer<span>/.test(APP), apHands: /hands: byAp/.test(APP), handover: /setManual\(false, 'launch'\)/.test(APP),
      // (13 Nov: the sandbox's start chooser - window.FLYDIY_START's six calls, the car tow by its pick, the push stepped
      //  before each solver step after the hand's input, flown inline, and its handover; the story left alone)
      start: ['available:', 'vehicle:', 'powered:', 'async starts()', 'async destinations(startId)', 'go(o)'].every(k => APP.includes('window.FLYDIY_START = {') && APP.includes(k)),
      cartow: /if \(START\.mode === 'cartow'\) return true;/.test(APP), pushStep: /else if \(START\.push && !START\.push\.done\) pushStep\(\);/.test(APP),
      pushInline: /\|\| START\.mode === 'push';/.test(APP), story: /available: \(\) => !startStory\(\)/.test(APP) };
    const miss = Object.keys(hooks).filter(k => !hooks[k]);
    const okL = lazy.includes('src/vehicle/trailer.js') && lazy.includes('src/vehicle/trailer_model.js') && !B.MANIFEST.core.some(n => /trailer/.test(n));
    row('PAGE', !errs.length && did.join(',') === 'drive,tow,trailer,drawn,chooser' && !miss.length && okL,
      'drive_mode.js in node on the island: ' + (did.join(', ') || 'nothing') + (errs.length ? ' - THREW: ' + errs.join('; ') : '') + '; app.js ' + (Object.keys(hooks).length - miss.length) + ' of ' + Object.keys(hooks).length +
      ' (the menu row, ?trailer=1, inline, the lazy fetch, the plate, the roll-out\'s choice, the autopilot\'s launch and handover; the start chooser: FLYDIY_START, the car tow, the push stepped, inline, the story apart)' + (chooser ? '; the chooser\'s car: ' + chooser.n + ' places, its four own, no runway end, the village reaches the town, a given car driven: ' + (chooser.given ? 'yes' : 'NO') + ', a loop the harbour front > the town hall > the harbour front: ' + (chooser.loop ? 'back in ' + chooser.loopMin + ' min' : 'NO') : '') + (miss.length ? ' MISSING: ' + miss.join(', ') : '') + '; trailer.js, trailer_model.js lazy' + (okL ? '' : ' - NOT'));
    console.log('GATE TRAILER: ' + (fails ? 'FAIL' : 'PASS'));
    process.exit(fails ? 1 : 0);
  }
}
