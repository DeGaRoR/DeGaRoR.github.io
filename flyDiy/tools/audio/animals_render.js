#!/usr/bin/env node
// THE ANIMALS' VOICES, HEARD OFFLINE (G1709, SND-ANIMALS; SOUND-2026-10-04 §6.3 / §8 evidence).
//
// Five short scenes on JOLENE - the island the game ships (media/world/jolene + the premises fixture
// tools/fixtures/island_jolene.json, composed by the real world module), with the island's own animals: the record's
// eight hotspots, run by the page's OWN animals layer (src/viewer/animals.js + animal_run.js on three and the shipped
// payload, tools/audio/animal_world.js) - the real dive cycle, the real clip machine, the real flocks - and heard through
// the page's own sound code (samples.js, the ambience, emitters_model.js, emitters.js in a vm under a RECORDING
// AudioContext; the shipped MP3s decoded by ffmpeg), the animals read by the same read-only reader the page reads
// (animal_run.js sound() -> render_premises' animalSounds -> the emitters' provider):
//   1 the orca pod: a pass at 40 m over Annette's sea lane, 45 m/s, timed (from a scan of the pod's own dive cycle)
//     so that two of the five surface during it
//   2 the elk meadow at dusk: the Tamgas sanctuary's herd of six, the listener standing 250 m off at 21:48
//   3 a low pass near the bear: three passes at 25 m AGL, 20 m beside it, 40 m/s (the startle is 40 % a pass, once in
//     3 minutes at most)
//   4 a gull flock crossing: under the dock's flock (seven, circling 200 m at 45 m), and the ambient flocks
//   5 the walk to the Kennecott mill: its recorded stamp loop (mill.stamp), seven pounds onset to onset
// The mix is rendered from what the sources SCHEDULED (emitters_render.js's mixdown: each call through its gain, its
// absorption low-pass, the panner's inverse distance and equal-power pan in the camera's frame, its playbackRate), the
// emitters ALONE (no engine, no beds: the beds are SND-AMB-1's evidence; the engine is the aircraft's). Each scene has its
// own seed (one draw, stated in summary.json).
//
//   node tools/audio/animals_render.js          -> reports/evidence/SND-ANIMALS/: <scene>.opus, timeline.png,
//                                                  summary.json (README.md is hand-written)
//   node tools/audio/animals_render.js --wav    -> a WAV beside each Opus
//   node tools/audio/animals_render.js --only=orca,bear
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const at = p => path.join(ROOT, p);
const OUT = at('reports/evidence/SND-ANIMALS');
const SR = 48000, FPS = 60, DT = 1 / FPS;
const AR = require('./ambience_render.js');
const ER = require('./emitters_render.js');
const AW = require('./animal_world.js');

// ---- THE CAST: the record's hotspots, as render_premises hands them to the runner (the premises frame applied) --------
function spotsOf(W) {
  const F = W.premises.overlay.frame;
  return W.premises.rec.layers.objects.filter(o => o.kind === 'animal').map(sp => { const w = F.toWorld(sp.x, sp.z);
    return { id: sp.id, key: sp.key, x: w[0], z: w[1], n: sp.n, r: sp.r, yaw: (sp.yaw || 0) + (F.yaw || 0), dy: sp.dy }; });
}
const water = W => (x, z) => { const w = W.waterH(x, z); return w > -1e8 ? w : -Infinity; };

// ---- THE SCENES: [key, name, local hours, seconds, seed, path(t, ctx) -> [x, z, h AGL, heading x, heading z]] ----------
// ctx: { W, spot(id) } and, for the pod, the pass's centre time found by scan (ctx.T0: the animals' clock at the start)
function scenes(W, spots) {
  const S = id => spots.find(s => s.id === id);
  const pod = S('a4'), elk = S('a7'), bear = S('a2'), gulls = S('a6');
  const mill = ER.itemWorld(W, 'mn_s_mine', 'mill');
  return [
    ['orca', 'a pass over the orca pod as two of them surface', 15, 40, 1,
      t => [pod.x - 900 + 45 * t, pod.z + 20, 40, 1, 0]],
    ['elk', 'the elk meadow at dusk (the sanctuary herd, 250 m off)', 21.8, 150, 2,
      t => [elk.x + 250, elk.z + 30, 1.7, -1, 0]],
    ['bear', 'three low passes beside the bear (25 m AGL, 20 m off)', 15, 120, 3,
      t => { const u = t % 40; return [bear.x - 800 + 40 * u, bear.z + 20, 25, 1, 0]; }],
    ['gulls', 'under the dock\'s gull flock as it circles over (and the ambient flocks)', 15, 90, 4,
      t => [gulls.x + 120, gulls.z, 1.7, -1, 0]],
    ['mill', 'the walk to the Kennecott mill (its recorded stamp loop)', 15, 45, 5,
      t => { const u = Math.min(1, t / 45); return [mill[0] - 260 + 170 * u, mill[2] + 40 - 20 * u, 1.7, 170, -20]; }],
  ];
}

