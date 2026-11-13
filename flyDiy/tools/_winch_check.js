#!/usr/bin/env node
// GATE WINCH (WINCH, 2026-11-13) - THE GLIDER WINCH LAUNCH on Jolene AFB's 13/31 (2325 m, paved): src/vehicle/winch.js's
// line (tow.js's tension-only spring-damper through sim.onSubstep + sim.impulse, no solver change) from the glider's nose
// hook to a FIXED drum at the far end of the cable, its rest length reeled in at the drum's speed; the drum's engine and
// its driver (full power on the ground run, the glider's airspeed held in the climb, easing off over the top, the brake
// after the release, the guillotine); the glider the MOTORGLIDER archetype, motor off (GATE TOW's), flown by winch.js's
// hands (the page's player flies it himself, the autopilot with these hands).
//   LAUNCH    1000 m of cable from runway 13's end: lift-off, the climb, the back-release at the top - the height, the
//             speed held, the line never past its weak link, the drum never past its top speed
//   GLIDE     after the release: 15 s, wings level, the speed held
//   RELEASE   the pilot's key at 100 m: the line off at once, the drum braked to a stop
//   WEAK      a 1.5 kN weak link: it breaks in the ground run's pull, said so
//   CUT       a back-release that does not let go (relDeg 89): the winch driver fires the guillotine
//   SHORT     600 m of cable: a lower launch, the same laws
//   AUTOPILOT the hands up the line, the game's pilot 2 s after the release (the page's handover): GLIDE
//   CIRCUIT   the glider's circuit to a landing on the runway after the launch
//   PERF      the line's cost a frame
//   MODULE    the page's half (winch_mode.js) run in node on a three scene: the winch drawn and weathered, a launch, the plate
//   PAGE      the winch's wiring in the page (winch_mode.js, app.js, the start chooser), by its source
// node tools/_winch_check.js [--only=LAUNCH,...]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
{ const T = __dirname, src = fs.readFileSync(path.join(__dirname, 'arch_fly.js'), 'utf8');
  eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(__dirname)).replace('function loadPanel()', 'global.loadPanel = function ()')); global.loadPanel(); }
const DS = require('./_cage_design.js'), C = require('./flight_core.js'), IN = require('./island_node.js');
const TW = require(path.join(ROOT, 'src/vehicle/tow.js')), WI = require(path.join(ROOT, 'src/vehicle/winch.js'));
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const want = id => !ONLY.length || ONLY.includes(id);
let fails = 0;
const row = (id, ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + id.padEnd(9) + ' ' + msg); if (!ok) fails++; };
const f = (x, n = 1) => (x == null || !isFinite(x)) ? '-' : (+x).toFixed(n);

const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') });
const aH = W.aerodromes.find(a => a.id === 'HOME');
const A = DS.ARCHETYPES.find(x => x.key === 'motorglider');
const DEF0 = C.buildGen(DS.designBake(A.sel, A.over));
// runway 13's end and its direction (the runway's own record: the centreline from the end the glider lines up at)
const ux = Math.cos(aH.hdg), uz = Math.sin(aH.hdg);
const P0 = { x: aH.x - ux * (aH.len / 2 - 60), z: aH.z - uz * (aH.len / 2 - 60) }, dx = ux, dz = uz;

