#!/usr/bin/env node
// GATE BLUEPRINT — the blueprint import (G573, src/viewer/blueprint.js).
//
//   node tools/_blueprint_check.js            -> "GATE BLUEPRINT: PASS|FAIL"
//   node tools/_blueprint_check.js --selftest -> negative verification
//
// A blueprint is only worth what its registration is: a side view a few
// centimetres off the top view makes every comparison against the build
// confidently wrong. So every check is a number, off the SAME pure functions
// the desk and the shed run (blueprint.js's node half):
//
//   FRAMES     sheet <-> oriented round-trips at any rotation and mirror; the
//              oriented canvas bounds the rotated crop (W and H swap at 90).
//   SCALE      two points and a length are metres a pixel, in every unit.
//   LEVEL      two clicks along a line drawn at an angle give the rotation
//              that lays it horizontal (or vertical), the short way round.
//   THE INK    the paper is the mode colour; the auto extent is the ink's box
//              and ignores a speck; clearing the paper leaves the lines.
//   LAYOUT     on tools/_blueprint_fixture.json — the state the desk itself
//              produced on a synthetic Cub three-view of known dimensions,
//              driven through its pointer handlers: the scale, the length and
//              span, the 12 degree ground attitude, BOTH tyres on the floor,
//              the top view's nose under the side view's, the front view on
//              the centreline with its wheels on the mains, the plan flat.
'use strict';
const fs = require('fs');
const path = require('path');
const B = require(path.join(__dirname, '..', 'src', 'viewer', 'blueprint.js'));
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '_blueprint_fixture.json'), 'utf8')).state;

const fail = [];
const check = (ok, msg) => { if (!ok) fail.push(msg); return !!ok; };
const near = (a, b, t) => Math.abs(a - b) <= t;
const clone = o => JSON.parse(JSON.stringify(o));

// ---- FRAMES -----------------------------------------------------------------
function checkFrames() {
  let worst = 0;
  for (const rot of [0, 17.5, 45, 90, -133, 180]) for (const fh of [false, true]) for (const fv of [false, true]) {
    const v = { pts: [[100, 50], [700, 50], [700, 350], [100, 350]], rot, flipH: fh, flipV: fv };
    for (const p of [[100, 50], [420, 222], [699, 349]]) {
      const q = B.bpFromOriented(v, B.bpToOriented(v, p));
      worst = Math.max(worst, Math.hypot(q[0] - p[0], q[1] - p[1]));
    }
  }
  check(worst < 1e-9, `sheet -> oriented -> sheet drifts ${worst} px`);
  const d = B.bpDims({ pts: [[0, 0], [600, 0], [600, 300], [0, 300]], rot: 90 });
  check(near(d.W, 300, 1e-9) && near(d.H, 600, 1e-9), `a 90 deg turn does not swap W and H (${d.W} x ${d.H})`);
  // a point at the crop's top-left, turned 90 clockwise, lands top-right
  const q = B.bpToOriented({ pts: [[0, 0], [600, 0], [600, 300], [0, 300]], rot: 90 }, [0, 0]);
  check(near(q[0], 300, 1e-9) && near(q[1], 0, 1e-9), `rotation is not clockwise on screen (${q})`);
  return worst;
}