// the pod's surfacings over 10 min of its own dive cycle (the animals alone, fast): the start time whose 40 s pass sees
// the most surfacings within 400 m of the centre in its middle 20 s (two wanted)
function scanPod(L, W, spots) {
  const R = L.make({ ground: W.terrainH, waterH: water(W) });
  R.sync(spots.filter(s => s.id === 'a4'));
  const out = new Float64Array(64 * 12), ev = [], pod = spots.find(s => s.id === 'a4');
  let last = 0;
  for (let i = 0; i < 600 * FPS; i++) {
    R.tick(DT); const n = R.sound(out), c = R.clock();
    for (let k = 0; k < n; k++) if (out[k * 12 + 8] > last) ev.push([i * DT, out[k * 12 + 1], out[k * 12 + 3]]);
    last = c;
  }
  let best = { t0: 0, n: -1 };
  for (let t0 = 0; t0 < 560; t0 += 0.5) {
    const n = ev.filter(e => e[0] >= t0 + 12 && e[0] <= t0 + 30 && Math.hypot(e[1] - (pod.x - 900 + 45 * (e[0] - t0)), e[2] - pod.z) < 400).length;
    if (n > best.n) best = { t0, n };
    if (n >= 2) { best = { t0, n }; break; }
  }
  return best;
}

async function runScene(L, W, spots, sc, opts) {
  const [key, name, hours, dur, seed, path] = sc;
  AR.setClock(W, hours);
  const H = ER.harness(W, 'gamer', null);
  H.win.HOUSE_GEN = ER.housePresetsMill();
  const eye = { x: 0, y: 0, z: 0 };
  const R = L.make({ ground: W.terrainH, waterH: water(W), eye: () => eye });
  R.sync(spots);
  if (key === 'gulls') R.ambient(2, 'bird');
  // the run before the scene (the pod: to the scan's start; the others a minute, so nothing is fresh-sown)
  const pre = opts.pre != null ? opts.pre : 60;
  const q0 = path(0);
  eye.x = q0[0]; eye.z = q0[1];
  for (let i = 0; i < Math.round(pre * FPS); i++) R.tick(DT);
  H.win.ANIMAL_RUN = { SOUND: L.AR.SOUND };
  H.win.WORLD = { premises: { soundObjects: () => 0, animalSounds: out => R.sound(out), animalClock: () => R.clock() } };
  const cam = { matrixWorld: { elements: new Float64Array(16) } };
  H.win.AUDIO.camera = cam;
  const dc = {};
  const ff = b => { const k = b.length + ':' + b[100] + ':' + b[b.length - 50]; if (!dc[k]) dc[k] = ER.decodeMp3(b); return dc[k]; };
  H.ctx.decodeAudioData = function (ab, ok, err) { H.rec.decodes++; const p = Promise.resolve().then(() => { const d = ff(new Uint8Array(ab)); return { numberOfChannels: 1, length: d.length, sampleRate: SR, duration: d.length / SR, getChannelData: () => d }; }); p.then(ok, err || (() => {})); return p; };
  // the first frame connects the sources; the emitters' state exists from then
  await H.frame(DT);
  const E = H.E(), st = E.state, M = E.model;
  st.log = []; M.seed(st, 2000 + seed);
  const rows = [], tags = [];
  const N = Math.round(dur * FPS);
  let birds = [];
  for (let f = 0; f < N; f++) {
    const t = f * DT, q = path(t);
    const g = Math.max(W.terrainH(q[0], q[1]), W.waterH(q[0], q[1]));
    eye.x = q[0]; eye.y = g + q[2]; eye.z = q[1];
    H.P.s[H.I.listenerX] = q[0]; H.P.s[H.I.listenerY] = g + q[2]; H.P.s[H.I.listenerZ] = q[1];
    const hl = Math.hypot(q[3], q[4]) || 1, fx = q[3] / hl, fz = q[4] / hl, e = cam.matrixWorld.elements;
    e[0] = -fz; e[1] = 0; e[2] = fx; e[4] = 0; e[5] = 1; e[6] = 0; e[8] = -fx; e[9] = 0; e[10] = -fz;
    R.tick(DT);
    const n0 = st.log.length;
    await H.frame(DT);
    // which of this frame's calls came from an animal (its position on a reader row)
    if (st.log.length > n0) {
      birds = R.list();
      for (let i = n0; i < st.log.length; i++) {
        const r = st.log[i];
        const a = birds.find(b => Math.hypot(b.x - r[2], b.z - r[4]) < 12 * (b.size || 1));
        tags[i] = a ? a.key + (a.id === 'ambient' ? ' (ambient)' : ' ' + a.id) : '';
      }
    }
    if (f % 15 === 0) {
      const ls = R.list(), near = {};
      for (const b of ls) { const d = Math.hypot(b.x - q[0], b.y - (g + q[2]), b.z - q[1]); if (!near[b.key] || d < near[b.key]) near[b.key] = Math.round(d); }
      const states = ls.filter(b => b.kind === 'sea' && b.id === 'a4').map(b => (b.depth < 1.6 ? 'U' : 'd'));   // the pod: up / down
      let nv = 0; for (let k = 0; k < M.NV; k++) nv += st.vOn[k];
      const lp = []; for (let k = 0; k < M.NL; k++) if (st.lOn[k]) lp.push([M.SOUNDS[st.lS[k]][0], +st.lG[k].toFixed(3)]);
      rows.push({ t: +t.toFixed(2), x: +q[0].toFixed(1), z: +q[1].toFixed(1), agl: q[2], voices: nv, loops: lp, nearest: near, sea: states.join('') });
    }
  }
  const [Lc, Rc] = ER.mixdown(H, H.clock.t);
  // the scene starts at the first frame's end: drop that frame's samples (the sources were connecting)
  const skip = Math.round(DT * SR), Lx = Lc.subarray(skip), Rx = Rc.subarray(skip);
  const log = st.log.map((r, i) => ({ t: +(r[0] - st.log[0][0] + (st.log[0][0] - DT)).toFixed(2), sound: r[1], from: tags[i] || '', x: r[2], y: r[3], z: r[4], d: r[5] }));
  return { key, name, hours, dur, seed, pre, Lx, Rx, rows, log, sun: +W.day.sunEl.toFixed(1),
           loader: { fetches: H.rec.fetches, decodes: H.rec.decodes, peakMB: +(H.win.AUDIO_SAMPLES.classBytes('emit') / 1048576).toFixed(2), proc: E.procBytes() } };
}

