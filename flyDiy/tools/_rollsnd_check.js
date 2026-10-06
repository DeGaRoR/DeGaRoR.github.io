#!/usr/bin/env node
// GATE ROLLSND (G1715-G1717, SND-ROLLOUT) — the roll-out shot's SOUND: the shot starts its engines the way the aeroplane
// does (src/viewer/rollanim.js START: setEngine, the solver's crank, the shaft law), the drawn prop turns at the voice's
// rpm, the shed hears the moving aeroplane where it is (src/viewer/audio/space.js shotPose), and every field goes back.
// In node, on the real vendor three.js, the real solver (tools/flight_core.js) and the user's validated builds (the Cub,
// the Jodel, the Cessna, the twin-582) plus an electric (the twin-boom E-811), a turboprop (the metal Cessna on a PT6A,
// render_prop.js's archetype), a starter-less Cub (the minimal systems: swung by hand) and a build with no engine.
//
//   ORDER     per build, frame by frame as the host drives it: every engine stopped at the shot's first frame (key off,
//             not running, no crank, rpm 0); the key BOTH before any crank and a silence of >= 0.4 s; each engine: the
//             crank (crank > 0) before it runs, for the solver's own time (setEngine's, measured on makeSim: +-1 frame),
//             ONE catch (one false -> true of running), sim.out.rpm 0 while it cranks and the solver's shaft law
//             (genShaftRpm / genEngineRpm at the throttle, V 0) to 1e-9 once it runs; the check at idle (throttle 0, every
//             engine running at the law's idle); the roll: the throttle up to 0.10-0.20 (rpm +200-500 over idle) before
//             the aeroplane moves, back to 0 by the end; the phases start > check > roll.
//   TURN      a twin: engine 1 cranks only after engine 0 caught, never two cranking at once.
//   KINDS     the electric motor never cranks (crank 0 every frame), runs from its power-on, spins up; the starter-less
//             build is swung (no crank, a catch at once); the turboprop cranks; no engine: no start (plan 0 s, no field
//             written, the shot as before).
//   VISUAL    the drawn prop (the props' spinRate, what poseModel turns them by): under the starter at the voice's crank
//             (crankRpm / gear, mean within 25 %), through the catch a flare >= 1.2 x idle, back to idle within 3 % by the
//             check's end - and against THE VOICE ITSELF: engine_worklet.js run offline (tools/audio/render.js's shim) on
//             the shot's own timeline (the fields per frame), its control output (the voice's engine rpm) and the shot's
//             model of it within 6 % of idle through the start (crank, catch, settle).
//   RESTORE   the end (no handover), a skip mid-crank, after the catch, in the check and in the roll, a cancel: every
//             field the shot wrote (sim.eng key / crank / running, sim.out.rpm / rpmEng, sim.ctl.thr) as it found them,
//             a stale flight rpm included; with handover (the app's roll-out): the engine fields restored, sim.out at the
//             stand's idle (the solver's first step: no dip, no second catch); a cancel restores even then.
//   SPACE     space.js on a stub Web Audio + the real space_config / audio_params: in the shed without the pose the room
//             mode (the group 8 m ahead); with the pose each engine group placed where it stands + the offset (distance
//             to the listener exact), moved by the roll; the aircraft's wet send = 0.25 x (0.3 + 0.7 x inside); the pose
//             off -> the room mode again; 10 000 shot frames < 0.3 ms each (their heap: GATE AUDIO SP_BUDGET's shot row).
//   WIRING    app.js's roll-out hands the shot `handover` and space.js's shotPose; the solo shot does not hand over;
//             space.js publishes shotPose.
//   TIMING    the shot's phases on the four validated builds in the club shed with the garage's own framing (the app's
//             front shot): reported (HANDOVER / the commit), and held: start = lead + crank + settle, as planned.
//   SELFTEST  each check re-run on MUTATED sources (in memory, nothing on disk touched): every mutation red; the files
//             byte-identical after.
//
//   node tools/_rollsnd_check.js             -> "GATE ROLLSND: PASS|FAIL"
//   node tools/_rollsnd_check.js --verbose   -> every check and the timing table
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
if (typeof global.gc !== 'function') {
  const r = require('child_process').spawnSync(process.execPath, ['--expose-gc', '--max-semi-space-size=64', __filename, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status == null ? 1 : r.status);
}
const T = __dirname, ROOT = path.join(T, '..');
const VERBOSE = process.argv.includes('--verbose');
const at = p => path.join(ROOT, p);
const CORE = require(path.join(T, 'flight_core.js'));
for (const k of Object.keys(CORE)) global[k] = CORE[k];
const THREE = require(at('vendor/three.min.js'));
global.THREE = THREE;
global.window = new EventTarget();
require('events').setMaxListeners(0, global.window);
const ESN = require(at('src/viewer/audio/engine_config.js'));
global.window.ENGINE_SOUND = ESN;
const SC = require(at('src/viewer/audio/space_config.js'));
const AP = require(at('src/viewer/audio/audio_params.js'));
const RENDER = require(path.join(T, 'audio', 'render.js'));

const FILES = { ra: 'src/viewer/rollanim.js', space: 'src/viewer/audio/space.js', app: 'src/viewer/app.js' };
const SRC0 = {}; for (const k of Object.keys(FILES)) SRC0[k] = fs.readFileSync(at(FILES[k]), 'utf8');
const hash = () => crypto.createHash('sha256').update(Object.keys(FILES).map(k => fs.readFileSync(at(FILES[k]), 'utf8')).join('\0')).digest('hex').slice(0, 12);
const HASH0 = hash();

// rollanim.js from its text (a mutation is a text): a fresh module each time
function loadRA(src) {
  const m = { exports: {} };
  new Function('module', 'exports', src + '\n//# sourceURL=rollanim.js')(m, m.exports);
  return m.exports;
}

// ---- the builds -----------------------------------------------------------------------------------------------
const clone = o => JSON.parse(JSON.stringify(o));
const BUILDS = [
  { key: 'cub', file: 'builds/cub_2026-09-20_corrected.json', label: "the user's Cub (A-65)" },
  { key: 'jodel', file: 'builds/jodel_2026-09-20_corrected.json', label: 'the Jodel D112 (A-65)' },
  { key: 'cessna', file: 'builds/cessna172_2026-09-20_corrected.json', label: 'the Cessna 172 (flat four 5.9 L)' },
  { key: 'twin582', file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', label: 'the twin-582 (two Rotax 582)' },
  { key: 'electric', file: 'tools/fixtures/build_v8_twin-boom_2026-09-11.json', label: 'an electric (the twin-boom, E-811)' },
  { key: 'pt6', file: 'tools/fixtures/build_v10_cessnaMetal_2026-09-26.json', label: 'a turboprop (the metal Cessna on a PT6A-114A)',
    mutate: s => { s.engines[0].type = 'pt6a114a_hartzell3'; delete s.engines[0].custom; delete s.engines[0].sound; } },
  { key: 'swing', file: 'builds/cub_2026-09-20_corrected.json', label: 'the Cub without a starter (minimal systems: swung)',
    mutate: s => { s.systems = Object.assign({}, s.systems || {}, { elec: Object.assign({}, (s.systems && s.systems.elec) || {}, { starter: 'none' }) }); } },
];
const VALIDATED = ['cub', 'jodel', 'cessna', 'twin582'];
const specs = {};
// G2034 (DMG-RECAL, GATE JOINPARITY's census): every build AS THE GAME FLIES IT - the page's load chain
// (tools/_load_build.js: the join, the energy layer's tanks), then the fixture's mutation; FLYDIY_RAW_BUILDS=1: the file
const LB = require(path.join(__dirname, '_load_build.js'));
function specOf(B) {
  if (!specs[B.key]) { const raw = JSON.parse(fs.readFileSync(at(B.file), 'utf8')); const s = clone(process.env.FLYDIY_RAW_BUILDS === '1' ? (raw.spec || raw) : LB.loadBuild(at(B.file)).spec); if (B.mutate) B.mutate(s); specs[B.key] = s; }
  return clone(specs[B.key]);
}
// the shed as app.js stands it (_rollanim_check.js's garage(), the club shed), the props carrying engIdx
function garage(B, o) {
  const def = CORE.buildGen(specOf(B));
  const sim = CORE.makeSim(def, null);
  if (o && o.flown) { for (let i = 0; i < 30; i++) sim.step(1 / 60); }   // a flight's last rpm left in sim.out (the shed after a flight)
  sim.reset(0);
  const scene = new THREE.Scene(), craft = new THREE.Group(); scene.add(craft);
  const pos = new Float32Array(sim.n * 3); for (let i = 0; i < sim.n * 3; i++) pos[i] = sim.p[i];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  craft.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial()));
  const wheelParts = [];
  for (let i = 0; i < sim.n; i++) if (def.nodes[i].r > 0) { const w = new THREE.Object3D(); w.position.set(sim.p[i * 3], sim.p[i * 3 + 1], sim.p[i * 3 + 2]); craft.add(w); wheelParts.push({ obj: w, idx: i, R: def.nodes[i].r }); }
  const props = []; for (let e = 0; e < (def.params.nEngines || 1); e++) { const p = new THREE.Object3D(); p.userData = { engIdx: e }; craft.add(p); props.push(p); }
  const model = { wheelParts, props, link: CORE.makeLinkage(0.15) };
  const dims = { HW: 15, HD: 12.5, EAVE: 7 }, room = new THREE.Group(); scene.add(room);
  const hangar = { dims, group: room, doorAxis: -1, floorY: 0, door: { w: 2 * dims.HW - 5, h: 5.6 }, craftPrint: () => null, mobileGroup: new THREE.Group(), dayCard: null };
  const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 5000);
  const cg = sim.cgPos(); cam.position.set(cg[0] + 14 * Math.cos(0.22) * Math.cos(-2.5), cg[1] + 14 * Math.sin(0.22), cg[2] + 14 * Math.cos(0.22) * Math.sin(-2.5));
  cam.lookAt(cg[0], cg[1], cg[2]); cam.updateMatrixWorld(true);
  return { B, def, sim, scene, craft, model, hangar, cam };
}
const FRONT = { az: -2.5, el: 0.22, dist: 14 };   // the garage's own framing: the app's front shot
function play(R, G, extra) {
  return R.play(Object.assign({ craft: G.craft, scene: G.scene, camera: G.cam, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim,
    follow: false, front: FRONT, onDone: () => { G.done = (G.done || 0) + 1; } }, extra || {}));
}
const snapFields = G => ({ eng: G.sim.eng.map(e => [e.running, e.key, e.crank]), rpm: Array.isArray(G.sim.out.rpm) ? G.sim.out.rpm.slice() : 'none',
  tp: Array.isArray(G.sim.out.thrustPer) ? G.sim.out.thrustPer.slice() : 'none',
  rpmEng: Array.isArray(G.sim.out.rpmEng) ? G.sim.out.rpmEng.slice() : 'none', thr: G.sim.ctl.thr });