// ---- SCALE and LEVEL ------------------------------------------------------------
function checkScale() {
  check(near(B.bpMpp({ a: [0, 0], b: [300, 400], len: 5, unit: 'm' }), 0.01, 1e-12), 'mpp, metres');
  check(near(B.bpMpp({ a: [0, 0], b: [1000, 0], len: 10, unit: 'ft' }), 0.003048, 1e-12), 'mpp, feet');
  check(B.bpMpp({ a: [0, 0], b: [0, 0], len: 5 }) === null, 'a zero-length scale bar is not a scale');
  check(B.bpMpp({ a: [0, 0], b: [9, 0], len: 0 }) === null, 'no length is not a scale');
  check(near(B.bpLevelRot([0, 0], [100, 100], 'h'), -45, 1e-9), 'level a 45 deg line (down-right)');
  check(near(B.bpLevelRot([0, 0], [100, -100], 'h'), 45, 1e-9), 'level a 45 deg line (up-right)');
  check(near(B.bpLevelRot([0, 0], [-100, 17.6327], 'h'), 10, 1e-3), 'level the short way round (170 -> +10)');
  check(near(B.bpLevelRot([0, 0], [10, 100], 'v'), 5.7106, 1e-3), 'plumb a near-vertical line');
  // and the rotation LEVEL gives really lays the segment flat
  const v = { pts: [[0, 0], [800, 0], [800, 800], [0, 800]], rot: 0 };
  v.rot = B.bpLevelRot([100, 700], [700, 100], 'h');
  const a = B.bpToOriented(v, [100, 700]), b = B.bpToOriented(v, [700, 100]);
  check(near(a[1], b[1], 1e-9), `a LEVELled segment is not horizontal (${a[1]} vs ${b[1]})`);
}

// ---- THE INK --------------------------------------------------------------------
function img(w, h, paper) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = paper[0]; d[i + 1] = paper[1]; d[i + 2] = paper[2]; d[i + 3] = 255; }
  return d;
}
function ink(d, w, x0, y0, x1, y1, c) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
}
function checkInk() {
  const w = 400, h = 300, paper = [236, 232, 220];
  const d = img(w, h, paper);
  ink(d, w, 50, 80, 330, 84, [20, 30, 50]);       // a wing line
  ink(d, w, 150, 60, 154, 250, [20, 30, 50]);     // a strut
  ink(d, w, 390, 5, 391, 6, [0, 0, 0]);           // a speck of dust
  const p = B.bpPaper(d);
  check(Math.hypot(p[0] - paper[0], p[1] - paper[1], p[2] - paper[2]) < 1, `paper colour ${p}`);
  const box = B.bpInkBox(d, w, h, p);
  check(box && box.join() === '50,60,330,250', `ink box ${box} (expected 50,60,330,250 — the speck ignored)`);
  // a blue blueprint: white lines on blue paper, the same box
  const d2 = img(w, h, [30, 70, 150]);
  ink(d2, w, 50, 80, 330, 84, [240, 240, 255]);
  ink(d2, w, 150, 60, 154, 250, [240, 240, 255]);
  const box2 = B.bpInkBox(d2, w, h, B.bpPaper(d2));
  check(box2 && box2.join() === '50,60,330,250', `ink box on blue paper ${box2}`);
  B.bpClear(d, p, 0.12, 'cyan');
  const at = (x, y) => (y * w + x) * 4;
  check(d[at(10, 10) + 3] === 0, 'cleared paper is still opaque');
  check(d[at(200, 81) + 3] === 255 && d[at(200, 81) + 2] === 255, 'a cleared line lost its ink (or its re-inking)');
}