// one launch: o = { L (m of cable), relDeg, weak, releaseAt (m), T (s), pilot, after (s after the release), noLine }
function launch(o) {
  o = Object.assign({ L: 1000, T: 150, after: 15 }, o || {});
  const def = DEF0, sim = C.makeSim(def, W); sim.reset(0);
  let hdg = Math.atan2(dz, dx);
  C.placeAtLineup(sim, aH, { x: P0.x, z: P0.z, hdg }, W, def.refs); for (let i = 0; i < 120; i++) sim.step(1 / 60);
  let xA = sim.axes()[0];
  if (-xA[0] * dx - xA[2] * dz < 0) { sim.reset(0); hdg += Math.PI; C.placeAtLineup(sim, aH, { x: P0.x, z: P0.z, hdg }, W, def.refs); for (let i = 0; i < 120; i++) sim.step(1 / 60); xA = sim.axes()[0]; }
  sim.setEngine(0, { key: 'off' });
  const hook = WI.winchHookNodes(sim); let hx = 0, hz = 0; hook.nodes.forEach((i, k) => { hx += sim.p[i * 3] * hook.w[k]; hz += sim.p[i * 3 + 2] * hook.w[k]; });
  const ax = hx + dx * o.L, az = hz + dz * o.L, anchor = [ax, W.terrainH(ax, az) + WI.WINCH_FAIRLEAD.y, az];
  const sheet = C.machineSheet(def), Vs = sheet.Vs, vT = Math.max(1.6 * Vs, def.params.ap.VClimb * 1.15);
  const wn = WI.makeWinch({ anchor });
  const line = o.noLine ? null : WI.makeWinchLine(sim, wn, { hook, weak: o.weak, relDeg: o.relDeg, vTarget: vT, groundAt: (x, z) => W.terrainH(x, z) });
  const hands = WI.makeWinchHands(sim, { ground: W.terrainH(hx, hz), vMin: 1.25 * Vs });
  const ap = o.pilot ? C.makePilot(sim, def, W) : null; if (ap) ap.setRoute(aH, aH);
  const R = { mass: sim.totalM, hook: hook.nodes.length, vT, Vs, lift: null, rel: null, relT: null, relH: null, relV: null, relX: null, maxH: 0, bad: false, vdMax: 0, after: [], ms: 0, n: 0, line, wn, vClimb: [], handed: null };
  const dt = 1 / 60;
  for (let fr = 0, t = 0; fr < o.T * 60; fr++, t = fr * dt) {
    if (line) line.before();
    if (ap && !R.handed && line && !line.on && R.relT !== null && t - R.relT > 2) { R.handed = { t }; ap.reEngage({ phase: 'CLIMB' }); }
    if (R.handed) ap.update(dt); else hands(line, dt);
    const a = process.hrtime.bigint(); sim.step(dt); R.ms += Number(process.hrtime.bigint() - a) / 1e6; R.n++;
    if (line) line.after(dt);
    if (sim.stats().bad) { R.bad = true; break; }
    const cg = sim.cgPos(), cv = sim.cgVel(), agl = cg[1] - W.terrainH(cg[0], cg[2]), Vg = sim.out && sim.out.V > 0 ? sim.out.V : Math.hypot(...cv);
    R.maxH = Math.max(R.maxH, agl); R.vdMax = Math.max(R.vdMax, wn.vd);
    if (R.lift === null && !sim.wheelsOnGround()) R.lift = { t, V: Vg, x: Math.hypot(cg[0] - P0.x, cg[2] - P0.z) };
    if (process.env.WINCH_TRACE && fr % 120 === 0 && line) { const xa = sim.axes()[0], th = Math.asin(-xa[1]) * 57.3, vs = cv[1];
      console.log('  t ' + f(t, 0).padStart(3) + '  h ' + f(agl, 0).padStart(4) + '  V ' + f(Vg) + '  vs ' + f(vs) + '  pitch ' + f(th, 0).padStart(3) + '  line ' + f(line.angle, 0).padStart(3) + '° ' + f(line.Tmean / 1000, 2) + ' kN  rest ' + f(line.Lrest, 0) + '  drum ' + f(wn.vd) + ' thr ' + f(wn.thr, 2) + ' ' + wn.phase + '  de ' + f(sim.ctl.de, 2)); }
    if (line && line.on && agl > 30) R.vClimb.push(Vg);
    if (line && o.releaseAt && line.on && agl >= o.releaseAt) line.release();
    if (line && !line.on && R.rel === null) { R.rel = line.released; R.relT = t; R.relH = agl; R.relV = Vg; R.relX = Math.hypot(cg[0] - anchor[0], cg[2] - anchor[2]); R.relAng = line.angle; }
    if (R.rel !== null) { const zR = sim.axes()[2]; R.after.push([t - R.relT, Vg, Math.abs(Math.asin(Math.max(-1, Math.min(1, zR[1])))) * 57.3, agl, wn.vd]);
      if (t - R.relT >= o.after || (R.handed && ap.phase === 'STOPPED')) break; }
  }
  if (ap) { R.ap = ap; R.phases = (ap.report.phases || []).map(q => q.phase); }
  return R;
}
const span = a => a.length ? f(Math.min(...a)) + '-' + f(Math.max(...a)) : '-';

