#!/usr/bin/env node
// THE ROLL-OUT SHOT, HEARD OFFLINE (SND-ROLLOUT, G1717; the evidence for the Sound Coordinator). The shot is PLAYED - the
// real rollanim.js on the real solver (tools/flight_core.js) and the user's validated builds, in the club shed with the
// garage's own framing (the app's front shot), driven at 60 Hz through the host's hook as app.js drives it - and each frame's
// fields (sim.eng key / crank / running, sim.out.rpm / rpmEng / thrustPer, sim.ctl.thr, the aeroplane's offset and its door
// share: the shot's audioPose) are what the voices are fed, block by block (128 samples at 48 kHz): engine_worklet.js and
// prop_worklet.js under render.js's shim, chained as the page chains them (the engine's control output IS the prop's input),
// the engine's params as src_engine.js schedules them (rpm = rpmEng, load = the lever x running, running, starter =
// crank > 0, cold = the first 240 s of running), the prop's as src_prop.js (thrust, the lever). THE SPACE as space.js hears
// the shot (its shotPose path, space_config.js's laws): each engine group where it stands + the roll, from the shot's own
// camera - the directivity by kind (exhaust / tonal / broadband) off the nose, the inverse distance from the build's
// refDistance, the air's absorption, the equal-power pan in the camera's frame - and the shed: the aircraft's wet send
// (0.25 x (0.3 + 0.7 x the engines' share inside), in space.js's 2 % steps) through the club shed's generated IR
// (space_config.hangarIR). Left out (said in the README): the doppler (<= 1.5 % at the roll's pace) and the 30-50 ms travel
// time - the page applies both - and the ambience, the music, the airframe voice (no tyre sound on the shed's floor: the
// airframe voice reads the solver's V, 0 in the kinematic roll).
//
//   node tools/audio/rollout_render.js               -> reports/evidence/SND-ROLLOUT/<build>_rollout.ogg + .png, summary.json
//   node tools/audio/rollout_render.js --only=cub    one build;  --wav  WAVs beside
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = require('./render.js'), RP = require('./render_prop.js'), SR_ = require('./space_render.js');
const ROOT = R.ROOT, at = p => path.join(ROOT, p);
const OUT_DIR = at('reports/evidence/SND-ROLLOUT');
const SR = 48000, BLOCK = R.BLOCK;

const CORE = require(at('tools/flight_core.js'));
for (const k of Object.keys(CORE)) global[k] = CORE[k];
const THREE = require(at('vendor/three.min.js'));
global.THREE = THREE;
global.window = new (require('events').EventEmitter)();
global.window.addEventListener = () => {}; global.window.removeEventListener = () => {};
const ESN = require(at('src/viewer/audio/engine_config.js'));
global.window.ENGINE_SOUND = ESN;
const SC = require(at('src/viewer/audio/space_config.js'));
const ROLLANIM = require(at('src/viewer/rollanim.js'));

const BUILDS = [
  { key: 'cub', label: "the user's Cub (Continental A-65, direct drive)" },
  { key: 'jodel', label: 'the Jodel D112 (Continental A-65)' },
  { key: 'cessna', label: 'the Cessna 172 (custom flat four 5.9 L)' },
  { key: 'twin582', label: 'the twin-582 (two Rotax 582 two-strokes, 2.62 reduction)' },
];

// the shed as app.js stands it, the club shed (GATE ROLLSND's rig)
function garage(spec) {
  const def = CORE.buildGen(JSON.parse(JSON.stringify(spec)));
  const sim = CORE.makeSim(def, null);
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
  return { def, sim, scene, craft, model, hangar, cam, dims };
}

// THE SHOT, played: a row a frame (60 Hz)
function playShot(spec) {
  const G = garage(spec), pose = new Float64Array(5);
  const h = ROLLANIM.play({ craft: G.craft, scene: G.scene, camera: G.cam, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim,
    follow: false, front: { az: -2.5, el: 0.22, dist: 14 }, audioPose: pose, handover: true, onDone: () => {} });
  const rows = [];
  const row = () => { const o = G.sim.out; rows.push({ ph: h.phase, thr: G.sim.ctl.thr, eng: G.sim.eng.map(e => ({ key: e.key, crank: e.crank, run: !!e.running })),
    rpm: (o.rpm || []).slice(), rpmEng: (o.rpmEng || []).slice(), tp: (o.thrustPer || []).slice(), pose: Array.from(pose) }); };
  row();
  for (let n = 0; n < 4000; n++) { if (!ROLLANIM.frame(1 / 60)) break; G.cam.updateMatrixWorld(true); row(); }
  // the shot's camera (held: the front shot) and its frame
  const cam = G.cam, me = cam.matrixWorld.elements;
  return { G, h, rows, eye: [cam.position.x, cam.position.y, cam.position.z], right: [me[0], me[1], me[2]], up: [me[4], me[5], me[6]], back: [me[8], me[9], me[10]] };
}