// ---- LAYOUT ---------------------------------------------------------------------
const TRUE = { mpp: 0.008, len: 6.95, span: 10.73, pitch: 12, tyres: 5.3, stroke: 3 * 0.008 };
function layoutFacts(st) {
  const L = B.bpLayout(st);
  const by = k => L.views.filter(v => v.kind === k)[0];
  return { L, side: by('side'), top: by('top'), front: by('front') };
}
function checkLayout(st) {
  const n0 = fail.length;
  const { L, side, top, front } = layoutFacts(st);
  check(L.ok, 'the fixture does not lay out');
  if (!L.ok) return fail.length - n0;
  check(near(L.mpp, TRUE.mpp, 1e-6), `scale ${L.mpp} m/px, drawn at ${TRUE.mpp}`);
  // the drawn outline plus its own stroke: a trimmed extent includes the ink
  check(near(L.len, TRUE.len, TRUE.stroke + 0.01), `length ${L.len.toFixed(3)} m, drawn ${TRUE.len}`);
  check(near(L.span, TRUE.span, TRUE.stroke + 0.01), `span ${L.span.toFixed(3)} m, drawn ${TRUE.span}`);
  check(near(L.groundPitch, TRUE.pitch, 0.05), `ground attitude ${L.groundPitch.toFixed(3)} deg, drawn ${TRUE.pitch}`);
  if (!check(L.gA && near(Math.abs(L.gB[0] - L.gA[0]), TRUE.tyres, 0.01), 'the tyres are not 5.3 m apart'))
    return fail.length - n0;
  // BOTH tyres on the floor, at the parked attitude
  const yA = B.pitchedY(L.gA[0], L.gA[1], L.pitch), yB = B.pitchedY(L.gB[0], L.gB[1], L.pitch);
  check(near(yA, L.floorRef, 1e-9) && near(yB, L.floorRef, 1e-9),
    `a tyre is off the floor at the parked attitude (${yA.toFixed(4)} / ${yB.toFixed(4)} vs ${L.floorRef.toFixed(4)})`);
  const ext = id => st.views.filter(v => v.id === id)[0].ext;
  // the side view: its extent's left edge is the nose, its bottom y = 0
  const se = ext(side.id);
  check(near(side.c[0] - side.W / 2 * L.mpp, -se[0] * L.mpp, 1e-9), 'the side view is not registered on its nose');
  check(near(side.c[2], 0, 1e-12), 'the side view is off the centreline');
  // the plan: flat on the floor, its nose under the pitched nose, centred
  const te = ext(top.id), xs = Math.cos(L.pitch * Math.PI / 180);
  check(top.flat, 'the top view is pitched with the body — it should lie flat');
  check(near(top.c[1], L.floorRef + B.GAPS.FLOOR_LIFT, 1e-9), 'the top view is not on the floor');
  const topNose = top.c[0] - (top.W / 2 - te[0]) * L.mpp * xs;
  check(near(topNose, L.nose[0], 1e-9), `the top view's nose is ${(topNose - L.nose[0]).toFixed(4)} m off the side view's`);
  // ...and both noses are the DRAWN nose: every view's extent, taken back to
  // the sheet, starts where the drawing does (x = 150 px, less half a stroke)
  for (const [k, v] of [['side', side], ['top', top]]) {
    const sv = st.views.filter(w => w.id === v.id)[0], e = ext(v.id);
    const nx = B.bpFromOriented(sv, [e[0], (e[1] + e[3]) / 2])[0];
    check(near(nx, 150, 2.5), `the ${k} view's extent starts at sheet x ${nx.toFixed(1)}, the nose is drawn at 150`);
  }
  check(near(top.c[2] - (top.H / 2 - (te[1] + te[3]) / 2) * L.mpp, 0, 1e-9), 'the top view is not centred on the span');
  // the front view: centred, wheels on the mains, ahead of the nose
  const fe = ext(front.id);
  check(near(front.c[2] - (front.W / 2 - (fe[0] + fe[2]) / 2) * L.mpp, 0, 1e-9), 'the front view is off the centreline');
  const wheels = front.c[1] - (fe[3] - front.H / 2) * L.mpp;
  check(near(wheels, Math.min(L.gA[1], L.gB[1]), 1e-9), 'the front view\'s wheels are not on the mains');
  check(near(front.c[0], -B.GAPS.FRONT_GAP, 1e-12), 'the front view is not ahead of the nose');
  // the front view was drawn at 45 degrees and LEVELled at the desk
  const fv = st.views.filter(v => v.id === front.id)[0];
  check(near(fv.rot, 45, 1e-6), `the LEVELled front view stands at ${fv.rot} deg`);
  // DATUM LEVEL: no pitch, and the lower tyre (the mains) on the floor
  const lv = clone(st); lv.rig.attitude = 'level';
  const L2 = B.bpLayout(lv);
  check(near(L2.pitch, 0, 1e-12) && near(L2.floorRef, Math.min(L2.gA[1], L2.gB[1]), 1e-12),
    'datum level does not stand the mains on the floor');
  // the user's hand: a move is a move, and a turn keeps the axes unit
  const mv = clone(st); mv.views[0].dx = 0.25; mv.views[0].spin = 30;
  const s2 = B.bpLayout(mv).views[0];
  check(near(s2.c[0], side.c[0] - 0.25, 1e-12), 'fore / aft does not move the view forward');
  check(near(Math.hypot(...s2.u), 1, 1e-12) && near(s2.u[0] * s2.v[0] + s2.u[1] * s2.v[1] + s2.u[2] * s2.v[2], 0, 1e-12),
    'a turned view lost its square axes');
  return fail.length - n0;
}