let L1 = null;
if (want('LAUNCH') || want('GLIDE')) {
  L1 = launch({});
  const ok = !L1.bad && L1.lift && L1.lift.t < 15 && L1.rel && /top of the launch/.test(L1.rel) && L1.relH > 200 && L1.line.Tmax < L1.line.weak && L1.vdMax <= 32 && L1.relV > 0.85 * L1.vT && L1.relV < 1.45 * L1.vT;
  if (want('LAUNCH')) row('LAUNCH', ok, 'the motorglider (motor off, ' + f(L1.mass, 0) + ' kg; the hook ' + L1.hook + ' nodes) on 1000 m of cable to the winch, Jolene AFB 13/31 from runway 13\'s end: lift-off ' +
    (L1.lift ? f(L1.lift.t) + ' s, ' + f(L1.lift.V) + ' m/s, ' + f(L1.lift.x, 0) + ' m' : 'NONE') + '; the climb at ' + span(L1.vClimb) + ' m/s (the driver holds ' + f(L1.vT) + ', Vs ' + f(L1.Vs) + '); released at ' +
    (L1.relH != null ? f(L1.relH, 0) + ' m, ' + f(L1.relT, 0) + ' s, ' + f(L1.relV) + ' m/s, ' + f(L1.relX, 0) + ' m short of the winch (' + L1.rel + ')' : 'NEVER') + '; the line ' + f(L1.line.Tmax / 1000, 2) + ' kN at most (weak link ' + f(L1.line.weak / 1000, 1) + ' kN); the drum ' + f(L1.vdMax) + ' m/s at most');
}
if (want('GLIDE')) {
  const A2 = L1.after, last = A2[A2.length - 1] || [0, 0, 0, 0, 0], vMin = Math.min(...A2.map(a => a[1])), vMax = Math.max(...A2.map(a => a[1])), bMax = Math.max(...A2.map(a => a[2]));
  row('GLIDE', A2.length > 0 && last[0] >= 14.9 && vMin > 16 && vMax < 45 && bMax < 15 && last[3] > 150 && last[4] < 0.5, 'released, 15 s gliding: ' + f(vMin) + '-' + f(vMax) + ' m/s, bank ' + f(bMax) + ' deg at most, ' + f(last[3], 0) + ' m at the end; the drum braked to ' + f(last[4], 2) + ' m/s');
}
if (want('RELEASE')) {
  const R = launch({ releaseAt: 100, T: 90, after: 6 }), last = R.after[R.after.length - 1] || [0, 0, 0, 0, 9];
  row('RELEASE', R.rel === 'released by the pilot' && Math.abs(R.relH - 100) < 6 && !R.bad && last[4] < 0.5, 'the key at 100 m: off at ' + f(R.relH) + ' m (' + R.rel + '); the drum ' + f(last[4], 2) + ' m/s 6 s on');
}
if (want('WEAK')) {
  const R = launch({ weak: 1500, T: 40, after: 3 });
  row('WEAK', /weak link/.test(R.rel || '') && R.relH < 20 && !R.bad, 'a 1.5 kN weak link: ' + (R.rel || 'NOT BROKEN') + ' at ' + (R.relT != null ? f(R.relT) + ' s, ' + f(R.relH) + ' m up' : '-'));
}
if (want('CUT')) {
  const R = launch({ relDeg: 89, T: 150, after: 6 });
  row('CUT', /guillotine/.test(R.rel || '') && !R.bad && R.relH > 100, 'a back-release that does not let go: ' + (R.rel || 'NEVER CUT') + ' at ' + f(R.relH, 0) + ' m, ' + f(R.relX, 0) + ' m short of the winch');
}
if (want('SHORT')) {
  const R = launch({ L: 600, T: 120, after: 3 });
  row('SHORT', !R.bad && R.rel && /top of the launch/.test(R.rel) && R.relH > 100 && R.relH < (L1 ? L1.relH : 1e9), '600 m of cable: released at ' + f(R.relH, 0) + ' m (' + R.rel + ')' + (L1 ? ', below the 1000 m launch\'s ' + f(L1.relH, 0) + ' m' : ''));
}
if (want('AUTOPILOT')) {
  const R = launch({ pilot: true, after: 40, T: 200 }), last = R.after[R.after.length - 1] || [0, 0, 0, 0];
  const ok = !R.bad && R.handed && R.phases.includes('GLIDE') && last[3] > 100 && last[1] > 16 && last[0] >= 39;
  row('AUTOPILOT', ok, 'the launch by the autopilot: released at ' + f(R.relH, 0) + ' m, the pilot from ' + (R.handed ? f(R.handed.t, 0) + ' s' : 'NEVER') + ': ' + (R.phases || []).join(' -> ') + '; 40 s on ' + f(last[3], 0) + ' m up at ' + f(last[1]) + ' m/s');
}
if (want('CIRCUIT')) {
  const R = launch({ pilot: true, after: 600, T: 760 }), ap = R.ap, Gd = ap && ap.report.glider, Ld = ap && ap.report.landing;
  const ok = !R.bad && R.phases.includes('STOPPED') && Ld && Ld.onStrip && Math.abs(Ld.offCentre) < 20 && Ld.stopLeft > 0 && Ld.sink < 1.5 && ap.report.outcome === 'completed';
  row('CIRCUIT', ok, 'released at ' + f(R.relH, 0) + ' m; ' + (Gd ? Gd.side + '-hand at ' + Gd.field + ': ' + Gd.stages.map(q => q.stage + ' ' + q.h + ' m').join(', ') : 'NO CIRCUIT') + '; ' +
    (Ld ? 'landed ' + (Ld.onStrip ? 'on the runway' : 'OFF it') + ', ' + f(Math.abs(Ld.offCentre), 1) + ' m off the centreline, sink ' + f(Ld.sink, 2) + ' m/s, ' + f(Ld.stopLeft, 0) + ' m left' : 'NO LANDING') + ' (' + (ap ? ap.report.outcome : '-') + ')');
}
if (want('PERF')) {
  const N = launch({ noLine: true, T: 20 }), Wl = launch({ T: 20 });
  const a = N.ms / N.n, b = Wl.ms / Wl.n;
  row('PERF', b < a * 1.5 + 0.3, 'the glider\'s frame ' + f(a, 3) + ' ms without the line, ' + f(b, 3) + ' ms with it (the per-substep pull: the solver\'s second loop, ' + (L1 ? L1.hook : '-') + ' impulses a substep; the drum a frame)');
}
// ---- MODULE: the page's half run in node - winch_mode.js on a real three scene and the island world, stepped as app.js's
//      loop steps a tow (towPre, the aeroplane's step, towPost; towDraw a frame; the launch started 3 s on, the autopilot's
//      hands; the release; towStop): the winch built and weathered in the scene at the far end, the cable drawn, the words ----
if (want('MODULE')) {
  const THREE = global.THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  global.window = global.window || globalThis; window.THREE = THREE;
  Object.assign(globalThis, TW, WI);                                  // (the lazy scripts' globals: tow.js, winch.js)
  globalThis.machineSheet = C.machineSheet;
  globalThis.AEROWX = require(path.join(ROOT, 'src', 'viewer', 'aeroweather.js'));
  for (const fl of ['_gear_kit.js', '_gear_gen.js', '_winch_gen.js', '_winch_weather.js']) require(path.join(__dirname, fl));
  require(path.join(ROOT, 'src', 'viewer', 'winch_mode.js'));
  const WMd = window.WINCH_MODE, scene = new THREE.Scene(), def = DEF0, sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtLineup(sim, aH, { x: P0.x, z: P0.z, hdg: Math.atan2(dz, dx) }, W, def.refs); for (let i = 0; i < 120; i++) sim.step(1 / 60);
  sim.setEngine(0, { key: 'off' });
  const res = { err: null, words: [], to: null };
  const step = () => { WMd.towPre(); sim.step(1 / 60); WMd.towPost(1 / 60); };
  (async () => {
    try {
      res.to = await WMd.winchStart({ THREE, scene, world: W, sim, def, hands: true });
      const T = WMd.tow, mdl = T.model; res.inScene = !!mdl && mdl.parent === scene && !!T.rope && T.rope.parent === scene;
      let meshes = 0, hooked = 0; mdl.traverse(o => { if (o.isMesh) { meshes++; if (o.material && o.material.onBeforeCompile && /winch/.test(String(o.material.customProgramCacheKey && o.material.customProgramCacheKey()))) hooked++; } });
      res.meshes = meshes; res.hooked = hooked;
      const fp = T.line.carP, d0 = Math.hypot(fp[0] - P0.x, fp[2] - P0.z); res.far = d0;
      res.words.push(WMd.towWords());
      for (let fr = 0; fr < 60 * 120; fr++) {
        if (!T.go && T.t > 3) T.start();
        step(); if (fr % 30 === 0) WMd.towDraw();
        if (fr === 60 * 20) res.words.push(WMd.towWords());
        if (!T.line.on && res.rel == null) { res.rel = T.line.released; const cg = sim.cgPos(); res.relH = cg[1] - W.terrainH(cg[0], cg[2]); }
        if (res.rel && T.t > (res.relT || (res.relT = T.t)) + 4) break;
      }
      WMd.towDraw(); res.ropeAfter = T.rope.visible; res.words.push(WMd.towWords());
      WMd.towStop(); res.stopped = !WMd.tow.active && !mdl.parent && sim.onSubstep == null;
    } catch (e) { res.err = e.message; }
    const ok = !res.err && res.inScene && res.meshes > 150 && res.hooked > 0 && res.rel && /top of the launch/.test(res.rel) && res.relH > 150 && res.stopped && /^on the winch: /.test(res.words[1] || '') && /^off the cable/.test(res.words[2] || '');
    row('MODULE', ok, res.err ? 'THREW: ' + res.err : 'winch_mode.js in node: ' + res.to + '; the winch in the scene (' + res.meshes + ' meshes, the club\'s weathering on ' + res.hooked + ' of them, the fairlead ' + f(res.far, 0) + ' m from the start), the cable drawn; ' +
      'the launch by the hands: ' + (res.rel ? res.rel + ' at ' + f(res.relH, 0) + ' m' : 'NEVER RELEASED') + '; the plate: "' + res.words.join('" / "') + '"; towStop ' + (res.stopped ? 'cleared it' : 'LEFT IT'));
    finish();
  })();
} else setImmediate(() => finish());
function finish() {
if (want('PAGE')) {
  const B = require('./build.js'), lazy = B.MANIFEST.lazy.map(([d, f2]) => d + '/' + f2);
  const rd = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return ''; } };
  const APP = rd('src/viewer/app.js'), WM = rd('src/viewer/winch_mode.js');
  const hooks = {
    module: /WM\.winchStart = async function/.test(WM) && /WINCH_GEN\.build/.test(WM) && /WINCH_WX\.apply/.test(WM),
    towOn: /window\.WINCH_MODE; if \(Wm && Wm\.tow && Wm\.tow\.active\) return Wm;/.test(APP),
    wanted: /START\.mode === 'winch'/.test(APP),
    chooser: /mode: 'winch', label: 'A winch launch'[^\n]*ok: !!home/.test(APP),
    lazyAsk: /'tow', 'winch', '_winch_gen', '_winch_weather', 'winch_mode'/.test(APP),
  };
  const miss = Object.keys(hooks).filter(k => !hooks[k]);
  const files = ['src/vehicle/winch.js', 'src/viewer/winch_mode.js', 'tools/_winch_gen.js', 'tools/_winch_weather.js'];
  row('PAGE', files.every(p => lazy.includes(p)) && !B.MANIFEST.core.some(n => /winch/.test(n)) && !miss.length,
    files.filter(p => lazy.includes(p)).length + ' of ' + files.length + ' winch files lazy (not in MANIFEST.core); the page: ' + (Object.keys(hooks).length - miss.length) + ' of ' + Object.keys(hooks).length + ' hooks' + (miss.length ? ' MISSING: ' + miss.join(', ') : ''));
}
console.log('GATE WINCH: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
}
