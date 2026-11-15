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
//      T4 the refused step is exercised (the cliff and the pond refuse steps), and no animal stands in the pond
//   H  THE HEAD. The head's frame (its three axes, in the animal's own frame, through every rotation and scale of
//      its chain) from one frame to the next:
//      H1 over the same run, never more than LIMIT degrees in a 30 fps frame (150 deg/s)
//      H2 EVERY TRANSITION THE MACHINE MAKES (idle<->browse, idle/browse->toWalk->walk, walk->idle/browse,
//         idle->toLie->lie->fromLie->idle/browse/walk), from three points in the outgoing clip: never over LIMIT
//      H3 a fade cut short by another (graze, then stand, then set off, 0.15 s apart): never over LIMIT
//      H4 the fade is EASED: its first frame moves the head less than a fifth of what a linear ramp's would
//      H5 a head that comes up from the grass takes at least 0.6 s (the SPAN rule)
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
  for (const f of ['matlib.js', 'props.js', 'plume.js', 'animals.js', 'animal_run.js'])
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
                                                pivotF: 0, pivotBad: 0, pivotBadEx: null, pivotMove: 0, wet: 0, frames: 0 });
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
      }
      const T = s.F; s.F = s.G; s.G = T;
      s.have = true; s.hd = l.hd; s.x = l.x; s.z = l.z; s.role = roleOf(l.clip); s.pivot = l.pivot; s.state = l.state;
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
  if (M) {
    try { await directed(g); } catch (e) { check(false, 'H3-H5 threw', e && (e.stack || e.message)); }
    // C: the control - the same transitions with the rules off must break the limit
    const keep = Object.assign({}, M);
    M.ease = false; M.span = false; M.pace = false;
    try {
      const C = await transitions(g);
      say('C the control (motion rules off): the head\'s worst frame ' + f2(C.worst) + ' deg (' + C.worstEx + ')');
      check(C.worst > LIMIT, 'C the control: with the motion rules off the transitions stay under the limit - the check cannot see the fault', f2(C.worst));
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