function renderBuild(Wk, entry, IR) {
  const PB = RP.PROP_BUILDS.find(b => b.key === entry.key);
  const B = RP.loadPropBuild(PB);
  const S = playShot(B.spec);
  const { G, h, rows } = S, n = h.plan.start.n, refs = G.def.refs;
  const nE = Math.max(1, n);
  // the chains, from rest (the cold start: not running, rpm 0); a twin's engines at the count gain (src_engine.js)
  const kN = ESN.engineSoundCountGain(ESN.engineSoundPistonCount(B.spec));
  const chains = [];
  for (let k = 0; k < nE; k++) {
    const ch = RP.makeChain(Wk, B, k, { seed: 1 + k, heat: 0, state: null });
    if (ch.drv.kind === 'piston' && kN < 1) { const c2 = Object.assign({}, ch.ecfg, { gain: ch.ecfg.gain * kN }); ch.drv = Object.assign(R.makeVoice(Wk.E, c2, 1 + k * 7919, 0, null), { kind: 'piston' }); ch.pin[0][0] = ch.drv.outputs[1][0]; ch.pin[0][1] = ch.drv.outputs[1][1]; }
    chains.push(ch);
  }
  // each engine group's nodes (space.js resolve: refs.engine by refs.engineOf)
  const eo = refs.engineOf || refs.engine.map(() => 0);
  const grp = []; for (let k = 0; k < nE; k++) { const l = refs.engine.filter((j, i) => (eo[i] | 0) === k); grp.push(l.length ? l : refs.engine); }
  const p0 = G.sim.p, gpos = grp.map(l => { let x = 0, y = 0, z = 0; for (const j of l) { x += p0[j * 3]; y += p0[j * 3 + 1]; z += p0[j * 3 + 2]; } return [x / l.length, y / l.length, z / l.length]; });
  const ref = Math.max(6, Math.min(20, +G.def.params.viewDist || 12)), FWD = [-1, 0, 0];   // (the nose toward the door: -x)
  const T = rows.length / 60 + 1.5, nb = Math.ceil(T * SR / BLOCK), N = nb * BLOCK;
  const L = new Float32Array(N), Rr = new Float32Array(N), send = new Float32Array(N);
  const ctlE = new Float32Array(nb);
  const runS = new Float64Array(nE), pg = new Float64Array(3), pg0 = new Float64Array(nE * 2);
  const lp = chains.map(() => SR_.biquad('lowpass', 20000, -3.01, 0));
  const xb = new Float32Array(BLOCK), yb = new Float32Array(BLOCK);
  const p = { thr: 0, V: 0, alpha: 0, beta: 0, running: 0, starter: 0, interior: 0, cold: 0 };
  let wetK = 0.25;
  for (let b = 0; b < nb; b++) {
    const t = b * BLOCK / SR, fi = Math.min(rows.length - 1, Math.floor(t * 60)), r = rows[fi], o = b * BLOCK;
    const pose = r.pose;
    for (let k = 0; k < nE; k++) {
      const ch = chains[k], e = r.eng[k] || { run: false, crank: 0 };
      runS[k] = e.run ? runS[k] + BLOCK / SR : 0;
      p.thr = r.thr; p.running = e.run ? 1 : 0; p.starter = e.crank > 0 ? 1 : 0;
      p.rpmOver = r.rpm[k] || 0; p.thrustOver = r.tp[k] || 0; p.cold = e.run ? Math.max(0, 1 - runS[k] / 240) : 0;
      RP.stepChain(ch, p);
      if (k === 0) ctlE[b] = ch.drv.outputs[1][0][BLOCK - 1] * 1000;
      // the space: the group where it stands + the roll, seen from the shot's camera
      const sx = gpos[k][0] + pose[1], sy = gpos[k][1] + pose[2], sz = gpos[k][2] + pose[3];
      const rx = sx - S.eye[0], ry = sy - S.eye[1], rz = sz - S.eye[2], d = Math.hypot(rx, ry, rz) || 1;
      const nx = -rx / d, ny = -ry / d, nz = -rz / d, cosT = FWD[0] * nx + FWD[1] * ny + FWD[2] * nz;
      const gE = SC.directivity(SC.DIR_EXHAUST, cosT), gT = SC.directivity(SC.DIR_TONAL, cosT), gB = SC.directivity(SC.DIR_BROAD, cosT);
      SR_.pannerGains(rx * S.right[0] + ry * S.right[1] + rz * S.right[2], rx * S.up[0] + ry * S.up[1] + rz * S.up[2], rx * S.back[0] + ry * S.back[1] + rz * S.back[2], ref, pg);
      lp[k].set(SC.airAbsorptionHz(d));
      const de = ch.drv.outputs[0][0], t0 = ch.pout[1][0], t1 = ch.pout[1][1];
      for (let i = 0; i < BLOCK; i++) xb[i] = gE * de[i] + gT * t0[i] + gB * t1[i];
      lp[k].run(xb, yb, BLOCK);
      const a0 = b ? pg0[k * 2] : pg[0], a1 = b ? pg0[k * 2 + 1] : pg[1];
      for (let i = 0; i < BLOCK; i++) { const u = i / BLOCK; L[o + i] += yb[i] * (a0 + (pg[0] - a0) * u); Rr[o + i] += yb[i] * (a1 + (pg[1] - a1) * u); }
      pg0[k * 2] = pg[0]; pg0[k * 2 + 1] = pg[1];
    }
    // the shed's wet send: space.js's, the aircraft bus x 0.25 x (0.3 + 0.7 inside) in 2 % steps (eased: WET_TAU 0.3 s)
    const want = pose[0] > 0 ? 0.25 * Math.round((0.3 + 0.7 * pose[4]) * 50) / 50 : 0.25;
    wetK += (want - wetK) * (1 - Math.exp(-BLOCK / SR / 0.3));
    for (let i = 0; i < BLOCK; i++) send[o + i] = wetK * 0.5 * (L[o + i] + Rr[o + i]);
  }
  const wL = SR_.convolve(send, IR.L), wR = SR_.convolve(send, IR.R);
  for (let i = 0; i < N; i++) { L[i] += wL[i]; Rr[i] += wR[i]; }
  // the timeline's marks
  const tOf = f => +(f / 60).toFixed(2), first = fn => { const i = rows.findIndex(fn); return i < 0 ? null : tOf(i); };
  const marks = { key: first(r => r.eng.every(e => e.key === 'both')), engines: [], check: first(r => r.ph === 'check'), roll: first(r => r.ph === 'roll'),
    throttle: first(r => r.thr > 0), thrMax: Math.max(...rows.map(r => r.thr)), idleAgain: null, doorOut: first(r => r.pose[0] > 0 && r.pose[4] < 0.5), end: tOf(rows.length) };
  for (let k = 0; k < n; k++) marks.engines.push({ crank: first(r => r.eng[k].crank > 0), catch: first(r => r.eng[k].run), method: h.plan.start.engines[k].method });
  const iMax = rows.findIndex(r => r.thr === marks.thrMax); const iIdle = rows.findIndex((r, i) => i > iMax && r.thr === 0); marks.idleAgain = iIdle < 0 ? null : tOf(iIdle);
  const rpm = { idle: Math.round(rows.find(r => r.ph === 'check').rpmEng[0]), roll: Math.round(Math.max(...rows.map(r => r.rpmEng[0] || 0))),
    crankVoice: Math.round(chains[0].ecfg.crankRpm || 0), flareVoice: Math.round(Math.max(...Array.from(ctlE.slice(0, Math.floor((marks.check || 3) * SR / BLOCK) + 100)))) };
  return { L, R: Rr, ctlE, marks, rpm, plan: { start: h.plan.start.T, check: h.plan.check.T, roll: h.plan.T.T, total: h.plan.Ttotal }, chains, label: entry.label, eye: S.eye };
}