// the shot, frame by frame at 60 Hz as the host drives it: a row a frame
function record(R, G, extra, nMax) {
  const h = play(R, G, extra), rows = [];
  rows.push(rowOf(G, h, 'play'));
  for (let n = 0; n < (nMax || 3000) && !h.done; n++) { const went = R.frame(1 / 60); if (!went) break; rows.push(rowOf(G, h)); }
  return { h, rows };
}
function rowOf(G, h, tag) {
  const o = G.sim.out;
  return { ph: tag || h.phase, t: h.tStart + h.tCheck + h.t, thr: G.sim.ctl.thr, x: G.craft.position.x,
    eng: G.sim.eng.map(e => ({ key: e.key, crank: e.crank, run: e.running })), rpm: (o.rpm || []).slice(), rpmEng: (o.rpmEng || []).slice(), tp: (o.thrustPer || []).slice(),
    vis: G.model.props.map(p => (p.userData.spinRate || 0) * 60 / (2 * Math.PI)), voice: h.eng ? Array.from(h.eng) : null };
}

// ---- the checks (each a function of the loaded modules: the selftest re-runs them on mutated text) -------------
function lawOf(G) {
  const P = G.def.params, PP = CORE.POWERPLANTS[P.powerplant] || {};
  const EN = P.engine || PP.engine, PR = P.prop || PP.prop;
  return { EN, PR, rp: (thr, run) => CORE.genShaftRpm(EN, PR, thr, 0, 1, 1, run), re: rp => CORE.genEngineRpm(EN, rp) };
}
function checkOrder(M, F, info) {
  const R = M.R, S = R.S;
  // the solver's own crank time
  { const G = garage(BUILDS[0]); G.sim.setEngine(0, { key: 'off' }); G.sim.starterOk = () => true; G.sim.setEngine(0, { key: 'both', start: true });
    if (G.sim.eng[0].crank !== S.crankS) F.push('ORDER: the shot cranks ' + S.crankS + ' s, the solver\'s setEngine ' + G.sim.eng[0].crank + ' s'); }
  for (const key of VALIDATED.concat(['pt6'])) {
    const B = BUILDS.find(b => b.key === key), G = garage(B), L = lawOf(G);
    const { h, rows } = record(R, G);
    const SP = h.plan.start, n = SP.n, tag = B.key + ': ';
    if (!(n >= 1)) { F.push('ORDER ' + tag + 'no start planned (' + SP.why + ')'); continue; }
    const r0 = rows[0];
    if (!r0.eng.every(e => e.key === 'off' && !e.run && !(e.crank > 0)) || r0.rpm.slice(0, n).some(v => v !== 0)) F.push('ORDER ' + tag + 'the first frame is not every engine stopped (' + JSON.stringify(r0.eng) + ' rpm ' + r0.rpm + ')');
    const iKey = rows.findIndex(r => r.eng.every(e => e.key === 'both')), iCrank0 = rows.findIndex(r => r.eng.some(e => e.crank > 0 || e.run));
    if (!(iKey > 0 && iCrank0 > iKey && (iCrank0 - 1) / 60 >= 0.4)) F.push('ORDER ' + tag + 'the key before the crank and a silence >= 0.4 s (key at frame ' + iKey + ', the first crank / run at ' + iCrank0 + ')');
    let catches = 0;
    for (let k = 0; k < n; k++) {
      const cr = rows.map(r => r.eng[k].crank > 0), rn = rows.map(r => r.eng[k].run);
      const c0 = cr.indexOf(true), c1 = cr.lastIndexOf(true), r1 = rn.indexOf(true);
      let ups = 0; for (let i = 1; i < rows.length; i++) if (rn[i] && !rn[i - 1]) ups++;
      catches += ups;
      if (ups !== 1) F.push('ORDER ' + tag + 'engine ' + k + ' caught ' + ups + ' times (want once)');
      if (SP.engines[k].method === 'starter') {
        if (!(c0 > 0 && r1 > c1 && r1 === c1 + 1)) F.push('ORDER ' + tag + 'engine ' + k + ': the crank (frames ' + c0 + '-' + c1 + ') does not end in its catch (frame ' + r1 + ')');
        const dur = (c1 - c0 + 1) / 60;
        if (Math.abs(dur - S.crankS) > 1.5 / 60) F.push('ORDER ' + tag + 'engine ' + k + ' cranked ' + dur.toFixed(3) + ' s (the solver\'s ' + S.crankS + ')');
        if (Math.abs(c0 / 60 - SP.engines[k].tGo) > 1.5 / 60) F.push('ORDER ' + tag + 'engine ' + k + ' cranked at ' + (c0 / 60).toFixed(3) + ' s, planned ' + SP.engines[k].tGo);
        for (let i = c0; i <= c1; i++) if (rows[i].rpm[k] !== 0 || rows[i].rpmEng[k] !== 0) { F.push('ORDER ' + tag + 'engine ' + k + ': sim.out reads ' + rows[i].rpm[k] + ' rpm while it cranks (the solver: 0)'); break; }
      }
      // the shaft law, every running frame; the thrust (Ti = thr x lever x Tstatic at rest), 0 while it does not run
      let worst = 0;
      for (const r of rows) { const rp = r.eng[k].run ? L.rp(r.thr, true) : 0, ti = r.eng[k].run ? r.thr * L.PR.Tstatic : 0;
        if (r.eng[k].run || r.ph !== 'play') worst = Math.max(worst, r.eng[k].crank > 0 && !r.eng[k].run ? 0 : Math.abs(r.rpm[k] - rp), r.eng[k].crank > 0 && !r.eng[k].run ? 0 : Math.abs(r.rpmEng[k] - L.re(rp)), Math.abs((r.tp[k] || 0) - ti)); }
      if (!(worst < 1e-9)) F.push('ORDER ' + tag + 'engine ' + k + ': sim.out off the solver\'s shaft law by ' + worst);
    }
    if (n > 1) {
      // TURN: one at a time
      const c1 = rows.map(r => r.eng[1].crank > 0).indexOf(true), r0c = rows.map(r => r.eng[0].run).indexOf(true);
      if (!(c1 > r0c && r0c > 0)) F.push('TURN ' + tag + 'engine 1 cranks at frame ' + c1 + ', engine 0 caught at ' + r0c + ' (want after)');
      if (rows.some(r => r.eng.filter(e => e.crank > 0).length > 1)) F.push('TURN ' + tag + 'two engines cranking at once');
    }
    // the phases, the check at idle, the throttle on the roll
    const phs = rows.slice(1).map(r => r.ph).filter((p, i, a) => i === 0 || a[i - 1] !== p).join('>');
    if (phs !== 'start>check>roll') F.push('ORDER ' + tag + 'phases ' + phs);
    const ck = rows.filter(r => r.ph === 'check');
    if (!ck.length || ck.some(r => r.thr !== 0 || r.eng.slice(0, n).some(e => !e.run) || r.rpm.slice(0, n).some(v => Math.abs(v - L.rp(0, true)) > 1e-9))) F.push('ORDER ' + tag + 'the check is not at idle (throttle 0, every engine running at the law\'s idle)');
    const rl = rows.filter(r => r.ph === 'roll'), tMax = Math.max(...rl.map(r => r.thr)), iMax = rl.findIndex(r => r.thr === tMax);
    const iMove = rl.findIndex(r => r.x !== 0), dRpm = L.rp(tMax, true) - L.rp(0, true), rpmDrop = L.re(L.rp(tMax, true)) - L.re(L.rp(0, true));
    // (a constant-speed prop - the turboprop's governor - holds its rpm: the throttle is heard in the load, not the rpm)
    if (!(tMax >= 0.1 && tMax <= 0.2 && (L.EN.cs ? Math.abs(dRpm) < 1e-9 : dRpm >= 200 && dRpm <= 500))) F.push('ORDER ' + tag + 'the roll\'s throttle ' + tMax + ' (prop +' + dRpm.toFixed(0) + ' rpm; want 0.10-0.20, +200-500)');
    if (!(iMax >= 0 && iMove >= 0 && iMax <= iMove)) F.push('ORDER ' + tag + 'the throttle (' + iMax + ') does not lead the roll (' + iMove + ')');
    if (rl.length && rl[rl.length - 1].thr !== 0) F.push('ORDER ' + tag + 'the throttle not back to idle at the end (' + rl[rl.length - 1].thr + ')');
    if (info) info.push({ key: B.key, label: B.label, start: SP.T, check: h.plan.check.T, roll: h.plan.T.T, total: h.plan.Ttotal, n, crankRpm: SP.engines[0].crankRpm,
      idle: L.re(L.rp(0, true)), roll: h.plan.T.T, thr: tMax, rollRpm: L.re(L.rp(tMax, true)), dEng: rpmDrop, catches });
    // the plan's arithmetic
    const want = S.startLead + SP.engines.reduce((a, e, k) => a + (e.method === 'starter' ? S.crankS : 0) + (e.kind === 'electric' ? S.spinS : k === n - 1 ? S.catchCheck : S.catchNext), 0);
    if (Math.abs(SP.T - want) > 1e-9) F.push('TIMING ' + tag + 'the start lasts ' + SP.T + ' s, planned ' + want);
    if (Math.abs(h.plan.Ttotal - (SP.T + h.plan.check.T + h.plan.T.T)) > 1e-9) F.push('TIMING ' + tag + 'Ttotal is not start + check + roll');
  }
}
function checkKinds(M, F) {
  const R = M.R;
  { // the electric motor: powered, never cranked, spins up
    const B = BUILDS.find(b => b.key === 'electric'), G = garage(B), { h, rows } = record(R, G);
    const SP = h.plan.start;
    if (!(SP.n === 1 && SP.engines[0].method === 'power' && SP.engines[0].kind === 'electric')) F.push('KINDS electric: planned ' + JSON.stringify(SP.engines.map(e => [e.kind, e.method])));
    if (rows.some(r => r.eng[0].crank > 0)) F.push('KINDS electric: the motor cranked');
    const r1 = rows.findIndex(r => r.eng[0].run);
    if (!(r1 > 0 && Math.abs((r1 - 1) / 60 - SP.engines[0].tGo) <= 1.5 / 60)) F.push('KINDS electric: running at frame ' + r1 + ', powered at ' + SP.engines[0].tGo + ' s');
    const ck = rows.filter(r => r.ph === 'check'), idle = lawOf(G).rp(0, true);
    if (!ck.length || Math.abs(ck[ck.length - 1].vis[0] - idle) > 0.03 * idle) F.push('KINDS electric: the drawn prop not spun up to idle by the check\'s end (' + (ck.length ? ck[ck.length - 1].vis[0].toFixed(0) : '-') + ' / ' + idle.toFixed(0) + ')');
  }
  { // no starter: swung by hand
    const B = BUILDS.find(b => b.key === 'swing');
    if (CORE.genSystemsResolve(specOf(B)).starter !== false) F.push('KINDS swing: the build still has a starter (the fixture\'s mutation)');
    const G = garage(B), { h, rows } = record(R, G);
    const e = h.plan.start.engines[0];
    if (!(e && e.method === 'swing')) F.push('KINDS swing: planned ' + (e && e.method));
    if (rows.some(r => r.eng[0].crank > 0)) F.push('KINDS swing: a starter-less engine cranked');
    let ups = 0; for (let i = 1; i < rows.length; i++) if (rows[i].eng[0].run && !rows[i - 1].eng[0].run) ups++;
    if (ups !== 1) F.push('KINDS swing: ' + ups + ' catches');
  }
  { // no engine: no start, nothing written
    const B = BUILDS[0], G = garage(B);
    G.def = Object.assign({}, G.def, { params: Object.assign({}, G.def.params, { nEngines: 0 }) });
    G.model.props = [];   // (a glider draws no propeller)
    G.sim.out.rpm = [123]; const before = JSON.stringify(snapFields(G));
    const h = play(R, G);
    if (!(h.plan && h.plan.start.n === 0 && h.plan.start.T === 0)) F.push('KINDS no engine: a start planned (' + (h.plan && h.plan.start.n) + ' engines, ' + (h.plan && h.plan.start.T) + ' s)');
    for (let i = 0; i < 60; i++) R.frame(1 / 60);
    if (JSON.stringify(snapFields(G)) !== before) F.push('KINDS no engine: the shot wrote the engine fields (' + JSON.stringify(snapFields(G)) + ')');
    if (h.phase === 'start') F.push('KINDS no engine: a start phase');
    h.cancel();
  }
}
// the drawn prop against the voice itself: the shot's fields per frame into engine_worklet.js offline
let W48 = null;
function checkVisual(M, F) {
  const R = M.R;
  W48 = W48 || RENDER.loadWorklet(48000);
  for (const key of VALIDATED) {
    const B = BUILDS.find(b => b.key === key), G = garage(B), { h, rows } = record(R, G);
    const SP = h.plan.start, e0 = SP.engines[0], gear = e0.gear, idleP = e0.nIdle, tag = 'VISUAL ' + key + ': ';
    const cr = rows.filter(r => r.eng[0].crank > 0 && !r.eng[0].run);
    const crMean = cr.slice(Math.floor(cr.length / 3)).reduce((a, r) => a + r.vis[0], 0) / Math.max(1, cr.length - Math.floor(cr.length / 3));
    if (!(Math.abs(crMean / (e0.crankRpm / gear) - 1) < 0.25)) F.push(tag + 'the drawn prop cranks at ' + crMean.toFixed(0) + ' rpm (the voice\'s crank ' + (e0.crankRpm / gear).toFixed(0) + ')');
    const st = rows.filter(r => r.ph === 'start' || r.ph === 'check'), mx = Math.max(...st.map(r => r.vis[0]));
    if (!(mx >= 1.2 * idleP)) F.push(tag + 'no flare at the catch (' + mx.toFixed(0) + ' rpm, idle ' + idleP.toFixed(0) + ')');
    const ck = rows.filter(r => r.ph === 'check');
    if (!ck.length || Math.abs(ck[ck.length - 1].vis[0] - idleP) > 0.03 * idleP) F.push(tag + 'not back at idle by the check\'s end');
    // the voice: the frames' fields as the AudioParams (rpm = rpmEng, load, running, starter), 128-sample blocks
    const cfg = ESN.engineSoundConfig(G.def.spec, 0, CORE.POWERPLANTS);
    const v = RENDER.makeVoice(W48, cfg, 1, 0, null);
    const nb = Math.floor((SP.T + 1.0) * 48000 / 128);
    // (the frame's fields held over its blocks, as the page's k-rate params hold them; the shot's model is stepped per frame,
    // the voice per block: each frame's model value is held against the voice over that frame +-1 frame - a catch's rise is
    // ~11 000 rpm/s, a frame's phase is ~180 rpm of it)
    const vr = new Float64Array(nb);
    for (let b = 0; b < nb; b++) {
      const t = b * 128 / 48000, fi = Math.min(rows.length - 1, 1 + Math.floor(t * 60)), r = rows[fi];
      v.params.rpm[0] = r.rpmEng[0]; v.params.load[0] = r.eng[0].run ? r.thr : 0; v.params.running[0] = r.eng[0].run ? 1 : 0;
      v.params.starter[0] = r.eng[0].crank > 0 ? 1 : 0; v.params.starve[0] = 0; v.params.cold[0] = 0;
      v.proc.process(v.inputs, v.outputs, v.params);
      vr[b] = v.outputs[1][0][127] * 1000;
    }
    let worst = 0, at = 0;
    for (let i = 1; i < rows.length && rows[i].voice; i++) {
      const t = i / 60;   // (the model's value at the end of frame i)
      const b0 = Math.max(0, Math.floor((t - 2 / 60) * 375)), b1 = Math.min(nb - 1, Math.ceil((t + 1 / 60) * 375));
      if (b0 >= nb) break;
      let lo = Infinity, hi = -Infinity; for (let b = b0; b <= b1; b++) { if (vr[b] < lo) lo = vr[b]; if (vr[b] > hi) hi = vr[b]; }
      const m = rows[i].voice[0], d = m < lo ? lo - m : m > hi ? m - hi : 0;
      if (d > worst) { worst = d; at = t; }
    }
    if (!rows[1].voice) F.push(tag + 'the handle publishes no engine state (h.eng)');
    else if (!(worst <= 0.06 * cfg.idleRpm)) F.push(tag + 'the shot\'s voice rpm off the worklet\'s by ' + worst.toFixed(0) + ' rpm at ' + at.toFixed(2) + ' s (bound 6 % of idle: ' + (0.06 * cfg.idleRpm).toFixed(0) + ')');
    if (VERBOSE) console.log('  info ' + key + ': drawn crank ' + crMean.toFixed(0) + ' rpm, flare ' + mx.toFixed(0) + ' (idle ' + idleP.toFixed(0) + '), shot vs worklet worst ' + worst.toFixed(1) + ' rpm');
  }
}
async function checkRestore(M, F) {
  const R = M.R, S = R.S;
  const B = BUILDS.find(b => b.key === 'twin582');
  const cases = [['done', null], ['skip mid-crank', 1.2], ['skip after the catch', 2.6], ['skip in the check', 6.5], ['skip in the roll', 11.0], ['cancel in the start', 1.2], ['cancel in the roll', 11.0]];
  for (const handover of [false, true]) for (const flown of [false, true]) for (const [name, tAt] of cases) {
    const G = garage(B, { flown }), before = snapFields(G);
    const h = play(R, G, { handover });
    const tag = 'RESTORE ' + name + (handover ? ' (handover)' : '') + (flown ? ' (after a flight)' : '') + ': ';
    let n = 0;
    while (!h.done && n < 4000 && (tAt == null || n < tAt * 60)) { if (!R.frame(1 / 60)) break; n++; }
    if (name.startsWith('skip')) h.skip(); else if (name.startsWith('cancel')) h.cancel();
    await new Promise(r => setImmediate(r));   // (the end's onDone is a microtask after the last frame)
    {
      const now = snapFields(G);
      if (G.sim.eng.some(e => e.crank > 0)) F.push(tag + 'a starter left cranking');
      if (JSON.stringify(now.eng) !== JSON.stringify(before.eng)) F.push(tag + 'sim.eng ' + JSON.stringify(now.eng) + ' (was ' + JSON.stringify(before.eng) + ')');
      if (now.thr !== before.thr) F.push(tag + 'ctl.thr ' + now.thr + ' (was ' + before.thr + ')');
      const ho = handover && !name.startsWith('cancel');
      if (ho) {
        const idle = h.plan.start.engines.map(e => e.nIdle), idleE = h.plan.start.engines.map(e => e.nIdle * e.gear);
        if (JSON.stringify(now.rpm) !== JSON.stringify(idle) || JSON.stringify(now.rpmEng) !== JSON.stringify(idleE)) F.push(tag + 'sim.out ' + JSON.stringify(now.rpm) + ' / ' + JSON.stringify(now.rpmEng) + ' (want the stand\'s idle ' + JSON.stringify(idle) + ')');
      } else if (JSON.stringify(now.rpm) !== JSON.stringify(before.rpm) || JSON.stringify(now.rpmEng) !== JSON.stringify(before.rpmEng) || JSON.stringify(now.tp) !== JSON.stringify(before.tp)) F.push(tag + 'sim.out ' + JSON.stringify(now.rpm) + ' / ' + JSON.stringify(now.rpmEng) + ' (was ' + JSON.stringify(before.rpm) + ' / ' + JSON.stringify(before.rpmEng) + ')');
      if (R.busy()) F.push(tag + 'still playing');
    }
  }
  void S;
}

