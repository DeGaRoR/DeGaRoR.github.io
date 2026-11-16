#!/usr/bin/env node
// _animal_motion_check.js - GATE ANIMOTION (ANIMALS-MOTION, 15 Nov 2026). The user: "the animals don't behave correctly;
// no walking animation when they turn, harsh transition when they bend their heads."
//
// The land animals' clip machine (src/viewer/animal_run.js) and clip player (src/viewer/animals.js), run headless against
// the real vendor three and the shipped clip libraries (bear, elk, doe), at 30 fps:
//
//   T  THE TURN. A herd of each, 10 simulated minutes on a synthetic hill with a cliff and a pond in its hotspot:
//      T1 every step in which the heading moves has a GAIT clip in effect (walk / trot), at a rate > 0 - nothing turns
//         on a standing, grazing or lying pose
//      T2 a walking turn's radius (ground speed / yaw rate) is at least 0.45 x the body's length - the feet walk the
//         arc, they are not dragged round a pivot under the body (G498: the bear swung on 0.84 m with a 2.2 m body)
//      T3 a turn ON THE SPOT (a refused step) steps the walk clip at the rate the turn needs: rate = yaw rate x half the
//         length / the clip's ground speed (or its 0.25 floor), and the animal does not travel while it does
//      T5 it moves over the ground only while a clip that travels is in effect (or fading out under it)
//      T4 the refused step is exercised (the cliff and the pond refuse steps), and no animal stands in the pond
//   H  THE HEAD. The head's frame (its three axes, in the animal's own frame, through every rotation and scale of
//      its chain) from one frame to the next:
//      H1 over the same run, never more than LIMIT degrees in a 30 fps frame (150 deg/s)
//      B  THE BODY: through every one of those transitions, a fade adds at most 4 deg a frame (120 deg/s) to what the
//         two clips do to each limb, spine and neck bone themselves
//      H2 EVERY TRANSITION THE MACHINE MAKES (idle<->browse, idle/browse->toWalk->walk, walk->idle/browse,
//         idle->toLie->lie->fromLie->idle/browse/walk), from three points in the outgoing clip: never over LIMIT
//      H3 a fade cut short by another (graze, then stand, then set off, 0.15 s apart): never over LIMIT
//      H4 the fade is EASED: its first frame moves the head less than a fifth of what a linear ramp's would
//      H5 a head that comes up from the grass takes at least 0.6 s (the SPAN rule)
//   L  THE WHOLE ANIMAL, FAR OUT: the moving skin is drawn until the animal is 6 px long at 1080p, the baked static
//      cuts (untouched) only past that, and a walk / swim just inside poses the skin every frame
//   S  THE SWIMMERS: a pod for 6 min - upright (no roll or pitch past 49 deg), the members surface with the leader,
//      breaths in series of 2-5 between deep dives, no wake while the whole pod is under, a wake when it surfaces,
//      no turn tighter than 1.8 lengths; and the wake layer alone: under / over the surface nothing, crossing a trail
//   C  THE CONTROL: the same H2 with the motion rules off (animals.js MOTION: ease, span, pace) must break LIMIT -
//      the check can see the fault it is there for
//   $  THE COST: R.tick's wall time per frame for the herds (median / p99, printed, never gated: a wall clock under
//      the box's load is not a verdict - RIG-PROCEDURE / workbench-gates)
//
// Usage: node tools/_animal_motion_check.js [--root <a flyDiy tree>] [--report] [--minutes 10]
//   --root  run another tree's animals.js / animal_run.js / manifests (a `git archive` of master in a scratchpad: the
//           BEFORE numbers); the media is always this tree's. With --root the verdict is printed but means "that tree".
//   --report  the numbers only, every check still evaluated
// Prints GATE ANIMOTION: PASS|FAIL.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ROOT = path.resolve(arg('--root') || path.join(TOOLS, '..'));
const MINUTES = +(arg('--minutes') || 10);
const { readGeo } = require(path.join(TOOLS, '_media_lib.js'));
const CORE = require(path.join(TOOLS, 'flight_core.js'));
const THREE = require(path.join(TOOLS, '..', 'vendor', 'three.min.js'));

const LIMIT = 5.0;                      // degrees in one 30 fps frame: 150 deg/s (G498 measured 16.5)
const DT = 1 / 30;
const fail = [];
const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra !== undefined ? ' - ' + extra : '')); return ok; };
const out = [];
const say = s => out.push('  ' + s);