function writeAudio(name, L, R, wav) {
  let pk = 0, ss = 0; for (let i = 0; i < L.length; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); ss += L[i] * L[i] + R[i] * R[i]; }
  const k = pk > 0.89 ? 0.89 / pk : 1;
  const raw = Buffer.alloc(L.length * 8); for (let i = 0; i < L.length; i++) { raw.writeFloatLE(L[i] * k, 8 * i); raw.writeFloatLE(R[i] * k, 8 * i + 4); }
  const f32 = path.join(OUT, name + '.f32');
  fs.writeFileSync(f32, raw);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', f32, '-c:a', 'libopus', '-b:a', '32k', '-application', 'audio', path.join(OUT, name + '.opus')]);
  if (wav) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', f32, path.join(OUT, name + '.wav')]);
  fs.unlinkSync(f32);
  return { peak: +pk.toFixed(3), normalised: k !== 1, rmsDb: +(10 * Math.log10(ss / (2 * L.length) + 1e-20)).toFixed(1) };
}

// ---- THE CHART: a row a scene, a lane a sound; a tick a call (taller: nearer), a bar a loop; the sea animals up / down ---
const LANES = ['orcablow', 'whaleblow', 'elk', 'bear', 'doe', 'gull', 'thrush', 'crow', 'eagle', 'owl', 'loon', 'mill'];
function timeline(res) {
  const { canvas, C } = AR;
  const left = 110, plotW = 1100, laneH = 15, top = 60, blockH = LANES.length * laneH + 64;
  const Wd = left + plotW + 30, Hh = top + res.length * blockH + 20;
  const cv = canvas(Wd, Hh, C.surface);
  cv.text(left, 16, 'JOLENE - THE ANIMALS, HEARD: WHO CALLED, WHEN (FIVE SCENES, THE EMITTERS ALONE)', C.ink, 2);
  cv.text(left, 40, 'A TICK A CALL (TALLER: NEARER, 0..400 M), A BAR A LOOP (ITS GAIN); IN SCENE 1, A LINE PER ORCA OF THE POD WHILE IT IS UP', C.ink2, 1);
  res.forEach((r, b) => {
    const y0 = top + b * blockH, X = t => left + plotW * t / r.dur;
    cv.text(left, y0 + 2, (b + 1) + '  ' + r.name.toUpperCase().replace(/'/g, '') + '  (SUN ' + r.sun + ' DEG)', C.ink, 1);
    LANES.forEach((nm, k) => {
      const ya = y0 + 20 + k * laneH, yb = ya + laneH - 3;
      cv.rect(left, yb, left + plotW, yb + 1, C.grid);
      cv.text(left - 8 - cv.tw(nm), ya + 3, nm, C.ink2, 1);
      for (const c of r.log) if (c.sound === nm || c.sound === nm + ':on') { const h = Math.max(2, (laneH - 4) * Math.max(0.15, 1 - c.d / 400)); cv.rect(X(c.t) - 1, yb - h, X(c.t) + 2, yb, C.series); }
      for (let i = 1; i < r.rows.length; i++) { const lp = r.rows[i].loops.find(q => q[0] === nm); if (lp && lp[1] > 0.005) cv.rect(X(r.rows[i - 1].t), yb - (laneH - 4) * Math.min(1, lp[1]), X(r.rows[i].t) + 1, yb, C.series2, 0.8); }
    });
    if (r.key === 'orca') {
      const ya = y0 + 20 + LANES.length * laneH + 4;
      cv.text(left - 8 - cv.tw('pod up'), ya + 3, 'pod up', C.ink2, 1);
      for (let i = 1; i < r.rows.length; i++) { const s = r.rows[i].sea; for (let k = 0; k < s.length; k++) if (s[k] === 'U') cv.rect(X(r.rows[i - 1].t), ya + 3 * k, X(r.rows[i].t) + 1, ya + 3 * k + 2, C.ink); }
    }
    for (let t = 0; t <= r.dur; t += 10) { cv.rect(X(t), y0 + blockH - 22, X(t) + 1, y0 + blockH - 18, C.ink2); if (t % 30 === 0) cv.text(X(t) - 6, y0 + blockH - 16, t, C.ink2, 1); }
  });
  return require('./render.js').pngBytes(cv.w, cv.h, cv.px);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const t0 = Date.now();
  const W = AR.loadJolene(), spots = spotsOf(W);
  const L = await AW.load();
  const scan = scanPod(L, W, spots);
  console.log('the pod: a pass starting at ' + scan.t0 + ' s of its cycle sees ' + scan.n + ' surfacings near the centre');
  const res = [];
  for (const sc of scenes(W, spots)) {
    if (only.length && !only.includes(sc[0])) continue;
    const r = await runScene(L, W, spots, sc, { pre: sc[0] === 'orca' ? scan.t0 : 60 });
    r.audio = writeAudio(r.key, r.Lx, r.Rx, process.argv.includes('--wav'));
    const c = {}; for (const x of r.log) { const k = x.sound + (x.from ? ' <- ' + x.from : ''); c[k] = (c[k] || 0) + 1; }
    console.log('  ' + r.key.padEnd(6) + r.dur + ' s, sun ' + r.sun + ': ' + JSON.stringify(c) + ' peak ' + r.audio.peak);
    res.push(r);
  }
  fs.writeFileSync(path.join(OUT, 'timeline.png'), timeline(res));
  const sum = {
    world: 'jolene (media/world/jolene + tools/fixtures/island_jolene.json), the real world module; the animals: the record\'s hotspots run by src/viewer/animal_run.js on three + the shipped payload',
    note: 'the emitters alone (no engine, no beds); each call through the scheduled gain, absorption, inverse distance and equal-power pan in the camera\'s frame, and its playbackRate',
    tier: 'gamer', podScan: scan, ranSeconds: +((Date.now() - t0) / 1000).toFixed(1),
    scenes: res.map(r => ({ key: r.key, name: r.name, localHours: r.hours, sunDeg: r.sun, seconds: r.dur, seed: 2000 + r.seed, animalsRunBefore: r.pre,
                            audio: r.audio, loader: r.loader, calls: r.log, track: r.rows.filter((x, i) => i % 4 === 0) })),
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(sum, null, 1));
  console.log('wrote ' + OUT + ' in ' + sum.ranSeconds + ' s');
}
module.exports = { spotsOf, scenes, scanPod, runScene };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