// ---- THE SPACE: space.js on a stub Web Audio ------------------------------------------------------------------
function stubParam(v) { return { value: v, last: v, setTargetAtTime(x) { this.last = x; this.value = x; return this; }, setValueAtTime(x) { this.last = x; this.value = x; return this; }, cancelScheduledValues() { return this; } }; }
function stubCtx() {
  const node = extra => Object.assign({ connect() {}, disconnect() {} }, extra);
  return { currentTime: 0, sampleRate: 48000,
    createGain: () => node({ gain: stubParam(1) }),
    createBiquadFilter: () => node({ type: '', frequency: stubParam(350), Q: stubParam(1), gain: stubParam(0) }),
    createPanner: () => node({ positionX: stubParam(0), positionY: stubParam(0), positionZ: stubParam(0), panningModel: 'equalpower', refDistance: 1 }),
    createConvolver: () => node({ buffer: null, normalize: true }),
    createChannelSplitter: () => node({}),
    createBuffer: (ch, n, sr) => { const d = [new Float32Array(n), new Float32Array(n)]; return { getChannelData: i => d[i], copyToChannel(a, i) { d[i].set(a); } }; } };
}
function loadSpace(src) {
  const ctx = stubCtx(), buses = {}, events = {};
  const A = { enabled: true, ctx, voices: {}, lagS: new Float64Array(1),
    bus: n => buses[n] || (buses[n] = { connect() {}, gain: stubParam(1) }), get: () => 0, emit() {}, onEvent(t, fn) { events[t] = fn; },
    addSource(name, s) { A.src = s; }, refreshGains() {} };
  const win = { AUDIO: A, SPACE_CONFIG: SC, requestIdleCallback: fn => { fn(); return 1; }, GARAGE_ENV: { dims: () => ({ HW: 15, HD: 12.5, EAVE: 7 }), shell: () => 'club' }, performance: { now: () => 0 } };
  const c = vm.createContext({ window: win, console: { warn() {}, log() {}, error() {} } });
  vm.runInContext(src, c, { filename: 'space.js' });
  return { A, sp: A.space };
}
function checkSpace(M, F) {
  const { A, sp } = loadSpace(M.space);
  if (!sp || !sp.shotPose || sp.shotPose.length < 5) { F.push('SPACE: space.js publishes no shotPose'); return; }
  const G = garage(BUILDS[0]), P = AP.audioParamsBlock(), cam = { mode: 'chase', inGarage: true, held: false, p: new Float64Array(3) };
  const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 1000); camera.position.set(-8, 2, -10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
  cam.p[0] = camera.position.x; cam.p[1] = camera.position.y; cam.p[2] = camera.position.z;
  const api = { camera, sim: G.sim };
  const frame = () => { AP.audioParams(G.sim, cam, G.def, P, null, 1 / 60); sp.shedCheck(); A.src.update(P, 1 / 60, api); };
  const R = G.def.refs, eo = R.engineOf || R.engine.map(() => 0), list = R.engine.filter((j, i) => (eo[i] | 0) === 0);
  const emitter = () => { let x = 0, y = 0, z = 0; for (const j of list) { x += G.sim.p[j * 3]; y += G.sim.p[j * 3 + 1]; z += G.sim.p[j * 3 + 2]; } return [x / list.length, y / list.length, z / list.length]; };
  const LW = sp.LW, dist0 = () => sp.frame[0 * LW + 9];
  sp.input('engine', 0);   // (the engine's group, as src_engine makes it)
  for (let i = 0; i < 3; i++) frame();
  if (Math.abs(dist0() - 8) > 1e-9) F.push('SPACE: in the shed without the pose the engine is not in the room mode (dist ' + dist0() + ', want 8)');
  const gW = sp.graph();
  if (Math.abs(gW.revA.gain.last - 0.25) > 1e-9) F.push('SPACE: the shed\'s aircraft wet send ' + gW.revA.gain.last + ' (want 0.25)');
  const pose = sp.shotPose, e = emitter();
  for (const [dx, inside] of [[0, 1], [-6, 0.6], [-14, 0]]) {
    pose[0] = 1; pose[1] = dx; pose[2] = 0.01; pose[3] = 0; pose[4] = inside;
    for (let i = 0; i < 12; i++) frame();   // (a jump of 8 m: the retarded solve hears the past for its travel time)
    const want = Math.hypot(e[0] + dx - camera.position.x, e[1] + 0.01 - camera.position.y, e[2] - camera.position.z);
    if (Math.abs(dist0() - want) > 1e-6) F.push('SPACE: the pose at dx ' + dx + ': the engine group heard ' + dist0().toFixed(4) + ' m away (want ' + want.toFixed(4) + ': where it stands)');
    const wantW = Math.round((0.3 + 0.7 * inside) * 50) / 50 * 0.25;
    if (Math.abs(gW.revA.gain.last - wantW) > 1e-9) F.push('SPACE: the pose inside ' + inside + ': the aircraft wet send ' + gW.revA.gain.last + ' (want ' + wantW + ')');
    if (Math.abs(gW.revMus.gain.last - 0.12) > 1e-9) F.push('SPACE: the pose moved the music\'s wet send (' + gW.revMus.gain.last + ')');
  }
  pose[0] = 0;
  for (let i = 0; i < 3; i++) frame();
  if (Math.abs(dist0() - 8) > 1e-9 || Math.abs(gW.revA.gain.last - 0.25) > 1e-9) F.push('SPACE: the pose off did not bring the room mode back (dist ' + dist0() + ', wet ' + gW.revA.gain.last + ')');
  // the budget: shot frames, the aeroplane rolling - space.js's update alone (the parameter block filled once: the INLINE
  // solver's wheelContacts() builds an object a call, which GATE AUDIO's budget avoids with a worker-shaped sim; it holds
  // audio_params and the sources at 0 GC, this the space's shot path)
  if (M.budget) {
    pose[0] = 1; pose[4] = 1;
    AP.audioParams(G.sim, cam, G.def, P, null, 1 / 60);
    let x = 0;
    const f2 = () => { x -= 0.002; pose[1] = x; pose[4] = x > -8 ? 1 : 0.3; A.src.update(P, 1 / 60, api); };
    for (let i = 0; i < 20000; i++) f2();
    global.gc(); global.gc();
    const h0 = process.memoryUsage().heapUsed, t0 = process.hrtime.bigint();
    for (let i = 0; i < 10000; i++) f2();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 10000, per = (process.memoryUsage().heapUsed - h0) / 10000;
    // (the allocation is GATE AUDIO's SP_BUDGET's shot row: a fresh process, the real sources - this stub's AudioParams are
    // JS methods taking doubles, which box on their own)
    if (!(ms < 0.3)) F.push('SPACE: a shot frame of the space costs ' + ms.toFixed(4) + ' ms (bound 0.3)');
    if (VERBOSE) console.log('  info SPACE budget: ' + per.toFixed(2) + ' B / frame, ' + (ms * 1000).toFixed(1) + ' us / frame (space.js update, the shot\'s pose on, rolling; GATE AUDIO SP_BUDGET holds audio_params and the sources)');
    pose[0] = 0;
  }
}
function checkWiring(M, F) {
  const a = M.app, i0 = a.indexOf('function rollAnimPlay('), body = a.slice(i0, a.indexOf('function rollAnimSolo', i0));
  if (!/handover: !!handover/.test(body)) F.push('WIRING: rollAnimPlay does not hand the shot `handover`');
  if (!/audioPose: window\.AUDIO && AUDIO\.space \? AUDIO\.space\.shotPose : null/.test(body)) F.push('WIRING: rollAnimPlay does not hand the shot space.js\'s shotPose');
  const j0 = a.indexOf('function rollAnim(trip, next)'), ra = a.slice(j0, a.indexOf('function rollOutStand', j0));
  if (!/\}, true\);/.test(ra)) F.push('WIRING: the roll-out does not ask for the handover');
  const so = a.slice(a.indexOf('function rollAnimSolo'), a.indexOf('window.FLYDIY_ROLLANIM = rollAnimSolo'));
  if (/\}, true\)/.test(so)) F.push('WIRING: the solo shot hands over (it goes back to the shed: every field must come back)');
  if (!/shedNow, shedCheck, shotPose \}/.test(M.space)) F.push('WIRING: space.js\'s api has no shotPose');
}