// ---- ONE ROOT, as GATE REF reads it --------------------------------------------
function checkOneRoot() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'blueprint.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const n of ['GARAGE_SPEC', 'setParam', 'cageToSpec', 'BUILD_SYNC', 'applySpec', 'CAGE_UI_SCENE', 'CAGE_JOIN'])
    check(src.indexOf(n) < 0, `blueprint.js reaches ${n} — the blueprint is DISPLAY ONLY`);
}

const worst = checkFrames();
checkScale();
checkInk();
checkLayout(FIX);
checkOneRoot();

if (process.argv.includes('--selftest')) {
  console.log('  --selftest: breaking each rule in turn');
  // a throw is a catch too: the layout refusing a broken state IS the check
  const broken = (fn) => {
    const before = fail.length, st = clone(FIX);
    try { fn(st); return checkLayout(st) > 0; } catch (e) { return true; } finally { fail.length = before; }
  };
  const cases = [
    ['the scale bar a tenth long', () => broken(st => { st.scale.len = 5.5; })],
    ['no ground line (a taildragger stood level)', () => broken(st => { st.views[0].ground = null; })],
    ['the tail tyre clicked a little high', () => broken(st => { st.views[0].ground.b[1] -= 6; })],
    ['the top view\'s extent off the nose', () => broken(st => { st.views[1].ext[0] += 12; })],
    ['the front view\'s extent off the centreline', () => {
      // the registration follows the extent by construction, so the only way
      // to break it is to lay out one state and read the other
      const a = B.bpLayout(FIX), st = clone(FIX); st.views[2].ext[0] += 20;
      const f = st.views[2], lf = a.views[2];
      return !near(lf.c[2] - (lf.W / 2 - (f.ext[0] + f.ext[2]) / 2) * a.mpp, 0, 1e-9); }],
    ['the front view left at its drawn 45 degrees', () => broken(st => { st.views[2].rot = 0; })],
    ['a mirrored frame round-trip', () => {
      const v = { pts: [[0, 0], [100, 0], [100, 50], [0, 50]], rot: 30, flipH: true };
      const o = B.bpToOriented(v, [10, 10]);
      const q = B.bpFromOriented(Object.assign({}, v, { flipH: false }), o);
      return Math.hypot(q[0] - 10, q[1] - 10) > 1; }],
  ];
  let bad = 0;
  for (const [name, run] of cases) {
    let ok = false;
    try { ok = !!run(); } catch (e) { ok = false; }
    console.log(`  selftest ${ok ? 'caught  ' : 'MISSED  '}${name}`);
    if (!ok) bad++;
  }
  check(bad === 0, `${bad} rule(s) cannot be broken — those checks are inert`);
}

const { L } = layoutFacts(FIX);
console.log(`  frames: worst round-trip ${worst.toExponential(1)} px · fixture: ` +
  `${(L.mpp * 1000).toFixed(2)} mm/px · length ${L.len.toFixed(3)} m · span ${L.span.toFixed(3)} m · ` +
  `ground ${L.groundPitch.toFixed(2)} deg nose-up · ${L.views.length} views`);
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE BLUEPRINT: FAIL');
  process.exit(1);
}
console.log('GATE BLUEPRINT: PASS');