function viewerContext() {
  const g = {};
  for (const k of Object.keys(CORE)) g[k] = CORE[k];
  g.THREE = THREE; g.console = console;
  g.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
  g.Image = function () { return { addEventListener() {}, set src(v) {}, complete: false }; };
  g.FLYDIY_ASSET_BASE = '';
  const ctx = vm.createContext(g);
  vm.runInContext('var window = globalThis; window.window = window;', ctx);
  g.ASSET_FETCH = rel => Promise.resolve(readGeo(rel));
  for (const f of ['matlib.js', 'props.js', 'plume.js', 'wakes.js', 'animals.js', 'animal_run.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8'), ctx, { filename: f });
  const SRC = path.join(ROOT, 'src', 'animals');
  for (const f of JSON.parse(fs.readFileSync(path.join(SRC, 'animals_index.json'), 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  for (const f of JSON.parse(fs.readFileSync(path.join(SRC, 'animals_packs.json'), 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  return g;
}

// ---- the head's frame, measured the way the eye sees it: the head bone's world matrix in the animal object's frame
const _Mi = new THREE.Matrix4(), _Mr = new THREE.Matrix4();
function headOf(obj) { let h = null; obj.traverse(q => { if (!h && q.isBone && /head/i.test(q.name)) h = q; }); return h; }
function headFrame(obj, head, outArr) {
  obj.updateMatrixWorld(true);
  _Mi.copy(obj.matrixWorld).invert();
  _Mr.multiplyMatrices(_Mi, head.matrixWorld);
  const e = _Mr.elements;
  for (let c = 0; c < 3; c++) {
    const n = Math.hypot(e[4 * c], e[4 * c + 1], e[4 * c + 2]) || 1;
    for (let r = 0; r < 3; r++) outArr[3 * c + r] = e[4 * c + r] / n;
  }
  return outArr;
}
function swingDeg(A, B) {
  let m = 0;
  for (let c = 0; c < 3; c++) {
    const d = A[3 * c] * B[3 * c] + A[3 * c + 1] * B[3 * c + 1] + A[3 * c + 2] * B[3 * c + 2];
    m = Math.max(m, Math.acos(Math.max(-1, Math.min(1, d))));
  }
  return m * 180 / Math.PI;
}
// THE BODY: every limb, spine and neck bone (not the face: jaw, tongue, eyelids, ears) - each one's frame in the object's
const BODY_SKIP = /jaw|tongue|eyelid|ear\d|ear_|eye/i;
function bodyBones(obj) { const out = []; obj.traverse(q => { if (q.isBone && !BODY_SKIP.test(q.name) && !/^_?root/i.test(q.name)) out.push(q); }); return out; }
function bodyFrames(obj, bones, outArr) {
  obj.updateMatrixWorld(true);
  _Mi.copy(obj.matrixWorld).invert();
  for (let b = 0; b < bones.length; b++) {
    _Mr.multiplyMatrices(_Mi, bones[b].matrixWorld);
    const e = _Mr.elements;
    for (let c = 0; c < 3; c++) { const n = Math.hypot(e[4 * c], e[4 * c + 1], e[4 * c + 2]) || 1; for (let r = 0; r < 3; r++) outArr[9 * b + 3 * c + r] = e[4 * c + r] / n; }
  }
  return outArr;
}
function bodySwings(A, B, nb, out) {
  for (let b = 0; b < nb; b++) {
    let m = 0;
    for (let c = 0; c < 3; c++) { const o = 9 * b + 3 * c, d = A[o] * B[o] + A[o + 1] * B[o + 1] + A[o + 2] * B[o + 2]; m = Math.max(m, Math.acos(Math.max(-1, Math.min(1, d)))); }
    out[b] = m * 180 / Math.PI;
  }
  return out;
}
const roleOf = key => (key ? String(key).split(':')[0] : null);
const GAITS = { walk: 1, trot: 1 };
const pct = (arr, p) => { if (!arr.length) return NaN; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : '-');

// a hill with a cliff (x > CLIFF a wall 9 m up) and a pond (a bowl under the water at y = 0) inside the hotspots
const CLIFF = 34;
function GROUND(x, z) {
  const lx = ((x % 400) + 400) % 400 - 200;      // the same terrain round every hotspot (they sit 400 m apart)
  let h = 30 + 6 * Math.sin(x / 70) + 4 * Math.cos(z / 90);
  if (lx > CLIFF) h += Math.min(9, (lx - CLIFF) * 3);              // a wall of a slope: refused at 28 deg
  const pd = Math.hypot(lx + 22, z - 10);
  if (pd < 12) h -= (h + 1) * (1 - pd / 12) * 1.6;                 // the pond: the ground under y = 0 at its middle
  return h;
}
const WATER = () => 0;

// ---- T + H1: the herds --------------------------------------------------------------------------------------------
async function herds(g) {
  const AN = g.ANIMALS, AR = g.ANIMAL_RUN;
  const keys = AN.list('land').map(a => a.key);
  check(keys.length >= 3, 'the land animals are there', keys.join(','));
  await Promise.all(keys.map(k => AN.warm(k)));
  const scene = new THREE.Group();
  const R = AR.make(THREE, { scene, ground: GROUND, waterH: WATER, eye: () => ({ x: 0, y: 100, z: 0 }) });
  const spots = keys.map((k, i) => ({ id: 'm' + i, key: k, x: 200 + i * 400, z: 0, n: 5, r: 40 }));
  // (the eye's cull: every hotspot within REACH of the origin)
  R.sync(spots);
  const objs = R.root.children.slice();
  const heads = objs.map(headOf);
  const N = Math.round(MINUTES * 60 / DT);
  const S = objs.map(() => ({ F: new Float64Array(9), G: new Float64Array(9), have: false, hd: 0, x: 0, z: 0, role: null, wd: 0, wh: 0, wn: 0 }));
  const res = {};
  const ticks = [];
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    R.tick(DT);
    ticks.push(Number(process.hrtime.bigint() - t0) / 1e6);
    const L = R.list();
    for (let j = 0; j < objs.length; j++) {
      const l = L[j], s = S[j], a = AN.reg(l.key);
      const r = res[l.key] || (res[l.key] = { swing: [], turnStand: 0, turnStandEx: null, radius: [], tight: 0, tightEx: null,
                                                pivotF: 0, pivotBad: 0, pivotBadEx: null, pivotMove: 0, wet: 0, frames: 0, slide: 0, slideEx: null });
      headFrame(objs[j], heads[j], s.G);
      if (s.have) {
        r.frames++;
        const sw = swingDeg(s.F, s.G);
        r.swing.push(sw);
        if (sw > (r.maxSw || 0)) { r.maxSw = sw; r.maxEx = [i, l.state, s.role, '->', roleOf(l.clip), 'from', l.from || '-', 'u', f2(l.fadeU)].join(' '); }
        let dh = l.hd - s.hd; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        const w = Math.abs(dh) / DT, mv = Math.hypot(l.x - s.x, l.z - s.z) / DT;
        // the clip in effect DURING the step is the one the step started with (a walk that ends this step still walked it)
        const gaitNow = GAITS[s.role] || GAITS[roleOf(l.clip)];
        if (w > 1e-3) {
          if (!gaitNow || (l.rate !== undefined && !(l.rate > 0))) { r.turnStand++; if (!r.turnStandEx) r.turnStandEx = [i, l.state, s.role, '->', roleOf(l.clip), 'w', f2(w)].join(' '); }
        }
        // the PATH's radius over half a second of walking (a stride's speed is not uniform within it): the ground covered
        // over the heading turned, in a window of arc steps only (no turn on the spot, no other state)
        const arc = l.state === 'walk' && !l.pivot && !s.pivot && mv > 0.02;
        if (arc) { s.wd += mv * DT; s.wh += dh; s.wn++; } else { s.wd = 0; s.wh = 0; s.wn = 0; }
        if (s.wn >= 15) {
          if (Math.abs(s.wh) > 0.02 * 15 * DT) {
            const rad = s.wd / Math.abs(s.wh);
            r.radius.push(rad / a.length);
            if (rad < 0.45 * a.length * (l.size || 1)) { r.tight++; if (!r.tightEx) r.tightEx = [i, 'R', f2(rad), 'over', f2(s.wd), 'm'].join(' '); }
          }
          s.wd = 0; s.wh = 0; s.wn = 0;
        }
        if (l.pivot && s.pivot && l.state === 'walk' && s.state === 'walk') {
          r.pivotF++;
          if (mv > 1e-3) r.pivotMove++;
          const vc = (a.clips.find(c => c.key === l.clip) || {}).speed || 0.5;
          const want = Math.max(0.25, w * 0.5 * a.length * (l.size || 1) / vc);
          if (l.rate !== undefined && Math.abs(l.rate - want) > 0.15 * want + 0.02) { r.pivotBad++; if (!r.pivotBadEx) r.pivotBadEx = [i, 'rate', f2(l.rate), 'want', f2(want), 'w', f2(w)].join(' '); }
        }
        if (GROUND(l.x, l.z) <= WATER(l.x, l.z) + 0.2) r.wet++;
        // T5: it moves over the ground only on a clip that travels (its own, or the one fading out under it)
        if (mv > 0.05) {
          const sp = key => { const c = key && a.clips.find(c => c.key === key); return c ? (c.speed || 0) : 0; };
          if (!(sp(s.clip) > 0 || sp(l.clip) > 0 || sp(l.from) > 0 || sp(s.from) > 0)) { r.slide++; if (!r.slideEx) r.slideEx = [i, l.state, s.clip, '->', l.clip, 'v', f2(mv)].join(' '); }
        }
      }
      const T = s.F; s.F = s.G; s.G = T;
      s.have = true; s.hd = l.hd; s.x = l.x; s.z = l.z; s.role = roleOf(l.clip); s.pivot = l.pivot; s.state = l.state; s.clip = l.clip; s.from = l.from;
    }
  }
  for (const k of keys) {
    const r = res[k];
    say(k + ': head swing per frame p50 ' + f2(pct(r.swing, 0.5)) + ' p99 ' + f2(pct(r.swing, 0.99)) + ' max ' + f2(r.maxSw) +
        ' deg (limit ' + LIMIT + ') | turning off a gait ' + r.turnStand + ' of ' + r.frames + ' frames | walking turn radius / length p1 ' +
        f2(pct(r.radius, 0.01)) + ' p50 ' + f2(pct(r.radius, 0.5)) + ' | on the spot ' + r.pivotF + ' frames');
    check(r.turnStand === 0, 'T1 ' + k + ': the heading moved with no gait clip in effect', r.turnStand + ' frames, first ' + r.turnStandEx);
    check(r.tight === 0, 'T2 ' + k + ': a walking turn tighter than 0.45 x the body', r.tight + ' frames, first ' + r.tightEx);
    check(r.pivotBad === 0, 'T3 ' + k + ': a turn on the spot steps at the wrong rate', r.pivotBad + ' frames, first ' + r.pivotBadEx);
    check(r.pivotMove === 0, 'T3 ' + k + ': a turn on the spot travels', String(r.pivotMove));
    check(r.pivotF > 0, 'T4 ' + k + ': no step was ever refused (the cliff and the pond are there to refuse them)');
    check(r.wet === 0, 'T4 ' + k + ': an animal stands in the pond', String(r.wet));
    check(r.slide === 0, 'T5 ' + k + ': it moves over the ground with no travelling clip in effect (a statue sliding)', r.slide + ' frames, first ' + r.slideEx);
    check(r.maxSw <= LIMIT, 'H1 ' + k + ': the head swings more than ' + LIMIT + ' deg in a frame', f2(r.maxSw) + ' at ' + r.maxEx);
  }
  const n = R.stats.animals;
  say('$ R.tick for ' + n + ' land animals (all in reach, level 0 posed): median ' + pct(ticks, 0.5).toFixed(3) + ' ms, p99 ' +
      pct(ticks, 0.99).toFixed(3) + ' ms per frame (' + (pct(ticks, 0.5) / n * 1000).toFixed(1) + ' us an animal), node, wall clock');
  R.dispose();
}

// ---- H2-H5 + C: the transitions, one animal on the player alone ----------------------------------------------------
// the machine's own edges (animal_run.js landEnter / landStart): [from role, to role]
const EDGES = [['idle', 'browse'], ['browse', 'idle'], ['idle', 'toWalk'], ['browse', 'toWalk'], ['toWalk', 'walk'],
  ['walk', 'idle'], ['walk', 'browse'], ['idle', 'toLie'], ['toLie', 'lie'], ['lie', 'fromLie'],
  ['fromLie', 'idle'], ['fromLie', 'browse'], ['fromLie', 'walk']];
const LOOPS = { idle: 1, browse: 1, walk: 1, lie: 1, trot: 1 };
async function transitions(g, label) {
  const AN = g.ANIMALS;
  const keys = AN.list('land').map(a => a.key);
  await Promise.all(keys.map(k => AN.warm(k)));
  const F = new Float64Array(9), G = new Float64Array(9);
  let worst = 0, worstEx = '';
  for (const k of keys) {
    const a = AN.reg(k);
    const H = AN.place(THREE, k, {});
    const head = headOf(H.obj);
    for (const [r0, r1] of EDGES) {
      const A = a.clips.filter(c => c.role === r0), B = a.clips.filter(c => c.role === r1);
      for (const ca of A) for (const cb of B) for (const at of [0.2, 0.5, 0.85]) {
        H.player.play(ca, { loop: !!LOOPS[r0], restart: true });
        H.player.prev = null;
        // into the outgoing clip: transitions play to their end (the machine waits for them), loops are cut part-way
        const tA = LOOPS[r0] ? ca.dur * at : ca.dur + 0.05;
        for (let t = 0; t < tA * 3 + 2 && (LOOPS[r0] ? H.player.t < ca.dur * at : !H.player.done); t += DT) H.step(DT);
        headFrame(H.obj, head, F);
        H.player.play(cb, { fade: 0.25, loop: !!LOOPS[r1] });
        for (let i = 0; i < 75; i++) {
          H.step(DT);
          headFrame(H.obj, head, G);
          const sw = swingDeg(F, G);
          if (sw > worst) { worst = sw; worstEx = k + ' ' + ca.key + ' -> ' + cb.key + ' at ' + at + ', frame ' + i; }
          F.set(G);
        }
      }
    }
    H.dispose();
  }
  return { worst, worstEx };
}
// B: THE BODY THROUGH EVERY TRANSITION - a fade adds at most BODY_ADD (4 deg a frame: 120 deg/s, animals.js MOTION.bodyCap)
// to what the two clips themselves do to a bone (their own worst frame for it, played alone from the same points, x 1.1)
const BODY_ADD = 4.0;
async function bodyTransitions(g) {
  const AN = g.ANIMALS;
  const keys = AN.list('land').map(a => a.key);
  let worst = 0, worstEx = '', over = 0;
  for (const k of keys) {
    const a = AN.reg(k);
    const H = AN.place(THREE, k, {});
    const bones = bodyBones(H.obj), nb = bones.length;
    const F = new Float64Array(9 * nb), G = new Float64Array(9 * nb), sw = new Float64Array(nb);
    // a clip's own worst frame per bone, from `at`, over 75 frames (played alone, paced as the player paces it)
    const own = (c, loop, at) => {
      const m = new Float64Array(nb);
      H.player.play(c, { loop, restart: true, at }); H.player.prev = null;
      H.step(0); bodyFrames(H.obj, bones, F);
      for (let i = 0; i < 75; i++) { H.step(DT); bodyFrames(H.obj, bones, G); bodySwings(F, G, nb, sw); for (let b = 0; b < nb; b++) m[b] = Math.max(m[b], sw[b]); F.set(G); }
      return m;
    };
    for (const [r0, r1] of EDGES) {
      const A = a.clips.filter(c => c.role === r0), B = a.clips.filter(c => c.role === r1);
      for (const ca of A) for (const cb of B) for (const at of [0.2, 0.5, 0.85]) {
        const tA = LOOPS[r0] ? ca.dur * at : ca.dur;
        const ownA = own(ca, !!LOOPS[r0], Math.min(tA, ca.dur - 1e-3)), ownB = own(cb, !!LOOPS[r1], 0);
        H.player.play(ca, { loop: !!LOOPS[r0], restart: true }); H.player.prev = null;
        for (let t = 0; t < tA * 3 + 2 && (LOOPS[r0] ? H.player.t < ca.dur * at : !H.player.done); t += DT) H.step(DT);
        bodyFrames(H.obj, bones, F);
        H.player.play(cb, { fade: 0.25, loop: !!LOOPS[r1] });
        for (let i = 0; i < 75; i++) {
          H.step(DT); bodyFrames(H.obj, bones, G); bodySwings(F, G, nb, sw); F.set(G);
          for (let b = 0; b < nb; b++) {
            const lim = Math.max(ownA[b], ownB[b]) * 1.1 + BODY_ADD, x = sw[b] - lim;
            if (x > 0) over++;
            if (x > worst) { worst = x; worstEx = k + ' ' + ca.key + ' -> ' + cb.key + ' at ' + at + ', frame ' + i + ', ' + bones[b].name + ' ' + f2(sw[b]) + ' deg vs the clips own ' + f2(Math.max(ownA[b], ownB[b])); }
          }
        }
      }
    }
    H.dispose();
  }
  return { worst, worstEx, over };
}
// L: THE WHOLE ANIMAL, FAR OUT (the user, 15 Nov: "static mesh is barely acceptable ... when the animal is only a few
// pixels large ... their movement is realistic as soon as they can be observed"; "do not modify the meshed and skinned
// and rigged model"): the moving skin is drawn until the animal's length covers 6 px at 1080p (1 094 px a radian); the
// static cuts, the baked ones untouched, only past that
const PX6 = len => len * 1094 / 6;
async function levelsCheck(g) {
  const AN = g.ANIMALS, out = [];
  for (const a of AN.list().filter(a => AN.levels(a.key).length)) {
    const k = a.key, lv = AN.levels(k), want = PX6(a.length);
    await AN.warm(k);
    const H = AN.place(THREE, k, {});
    const role = a.kind === 'land' ? 'walk' : a.kind === 'sea' ? 'swim' : 'flap';
    H.play(role, { loop: true, restart: true });
    const d1 = H.obj.levels[1] ? H.obj.levels[1].distance : Infinity;
    check(d1 >= want - 1e-6, 'L ' + k + ': the static cut is drawn from ' + f2(d1) + ' m - the animal is still ' + f2(a.length * 1094 / d1) + ' px long there (want the moving skin to ' + f2(want) + ' m, 6 px)');
    // the static cuts are the baked props, untouched: no skinned mesh in them
    const statics = H.obj.levels.slice(1).every(l => { let sk = false; l.object.traverse(o => { if (o.isSkinnedMesh) sk = true; }); return !sk; });
    check(statics, 'L ' + k + ': a static cut was re-skinned (the user: do not modify the meshed, skinned, rigged model)');
    // just inside that distance, the LOD draws level 0 and a walk / swim poses the bones every frame
    const cam = new THREE.PerspectiveCamera(45, 1.6, 0.5, 20000);
    cam.position.set(Math.min(d1, want) * 0.95, 2, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    H.obj.updateMatrixWorld(true); H.obj.update(cam);
    check(H.obj.getCurrentLevel() === 0, 'L ' + k + ': at ' + f2(cam.position.x) + ' m the LOD does not draw the moving skin', String(H.obj.getCurrentLevel()));
    // a node the playing clip drives (its most moving one over the clip), read off the instance
    const cur = H.player.cur, nrs = cur ? cur.nr : [];
    let bone = H.inst.objs[nrs[Math.floor(nrs.length / 2)]] || H.inst.bones[2], best = -1;
    for (const nd of nrs) { const o = 3 * cur.nt.length + 4 * nrs.indexOf(nd), d = cur.data, st = cur.stride, h = Math.floor(cur.frames / 2);
      const dot = Math.abs(d[o] * d[h * st + o] + d[o + 1] * d[h * st + o + 1] + d[o + 2] * d[h * st + o + 2] + d[o + 3] * d[h * st + o + 3]);
      if (1 - dot > best) { best = 1 - dot; bone = H.inst.objs[nd]; } }
    let posed = 0, q0 = bone.quaternion.clone();
    for (let f = 0; f < 30; f++) { H.step(DT); if (bone.quaternion.angleTo(q0) > 1e-5) posed++; q0.copy(bone.quaternion); }
    check(posed >= 25, 'L ' + k + ': a ' + role + ' at ' + f2(cam.position.x) + ' m poses the skin in only ' + posed + ' of 30 frames');
    out.push(k + ' (' + f2(a.length) + ' m): moving skin to ' + f2(d1) + ' m (6 px), static cuts ' + lv.map((l, i) => f2(H.obj.levels[i + 1].distance)).join(' / ') + ' m (table ' + lv.map(l => l.dist).join(' / ') + '), ' + posed + '/30 frames posed at ' + f2(cam.position.x) + ' m');
    H.dispose();
  }
  for (const l of out) say('L ' + l);
  // the control: with the rule off the ladder is G498's (the static cut from 40 m), and the check above would see it
  const M = AN.MOTION, a0 = AN.list().find(a => AN.levels(a.key).length);
  if (M && a0) { M.far = false; const d = AN.farDist(a0, 0, AN.levels(a0.key)[0].dist); M.far = true;
    check(d < PX6(a0.length), 'L the control: with the rule off the static cut still starts at 6 px - the check cannot see the fault'); }
}
// S: THE SWIMMERS (SWIMMERS, 15 Nov 2026; the user: "they put themselves on their back, there is no interaction with
// the water, so no wake ... generate wakes when they are crossing the surface and not when they are further down")
async function swimmers(g) {
  const AN = g.ANIMALS, AR = g.ANIMAL_RUN;
  if (!g.WAKES) { check(false, 'S the wake layer (wakes.js) did not load'); return; }
  for (const a of AN.list('sea')) {
    const k = a.key, S = a.sea, orca = (S.cycle || 60) < 70, n = orca ? 4 : 2;
    await AN.warm(k);
    const R = AR.make(THREE, { scene: new THREE.Group(), ground: () => -200, waterH: () => 0 });
    R.sync([{ id: 'sw' + k, key: k, x: 0, z: 0, n, r: orca ? 300 : 600 }]);
    const W = R.wakes();
    if (!check(!!W, 'S ' + k + ': no wake layer made for a pod')) continue;
    const objs = R.root.children.filter(o => /^animal:/.test(o.name));
    const U = new THREE.Vector3();
    const flt = S.float, beam = S.beam;
    let maxPts = 0, minUp = 9, deepWake = 0, deepEx = '', tight = 0, tightEx = '', wakeMs = [];
    const ups = objs.map(() => []), was = objs.map(() => false), hdPrev = [], posPrev = [];
    const series = []; let cur = 0, deep = false;
    const N = 30 * 60 * 6;
    for (let i = 0; i < N; i++) {
      const np0 = W.stats.points;
      R.tick(DT);
      wakeMs.push(W.stats.ms); if (W.stats.points > maxPts) maxPts = W.stats.points;
      const L = R.list();
      // S4: a NEW trail point only while some body of the pod crosses the surface (its depth within its own height)
      const fresh = W.probe().filter(p => p.age < DT * 0.5);
      if (fresh.length && !L.some(o => o.depth < flt + beam * 1.2)) { deepWake += fresh.length; if (!deepEx) deepEx = 't ' + f2(i * DT) + ' s, depths ' + L.map(o => f2(o.depth)).join('/'); }
      objs.forEach((o, j) => {
        U.set(0, 1, 0).applyQuaternion(o.quaternion); minUp = Math.min(minUp, U.y);
        const up = L[j].depth < flt + beam * 0.2;
        if (up && !was[j]) ups[j].push(i * DT);
        was[j] = up;
        // S6: the path's radius over a second: ground covered over heading turned
        if (i % 30 === 0) {
          if (hdPrev[j] !== undefined) {
            let dh = L[j].hd - hdPrev[j]; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
            const ds = Math.hypot(L[j].x - posPrev[j][0], L[j].z - posPrev[j][1]);
            if (Math.abs(dh) > 0.01 && ds / Math.abs(dh) < 1.8 * a.length * (L[j].size || 1)) { tight++; if (!tightEx) tightEx = 'R ' + f2(ds / Math.abs(dh)) + ' m at ' + f2(i * DT) + ' s'; }
          }
          hdPrev[j] = L[j].hd; posPrev[j] = [L[j].x, L[j].z];
        }
      });
      // S3: the leader's breaths between two deep dives (a surfacing counted once, at its start)
      const d0 = L[0].depth;
      if (d0 > S.depth * 0.7) { if (!deep && cur) series.push(cur); deep = true; cur = 0; }
      else if (ups[0].length && ups[0][ups[0].length - 1] === i * DT) { deep = false; cur++; }
    }
    // S2: every leader surfacing is matched by every member within 6 s
    let missed = 0, missEx = '';
    for (const t of ups[0]) if (t < N * DT - 10) for (let j = 1; j < objs.length; j++)
      if (!ups[j].some(u => Math.abs(u - t) < 6)) { missed++; if (!missEx) missEx = 'member ' + j + ' at ' + f2(t) + ' s'; }
    const pts = maxPts;
    wakeMs.sort((x, y) => x - y);
    say('S ' + k + ' (pod of ' + n + ', 6 min): leader surfacings ' + ups[0].length + ', series ' + series.join(',') + ' | members missed ' + missed +
        ' | min up.y ' + f2(minUp) + ' | wake points (most at once) ' + pts + ', points off a deep pod ' + deepWake + ' | wakes.step median ' + (wakeMs[wakeMs.length >> 1] || 0).toFixed(3) + ' ms p99 ' + (wakeMs[Math.floor(wakeMs.length * 0.99)] || 0).toFixed(3) + ' ms');
    check(minUp > 0.65, 'S1 ' + k + ': the body rolls or pitches past 49 deg (up.y ' + f2(minUp) + ')');
    check(ups[0].length >= 3, 'S2 ' + k + ': the leader surfaced only ' + ups[0].length + ' times in 6 min');
    check(missed === 0, 'S2 ' + k + ': a member does not surface with its leader', missed + ', first ' + missEx);
    check(series.length > 0 && series.every(c => c >= 2 && c <= 5), 'S3 ' + k + ': breaths do not come in series of 2-5 between deep dives', series.join(','));
    check(deepWake === 0, 'S4 ' + k + ': a wake is dropped while the whole pod is under (a wake without a crossing)', deepWake + ', first ' + deepEx);
    check(pts > 0 || ups[0].length === 0, 'S5 ' + k + ': the pod surfaced and left no wake');
    check(tight === 0, 'S6 ' + k + ': a turn tighter than 1.8 body lengths', tight + ', first ' + tightEx);
    R.dispose();
  }
  // S7 THE SEABED: a whale pod over a 12 m shelf never dives into the bed; S8 THE WATER'S LIST: the bodies handed to the
  // water (ctx.submerged, else WATER.setSubmerged): at most 12 capsules, every body's trunk first, nearest first, then the
  // heads and tail stocks of the nearest while the budget lasts (16 Nov: a body seen through the sea whole, not its middle)
  {
    const a = AN.reg('whale') || AN.list('sea')[0], k = a.key, S = a.sea;
    const eye = { x: 0, y: 50, z: 0 };
    let lists = 0, bad = '', worst = 0, most = 0;
    const R = AR.make(THREE, { scene: new THREE.Group(), ground: () => -12, waterH: () => 0, eye: () => eye,
      submerged: L => { lists++; most = Math.max(most, L.length); if (L.length > 12) bad = bad || 'a list of ' + L.length;
        const nb = R.list().filter(o => o.depth > 0 && o.shown).length, nt = Math.min(nb, 12);
        if (L.length < nt) bad = bad || L.length + ' capsules for ' + nb + ' bodies under';
        for (let i = 1; i < nt; i++) if (L[i].d2 < L[i - 1].d2) bad = bad || 'the trunks not nearest first';
        for (const q of L) if (!(q.r > 0 && q.h >= 0 && Math.abs(Math.hypot(q.ax, q.ay, q.az) - 1) < 1e-3 && Number.isFinite(q.x + q.y + q.z))) bad = bad || 'a capsule malformed'; } });
    R.sync([{ id: 'shelf', key: k, x: 0, z: 0, n: 8, r: 400 }]);
    for (let i = 0; i < 30 * 240; i++) { R.tick(DT); for (const o of R.list()) worst = Math.max(worst, o.depth - (12 - S.beam * (o.size || 1) * 0.5)); }
    say('S7/S8 ' + k + ' x8 over a 12 m shelf, 4 min: the closest to the bed ' + f2(-worst) + ' m above (bed less half its own beam), ' + lists + ' lists to the water, ' + most + ' capsules at most');
    check(worst <= 1e-3, 'S7 ' + k + ': a swimmer dives into the seabed', f2(worst) + ' m past bed less half its beam');
    check(lists > 0 && !bad, 'S8 the bodies handed to the water', bad || 'none handed');
    check(most > 8, 'S8 the nearest bodies handed whole (head and tail stock beside the trunk)', most + ' capsules at most for 8 bodies');
    R.dispose();
  }
  // S12 THE GUARD (16 Nov, A0 on the slot-3 cost: +3.6 ms over open sea with every swimmer hidden): the water's capsule
  // loop gets nothing while the runner is hidden up its parents or every trunk is under 2 px from the eye
  {
    const a = AN.reg('orca') || AN.list('sea')[0], k = a.key;
    const eye = { x: 0, y: 30, z: 0 }, scene = new THREE.Group();
    let last = -1;
    const R = AR.make(THREE, { scene, ground: () => -40, waterH: () => 0, eye: () => eye, submerged: L => { last = L.length; } });
    R.sync([{ id: 'guard', key: k, x: 0, z: 0, n: 4, r: 60 }]);
    let near = 0;
    for (let i = 0; i < 60 * 60; i++) { R.tick(DT); near = Math.max(near, last); }
    scene.visible = false; let hid = 0;
    for (let i = 0; i < 60 * 20; i++) { R.tick(DT); hid = Math.max(hid, last); }
    scene.visible = true; eye.x = 6000; let far = 0;
    for (let i = 0; i < 60 * 20; i++) { R.tick(DT); far = Math.max(far, last); }
    say('S12 the guard: ' + near + ' capsules near, ' + hid + ' hidden, ' + far + ' at 6 km');
    check(near > 0, 'S12 a pod under the near eye is handed to the water', near + ' capsules');
    check(hid === 0, 'S12 a hidden runner hands the water nothing (uWSubN 0)', hid + ' capsules');
    check(far === 0, 'S12 a pod under 2 px hands the water nothing (uWSubN 0)', far + ' capsules');
    R.dispose();
  }
  // S9 THE CORE (the first GPU slot, 15 Nov: a capsule centred on the pivot at half the beam spilled past the skin and the
  // water opened onto the clear colour - a turquoise lozenge round every orca): each sea animal's trunk capsule
  // (ANIMALS.seaCore) exists, is thinner than half its beam, and both caps lie inside the model's own box (bb - pivot)
  for (const a of AN.list('sea')) {
    const H = AN.place(THREE, a.key, {}), C = H.core, bb = a.bb, pv = a.pivot || [0, 0, 0];
    let why = '';
    if (!C) why = 'none fitted';
    else {
      const ylo = bb[1] - pv[1], yhi = bb[4] - pv[1], zlo = bb[2] - pv[2], zhi = bb[5] - pv[2];
      if (!(C.r > 0.1 * a.sea.beam && C.r < 0.5 * a.sea.beam)) why = 'radius ' + f2(C.r) + ' vs beam ' + a.sea.beam;
      else if (!(C.cy - C.r > ylo && C.cy + C.r < yhi)) why = 'out of the box vertically';
      else if (!(C.cz - C.h - C.r > zlo && C.cz + C.h + C.r < zhi)) why = 'out of the box along the body';
    }
    say('S9 ' + a.key + ': the trunk capsule ' + (C ? 'centre y ' + f2(C.cy) + ' z ' + f2(C.cz) + ', r ' + f2(C.r) + ', half-length ' + f2(C.h) : '-') + ' m');
    check(!why, 'S9 ' + a.key + ': the trunk capsule', why);
    // S9 the head and the tail stock (16 Nov): two sections, each inside the box, thinner than the trunk, and on the bone
    // that carries its skin - its ends in that bone's frame land back on the section's own at rest
    let sw = '';
    const segs = C && C.seg || [];
    if (segs.length !== 2) sw = segs.length + ' sections fitted';
    H.obj.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(H.obj.matrixWorld).invert(), M = new THREE.Matrix4(), v = new THREE.Vector3();
    for (const sg of segs) {
      const ylo = bb[1] - pv[1], yhi = bb[4] - pv[1], zlo = bb[2] - pv[2], zhi = bb[5] - pv[2];
      for (const e of [sg.a, sg.b]) if (!(e[1] - sg.r > ylo && e[1] + sg.r < yhi && e[2] - sg.r > zlo && e[2] + sg.r < zhi)) sw = sw || 'a section out of the box';
      if (!(sg.r > 0 && sg.r <= C.r * 1.01)) sw = sw || 'a section r ' + f2(sg.r) + ' past the trunk ' + f2(C.r);
      if (sg.A) {
        const bone = H.inst.meshes[sg.mi].skeleton.bones[sg.bi];
        M.multiplyMatrices(inv, bone.matrixWorld);
        const d = v.fromArray(sg.A).applyMatrix4(M).distanceTo(new THREE.Vector3().fromArray(sg.a));
        if (d > 1e-3) sw = sw || 'the bone frame misses its section by ' + f2(d) + ' m';
      }
      say('S9 ' + a.key + ': a section z ' + f2(sg.a[2]) + '..' + f2(sg.b[2]) + ', r ' + f2(sg.r) + (sg.A ? ', on bone ' + H.inst.meshes[sg.mi].skeleton.bones[sg.bi].name : ', rigid'));
    }
    if (!segs.some(sg => sg.A && sg.a[2] < C.cz)) sw = sw || 'the tail stock on no bone';
    check(!sw, 'S9 ' + a.key + ': the head and the tail stock', sw);
  }
  // F1 FAR, NOT GONE (the user 15 Nov: "From the starting place of the cabin strip, all animals should show"): a land herd
  // 2 km off stays DRAWN - on the ground, frozen (not stepped), parked out of the matrix walk; the eye coming back steps it
  {
    const k = AN.reg('elk') ? 'elk' : AN.list('land')[0].key;
    const eye = { x: 0, y: 30, z: 0 }, GR = (x, z) => 20 + 0.01 * x;
    const R = AR.make(THREE, { scene: new THREE.Group(), ground: GR, waterH: () => -Infinity, eye: () => eye });
    R.sync([{ id: 'far', key: k, x: 2000, z: 0, n: 6, r: 40 }]);
    for (let i = 0; i < 60; i++) R.tick(DT);
    const L0 = R.list();
    for (let i = 0; i < 120; i++) R.tick(DT);
    const L1 = R.list();
    let why = '';
    if (R.stats.far !== L1.length) why = R.stats.far + ' of ' + L1.length + ' counted far';
    L1.forEach((o, i) => {
      if (!o.shown) why = why || 'one hidden';
      if (Math.hypot(o.x - L0[i].x, o.z - L0[i].z) > 1e-6) why = why || 'one moved while far';
      if (Math.abs(o.y - GR(o.x, o.z)) > 1e-3) why = why || 'one off the ground by ' + f2(o.y - GR(o.x, o.z));
    });
    eye.x = 1990;
    for (let i = 0; i < 300; i++) R.tick(DT);
    const L2 = R.list(), moved = L2.filter((o, i) => Math.hypot(o.x - L1[i].x, o.z - L1[i].z) > 1e-3 || o.clip).length;
    if (R.stats.far !== 0 || R.stats.shown !== L2.length) why = why || 'back in reach: ' + R.stats.shown + ' stepped, ' + R.stats.far + ' far';
    say('F1 ' + k + ' x' + L1.length + ' at 2 km: ' + (why || 'all shown, frozen on the ground') + '; back in reach ' + R.stats.shown + ' stepped, ' + moved + ' with a clip or moved');
    check(!why, 'F1 a land herd past its reach is drawn frozen on the ground', why);
    R.dispose();
  }
  // S4 directly: the layer itself - a hull 10 m down, one at the surface, one in the air
  const W = g.WAKES.make(THREE, { waterH: () => 0 });
  for (let i = 0; i < 60; i++) {
    W.hull('deep', { x: i * 0.1 * 3, z: 0, hd: 0, speed: 3, beam: 2, length: 8, top: -9, bottom: -11 });
    W.hull('air', { x: i * 0.1 * 3, z: 50, hd: 0, speed: 3, beam: 2, length: 8, top: 12, bottom: 10 });
    W.step(0.1);
  }
  check(W.stats.points === 0, 'S4 the layer: a hull under or over the surface leaves a wake', String(W.stats.points));
  for (let i = 0; i < 60; i++) { W.hull('surf', { x: 0, z: i * 0.3, hd: 0, speed: 3, beam: 2, length: 8, top: 0.8, bottom: -1.2 }); W.step(0.1); }
  check(W.stats.points > 5 && W.stats.verts > 0, 'S4 the layer: a hull crossing the surface leaves no wake', W.stats.points + ' points, ' + W.stats.verts + ' verts');
  W.ring(0, 0, 2, 1); W.step(0.1);
  check(W.stats.rings === 1, 'S4 the layer: a breach ring is not drawn');
  W.dispose();
  // S10 THE SLICKS (16 Nov): a breath leaves a glassy patch handed to the water, larger than its ring, gone after its life;
  // ten at once hand over the strongest SLICK_N
  {
    let last = [], most = 0;
    const W2 = g.WAKES.make(THREE, { waterH: () => 0, slicks: L => { last = L.map(q => ({ ...q })); most = Math.max(most, L.length); } });
    const K = g.WAKES.K;
    W2.ring(5, 5, 2, 1);
    for (let i = 0; i < 30; i++) W2.step(0.1);
    const s3 = last[0];
    check(last.length === 1 && s3.k > 0.3 && s3.r > 2, 'S10 a breath leaves a slick for the water', JSON.stringify(last));
    for (let i = 0; i < (K.SLICK_LIFE + 2) * 10; i++) W2.step(0.1);
    check(last.length === 0, 'S10 a slick outlives its life', last.length + ' left');
    for (let i = 0; i < 10; i++) W2.ring(i * 20, 0, 2, 0.5 + i * 0.05);
    for (let i = 0; i < 20; i++) W2.step(0.1);
    check(most === K.SLICK_N && last.every(q => q.k >= 0.5 * K.SLICK_K * Math.min(1, 1.9 / 1.5) * 0.5), 'S10 ten slicks: the strongest ' + K.SLICK_N + ' handed', most + ' at most');
    say('S10 the slick: ' + (s3 ? 'r ' + f2(s3.r) + ' m, k ' + f2(s3.k) + ' at 3 s' : '-') + '; ' + most + ' handed of 10');
    W2.dispose();
    // S12 the slicks' guard: none while the layer is hidden up its parents, none under 3 px from the eye
    const par = new THREE.Group(), se = { x: 0, y: 20, z: 0 };
    const W3 = g.WAKES.make(THREE, { parent: par, waterH: () => 0, eye: () => se, slicks: L => { last = L.length; } });
    W3.ring(0, 30, 2, 1);
    for (let i = 0; i < 20; i++) W3.step(0.1);
    const sNear = last;
    par.visible = false; for (let i = 0; i < 5; i++) W3.step(0.1);
    const sHid = last;
    par.visible = true; se.x = 5000; for (let i = 0; i < 5; i++) W3.step(0.1);
    const sFar = last;
    check(sNear === 1 && sHid === 0 && sFar === 0, 'S12 a slick handed only while shown and over 3 px', 'near ' + sNear + ', hidden ' + sHid + ', at 5 km ' + sFar);
    W3.dispose();
  }
  // S11 THE BLOW IS WATER (16 Nov; the user: "the water effects are quite rough" - the chimney's grey smoke as a blow): the
  // swimmers fire plume.js's mist - white, camera-facing droplet clouds lit by the key light - which builds, patches its
  // shader where it means to, rises to its height in a second, and is gone after its life; the chimney's own preset untouched
  {
    const PL = g.PLUME, K = PL && PL.PRESETS.mist;
    let why = '';
    if (!K || K.kind !== 'mist') why = 'no mist preset';
    else {
      const M = PL.make(THREE, Object.assign({}, K, { rise: 9 }));
      const sh = { uniforms: {}, vertexShader: 'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}', fragmentShader: 'void main() {\n#include <color_fragment>\n}' };
      M.mat.onBeforeCompile(sh);
      if (M.mat.name !== 'plume-mist') why = 'the mist built as ' + M.mat.name;
      else if (!/mvPosition\.xy \+= aQuad \* rad/.test(sh.vertexShader) || /#include <project_vertex>/.test(sh.vertexShader)) why = 'the billboard did not patch';
      else if (!sh.uniforms.uSun || !/vScat/.test(sh.fragmentShader)) why = 'no forward scatter';
      else if (M.mesh.geometry.index.count !== K.n * 6) why = M.mesh.geometry.index.count / 6 + ' quads for ' + K.n;
      M.fire(0, 0, 0, 6, 0); M.step(1);
      const bs = M.mesh.geometry.boundingSphere, far = 6 * (K.life + K.delay);   // (a 10 m/s wind: the cloud 30 m downwind)
      if (!why && !(Math.abs(bs.center.x - far / 2) < far * 0.1 && bs.radius >= far / 2)) why = 'the cull sphere does not follow the drift (' + f2(bs.center.x) + ', r ' + f2(bs.radius) + ')';
      const top = 9 * (1 - Math.exp(-1 / K.tau));
      if (!why && !(M.alive && M.mesh.visible && top > 0.9 * 9)) why = 'not up at 1 s (' + f2(top) + ' m)';
      M.step(K.life + K.delay);
      if (!why && (M.alive || M.mesh.visible)) why = 'alive after its life';
      M.dispose();
    }
    const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'animal_run.js'), 'utf8');
    if (!why && !/PRESETS\.mist/.test(src)) why = 'the swimmers still fire the smoke';
    const ch = PL && PL.PRESETS.chimney;
    if (!why && !(ch && ch.n === 9 && ch.rise === 3.2 && ch.spread === 1.15 && !ch.kind)) why = 'the chimney preset moved';
    say('S11 the blow: ' + (why || 'mist, ' + K.n + ' droplet clouds, up in ' + K.tau + ' s, gone after ' + (K.life + K.delay).toFixed(1) + ' s'));
    check(!why, 'S11 the blow is water (plume.js mist)', why);
  }
}

async function directed(g) {
  const AN = g.ANIMALS, M = AN.MOTION;
  const k = AN.reg('doe') ? 'doe' : AN.list('land')[0].key, a = AN.reg(k);
  const H = AN.place(THREE, k, {});
  const head = headOf(H.obj);
  const F = new Float64Array(9), G = new Float64Array(9), F0 = new Float64Array(9);
  const browse = a.clips.find(c => c.role === 'browse'), idle = a.clips.find(c => c.role === 'idle'), walk = a.clips.find(c => c.role === 'walk');
  // H3: graze, cut to a stand mid-dip, and 0.15 s later set off
  H.player.play(idle, { loop: true, restart: true }); H.player.prev = null;
  for (let i = 0; i < 30; i++) H.step(DT);
  H.player.play(browse, { fade: 0.25, loop: true });
  let worst = 0;
  headFrame(H.obj, head, F);
  for (let i = 0; i < 90; i++) {
    if (i === 20) H.player.play(idle, { fade: 0.25, loop: true });
    if (i === 25) H.player.play(walk, { fade: 0.25, loop: true });
    H.step(DT); headFrame(H.obj, head, G);
    worst = Math.max(worst, swingDeg(F, G)); F.set(G);
  }
  say('H3 a fade cut short twice (' + k + '): the head\'s worst frame ' + f2(worst) + ' deg');
  check(worst <= LIMIT, 'H3 a fade cut short jumps the head', f2(worst) + ' deg');
  // H4 + H5: down in the grass (the browse clip's dip done), then up to a stand
  H.player.play(idle, { loop: true, restart: true }); H.player.prev = null;
  for (let i = 0; i < 10; i++) H.step(DT);
  H.player.play(browse, { fade: 0.25, loop: true });
  for (let i = 0; i < 90; i++) H.step(DT);
  headFrame(H.obj, head, F0);
  H.player.play(idle, { fade: 0.25, loop: true });
  const fade = H.player.fade;
  // a linear ramp's first frame: the whole swing x DT / fade; the eased one's must be under a fifth of that
  const tmp = new Float64Array(9);
  headFrame(H.obj, head, F);
  H.step(DT); headFrame(H.obj, head, G);
  const first = swingDeg(F, G);
  // the whole swing, for the comparison: where the head ends up once the fade is done
  for (let i = 0; i < Math.ceil(fade / DT) + 2; i++) H.step(DT);
  headFrame(H.obj, head, tmp);
  const whole = swingDeg(F0, tmp);
  const linFirst = whole * DT / Math.max(1e-6, fade);
  say('H4/H5 head up from the grass (' + k + '): ' + f2(whole) + ' deg over ' + f2(fade) + ' s, first frame ' + f2(first) + ' deg (a ramp: ' + f2(linFirst) + ')');
  check(fade >= 0.6, 'H5 a head coming up from the grass fades in under 0.6 s', f2(fade) + ' s for ' + f2(whole) + ' deg');
  check(first < 0.2 * linFirst + 0.05, 'H4 the fade is not eased: its first frame moves the head like a ramp', f2(first) + ' vs ' + f2(linFirst));
  H.dispose();
  return M;
}

(async () => {
  const g = viewerContext();
  const M = g.ANIMALS && g.ANIMALS.MOTION;
  if (!check(!!g.ANIMALS && !!g.ANIMAL_RUN, 'the viewer layer loads')) return finish();
  try { await herds(g); } catch (e) { check(false, 'T/H1 the herds threw', e && (e.stack || e.message)); }
  try {
    const T2 = await transitions(g);
    say('H2 every transition the machine makes, from three points: the head\'s worst frame ' + f2(T2.worst) + ' deg (' + T2.worstEx + ')');
    check(T2.worst <= LIMIT, 'H2 a transition jumps the head more than ' + LIMIT + ' deg in a frame', f2(T2.worst) + ': ' + T2.worstEx);
  } catch (e) { check(false, 'H2 the transitions threw', e && (e.stack || e.message)); }
  try { await swimmers(g); } catch (e) { check(false, 'S the swimmers threw', e && (e.stack || e.message)); }
  try { await levelsCheck(g); } catch (e) { check(false, 'L the levels threw', e && (e.stack || e.message)); }
  try {
    const BT = await bodyTransitions(g);
    say('B the body through every transition: ' + BT.over + ' bone-frames faster than the clips themselves' + (BT.over ? ', worst by ' + f2(BT.worst) + ' deg (' + BT.worstEx + ')' : ''));
    check(BT.over === 0, 'B a transition moves a bone faster than both its clips do', f2(BT.worst) + ' deg over: ' + BT.worstEx);
  } catch (e) { check(false, 'B the body threw', e && (e.stack || e.message)); }
  if (M) {
    try { await directed(g); } catch (e) { check(false, 'H3-H5 threw', e && (e.stack || e.message)); }
    // C: the control - the same transitions with the rules off must break the limit
    const keep = Object.assign({}, M);
    M.ease = false; M.span = false; M.pace = false;
    try {
      const C = await transitions(g);
      say('C the control (motion rules off): the head\'s worst frame ' + f2(C.worst) + ' deg (' + C.worstEx + ')');
      check(C.worst > LIMIT, 'C the control: with the motion rules off the transitions stay under the limit - the check cannot see the fault', f2(C.worst));
      const CB = await bodyTransitions(g);
      say('C the body control (motion rules off): ' + CB.over + ' bone-frames over, worst by ' + f2(CB.worst) + ' deg (' + CB.worstEx + ')');
      check(CB.over > 0, 'C the body control: with the motion rules off no bone is over - the check cannot see the fault');
    } catch (e) { check(false, 'C the control threw', e && (e.stack || e.message)); }
    Object.assign(M, keep);
  } else check(false, 'H3-H5, C: animals.js has no MOTION rules (the G498 player)');
  finish();
})();
function finish() {
  if (arg('--root')) out.unshift('  (tree: ' + ROOT + ')');
  for (const l of out) console.log(l);
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE ANIMOTION: ' + (fail.length ? 'FAIL' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
}