// ---- the run ----------------------------------------------------------------------------------------------------
async function runAll(src, opts) {
  const o = opts || {};
  const M = { R: loadRA(src.ra), space: src.space, app: src.app, budget: !!o.budget };
  const F = [], info = [];
  const step = (name, fn) => { try { fn(); } catch (e) { F.push(name + ' threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); } };
  step('ORDER', () => checkOrder(M, F, info));
  step('KINDS', () => checkKinds(M, F));
  step('VISUAL', () => checkVisual(M, F));
  try { await checkRestore(M, F); } catch (e) { F.push('RESTORE threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
  step('SPACE', () => checkSpace(M, F));
  step('WIRING', () => checkWiring(M, F));
  return { F, info };
}
const MUTATIONS = [
  ['the starter becomes a swing (no crank before the catch)', 'ra', "P_START = { key: 'both', start: true }", "P_START = { key: 'both', swing: true }"],
  ['the twin\'s engines start together', 'ra', "t += crank + (kind === 2 ? S.spinS : last ? S.catchCheck : S.catchNext);", "t += k === n - 1 ? crank + S.catchCheck : 0;"],
  ['the electric motor cranks', 'ra', "const method = kind === 2 ? 'power' :", "const method = kind === 2 ? 'starter' :"],
  ['the crank counted down twice as fast', 'ra', "if (e.crank > 0) { e.crank -= d;", "if (e.crank > 0) { e.crank -= 2 * d;"],
  ['the thrust left out', 'ra', "if (out.thrustPer[k] !== ti) out.thrustPer[k] = ti;", ""],
  ['the shaft law bypassed (idle at any throttle)', 'ra', "Math.sqrt(eI2[k] + eD2[k] * te)", "Math.sqrt(eI2[k])"],
  ['no throttle on the roll', 'ra', "rollThr: 0.14,", "rollThr: 0,"],
  ['the check off idle', 'ra', "if (NE) { st[11] = 0; st[12] = d; engStep(); }", "if (NE) { st[11] = 0.05; st[12] = d; engStep(); }"],
  ['the catch\'s surge lost from the drawn prop', 'ra', "0.45 * idle * Math.sin(Math.PI * (cT - 0.25))", "0"],
  ['the drawn prop at the solver\'s 0 while cranking', 'ra', "tgt = rIn > eCrank[k] * env ? rIn : eCrank[k] * env; tau = 0.2;", "tgt = rIn; tau = 0.2;"],
  ['the engines not put back', 'ra', "      engBack(how);", ""],
  ['a cancel hands over', 'ra', "if (o.handover && how !== 'cancel') {", "if (o.handover) {"],
  ['the handover forgotten', 'ra', "if (o.handover && how !== 'cancel') {", "if (false) {"],
  ['a no-engine build starts', 'ra', " || P_.nEngines === 0) return", ") return"],
  ['the engines not stopped at the first frame', 'ra', "for (let k = 0; k < NE; k++) { engSet(k, P_OFF);", "for (let k = 0; k < NE; k++) { engSet(k, P_KEY);"],
  ['the space ignores the pose', 'space', "if (shot) { PB[1] += shotPose[1];", "if (false) { PB[1] += shotPose[1];"],
  ['the shed stays in the room mode', 'space', "const room = (garage && !shot) || !p || !noseN;", "const room = garage || !p || !noseN;"],
  ['the wet send deaf to the door', 'space', "(k === 0 ? WETS[k] * kA : WETS[k])", "WETS[k]"],
  ['the roll-out does not hand over', 'app', "    }, true);\n  }\n  window.addEventListener('keydown', e => { if (rollAnimSkip", "    });\n  }\n  window.addEventListener('keydown', e => { if (rollAnimSkip"],
  ['the shot gets no pose', 'app', "audioPose: window.AUDIO && AUDIO.space ? AUDIO.space.shotPose : null,", "audioPose: null,"],
];
(async () => {
  const t0 = Date.now();
  const base = await runAll(SRC0, { budget: true });
  const fails = base.F.slice();
  if (VERBOSE || fails.length) for (const f of fails) console.log('  FAIL ' + f);
  // the timing table (the four validated builds)
  console.log('  THE SHOT\'S PHASES (the club shed, the garage\'s own framing: the app\'s front shot), seconds:');
  for (const r of base.info.filter(r => VALIDATED.includes(r.key) || r.key === 'pt6'))
    console.log('    ' + r.label.padEnd(36) + ' start ' + r.start.toFixed(2) + ' + check ' + r.check.toFixed(2) + ' + roll ' + r.roll.toFixed(2) + ' = ' + r.total.toFixed(2) +
      '  (' + r.n + ' engine' + (r.n > 1 ? 's' : '') + ', crank ' + r.crankRpm + ' rpm, idle ' + r.idle.toFixed(0) + ', the roll\'s ' + r.thr.toFixed(2) + ' throttle ' + r.rollRpm.toFixed(0) + ' rpm)');
  // THE SELFTEST
  let caught = 0;
  for (const [name, file, a, b] of MUTATIONS) {
    if (SRC0[file].indexOf(a) < 0) { fails.push('SELFTEST: the mutation "' + name + '" no longer applies (its text is gone from ' + FILES[file] + ')'); continue; }
    const src = Object.assign({}, SRC0, { [file]: SRC0[file].split(a).join(b) });
    const r = await runAll(src);
    if (r.F.length) { caught++; if (VERBOSE) console.log('  ok   SELFTEST "' + name + '" red: ' + r.F[0].slice(0, 140)); }
    else fails.push('SELFTEST: the mutation "' + name + '" stayed green');
  }
  if (hash() !== HASH0) fails.push('SELFTEST: the sources changed on disk during the run');
  console.log('  ' + caught + ' / ' + MUTATIONS.length + ' mutations caught; ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  if (fails.length) { console.log('GATE ROLLSND: FAIL (' + fails.length + ': ' + fails.slice(0, 3).join('; ') + ')'); process.exit(1); }
  console.log('GATE ROLLSND: PASS');
})().catch(e => { console.log(e && e.stack); console.log('GATE ROLLSND: FAIL (' + (e && e.message) + ')'); process.exit(1); });