// ONE listening gain for every file (+18 dB): the shot's engines at 14 m peak at -25 to -28 dBFS as the page mixes them (before
// the master and the volume); the same gain on all four keeps their levels against each other
const LISTEN_DB = 18;
function writeOut(name, L, Rr, ctlE, fpr) {
  const n = L.length, gl = Math.pow(10, LISTEN_DB / 20);
  for (let i = 0; i < n; i++) { L[i] *= gl; Rr[i] *= gl; }
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
  const buf = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { buf.writeFloatLE(L[i], i * 8); buf.writeFloatLE(Rr[i], i * 8 + 4); }
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '64k', path.join(OUT_DIR, name + '.ogg')], { input: buf });
  if (process.argv.includes('--wav')) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'pcm_s16le', path.join(OUT_DIR, name + '.wav')], { input: buf });
  const mono = new Float32Array(n); for (let i = 0; i < n; i++) mono[i] = 0.5 * (L[i] + Rr[i]);
  const firing = t => ctlE[Math.min(ctlE.length - 1, Math.floor(t * SR / BLOCK))] / 60 * fpr;
  fs.writeFileSync(path.join(OUT_DIR, name + '.png'), R.spectrogramPng(mono, SR, { firing, width: 768 }));
  let ss = 0; for (let i = 0; i < n; i++) ss += mono[i] * mono[i];
  return { listenDb: LISTEN_DB, peak: +pk.toFixed(3), rmsDb: +(20 * Math.log10(Math.sqrt(ss / n) + 1e-12)).toFixed(1), seconds: +(n / SR).toFixed(2) };
}

function main() {
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const Wk = RP.loadAll(SR);
  const IR = SC.hangarIR(SC.hangarAcoustics({ HW: 15, HD: 12.5, EAVE: 7 }, 'club'), SR);
  const summary = {};
  for (const e of BUILDS) {
    if (only.length && !only.includes(e.key)) continue;
    const r = renderBuild(Wk, e, IR);
    const w = writeOut(e.key + '_rollout', r.L, r.R, r.ctlE, r.chains[0].ecfg.firingPerRev || 2);
    summary[e.key] = Object.assign({ label: r.label }, r.plan, { marks: r.marks, rpm: r.rpm }, w);
    console.log(e.key.padEnd(8) + ' ' + JSON.stringify(summary[e.key]));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
}
if (require.main === module) main();
