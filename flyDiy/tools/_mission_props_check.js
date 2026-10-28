#!/usr/bin/env node
// _mission_props_check.js - GATE MISSIONPROPS (MISSIONS-PROPS, 2026-10-27): the mission props (tools/_mission_gen.js,
// MISSION_GEN) - the air-race pylon, the balloon column, the ring, the marker flag / photo target, the tie-down spot, the
// site in its three states (the weather station built).
//
//   1 BUILD      every preset builds headless at lod 0 and lod 1: finite, not empty, lod 1 lighter, lod 0 within its
//                budget (3 000 tris: a prop the page may draw a dozen of)
//   2 DIMS       the generator's strike dimensions are the core's (73c MISSION_PROP_DIMS: what a hit is judged by)
//   3 SHAPES     what was built is what is judged: the pylon h tall, r0 at its foot; the balloon column up to its top; the
//                ring's tube never inside its hole (the pass radius) and never past hole + 2 tubes
//   4 TORN       the hit variants differ: the pylon folded down (under half its height), balls burst, the ring sagging
//   5 MATERIALS  no new material: the towers' finish and the house's cloths only (no THREE material made in the file)
//   6 MARKERS    every marker kind 73c missionMarkers emits maps to a preset that builds (forMarker)
//   7 LIGHTS     a lit prop publishes its lamps (the night pool's `beacon`s)
// Run: node tools/_mission_props_check.js        (one final `GATE MISSIONPROPS: ...`)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TOOLS = __dirname;

function makeTHREE() {
  function Col(c) { this.hex = c; }
  Col.prototype.setHex = function (h) { this.hex = h; };
  Col.prototype.multiplyScalar = function () { return this; };
  function Mat(o) { Object.assign(this, { isMat: 1 }, o || {}); this.color = new Col((o && o.color) || 0); }
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = i; } computeVertexNormals() {} }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class Vec2 { constructor(x, y) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
  class Texture { constructor(img) { this.image = img; this.repeat = new Vec2(1, 1); } }
  return { BufferAttribute, BufferGeometry, Mesh, Texture, Vector2: Vec2, Color: Col, MeshLambertMaterial: Mat, MeshStandardMaterial: Mat,
           MeshBasicMaterial: Mat, DoubleSide: 2, FrontSide: 0, RepeatWrapping: 1000, SRGBColorSpace: 'srgb', LinearSRGBColorSpace: 'srgb-linear' };
}

const fails = [], notes = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const win = {};
const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_tower_gen.js', '_mission_gen.js'])
  vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
const MG = win.MISSION_GEN;
if (!MG) { console.log('GATE MISSIONPROPS: FAIL - MISSION_GEN did not load'); process.exit(1); }
// the core's table, read from the module itself (73c is pure: its constants evaluate alone)
const cctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'core', '73c_mission_run.js'), 'utf8') + '\n;globalThis.__D = MISSION_PROP_DIMS; globalThis.__G = MISSION_GATE_PROP;', cctx);
const CORE_DIMS = cctx.__D, CORE_GATE_PROP = cctx.__G;

const J = o => JSON.stringify(o);
const P_ = name => Object.assign({}, MG.DEF, MG.PRESETS[name]);
const built = {};
// 1 BUILD
for (const name of Object.keys(MG.PRESETS)) {
  const R0 = MG.build(P_(name), 0), R1 = MG.build(P_(name), 1);
  built[name] = R0;
  let bad = null;
  for (const k of MG.BAGS) { const d = R0.bags[k].data(); for (const v of d.pos) if (!Number.isFinite(v)) { bad = k; break; } }
  ok(!bad, '1 ' + name + ': non-finite geometry in ' + bad);
  ok(R0.stats.tris > 0, '1 ' + name + ': empty');
  ok(R1.stats.tris <= R0.stats.tris, '1 ' + name + ': lod 1 (' + R1.stats.tris + ') heavier than lod 0 (' + R0.stats.tris + ')');
  ok(R0.stats.tris <= 3000, '1 ' + name + ': ' + R0.stats.tris + ' tris at lod 0 (budget 3 000)');
  notes.push(name + ' ' + R0.stats.tris + '/' + R1.stats.tris);
}
// 2 DIMS
ok(J(MG.DIMS_OWN) === J(CORE_DIMS), '2 the generator\'s strike dimensions ' + J(MG.DIMS_OWN) + ' are not the core\'s ' + J(CORE_DIMS));
ok(CORE_GATE_PROP === 'pylons', '2 a gate with no prop is drawn and judged as the air-race pylon (' + CORE_GATE_PROP + ')');
// 3 SHAPES
{
  const S = built['air-race pylon'].stats, D = CORE_DIMS.pylons;
  ok(J(S.strike) === J({ kind: 'cone', h: D.h, r0: D.r0, r1: D.r1 }), '3 the pylon publishes its strike cone ' + J(S.strike));
  ok(Math.abs(S.top - D.h) < 1.0, '3 the pylon stands ' + S.top.toFixed(2) + ' m (judged ' + D.h + ')');
  const B = built['air-race pylon'].bags, A = MG.SCHEMES[0];
  let rFoot = 0;
  for (const k of A) { const p = B[k].data().pos; for (let i = 0; i < p.length; i += 3) if (p[i + 1] > 0.41 && p[i + 1] < 2.5) rFoot = Math.max(rFoot, Math.hypot(p[i], p[i + 2])); }
  ok(rFoot >= D.r0 * 0.97 && rFoot <= D.r0 * 1.08, '3 the pylon\'s fabric at its foot is ' + rFoot.toFixed(2) + ' m across the axis (judged ' + D.r0 + ')');
  const Sb = built['balloon column'].stats;
  ok(J(Sb.strike) === J({ kind: 'column', h: CORE_DIMS.balloons.h, r: CORE_DIMS.balloons.r }) && Sb.top >= CORE_DIMS.balloons.h, '3 the balloon column publishes its strike column, its top over it (' + J(Sb.strike) + ', top ' + Sb.top.toFixed(1) + ')');
  const R = built['ring'], Sr = R.stats, hole = MG.DEF.rgR, tube = CORE_DIMS.donut.tube;
  ok(J(Sr.strike) === J({ kind: 'torus', r: hole, tube }), '3 the ring publishes its strike torus ' + J(Sr.strike));
  let rmin = Infinity, rmax = 0;
  for (const k of MG.SCHEMES[0]) { const p = R.bags[k].data().pos; for (let i = 0; i < p.length; i += 3) { const r = Math.hypot(p[i], p[i + 1]); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); } }
  ok(rmin >= hole - 0.05 && rmax <= hole + 2 * tube + 0.05, '3 the ring\'s fabric stays between its hole (' + hole + ') and hole + 2 tubes: ' + rmin.toFixed(2) + '..' + rmax.toFixed(2));
}
// 4 TORN
{
  ok(built['air-race pylon, hit'].stats.bbox.y1 < CORE_DIMS.pylons.h * 0.5, '4 the hit pylon is folded down: ' + built['air-race pylon, hit'].stats.bbox.y1.toFixed(1) + ' m');
  ok(built['balloon column, hit'].stats.burst > 0 && built['balloon column, hit'].stats.balls < built['balloon column'].stats.balls, '4 the hit column has burst balls');
  ok(built['ring, hit'].stats.bbox.y0 < built['ring'].stats.bbox.y0 - 0.5, '4 the hit ring sags (' + built['ring, hit'].stats.bbox.y0.toFixed(2) + ' vs ' + built['ring'].stats.bbox.y0.toFixed(2) + ')');
}
// 5 MATERIALS
{
  const src = fs.readFileSync(path.join(TOOLS, '_mission_gen.js'), 'utf8');
  ok(!/new\s+THREE\./.test(src), '5 the generator makes a THREE object of its own (a new material?)');
  const F = MG.makeFinish(), TW = win.TOWER_GEN, HF = win.HOUSE_GEN;
  ok(MG.BAGS.every(k => F.MAT[k]), '5 every bag has a material in the finish');
  ok(['awning', 'flag', 'star'].every(k => F.MAT[k] === F.HF.MAT[k]), '5 the cloths are the house finish\'s own (awning, flag, star)');
  ok(TW.BAGS.every(k => MG.BAGS.includes(k)) && MG.BAGS.length === TW.BAGS.length + 3, '5 the bags are the towers\' plus the three cloths');
  MG.applyFinish({}, F);
}
// 6 MARKERS
{
  const kinds = [{ kind: 'gate', prop: 'pylons' }, { kind: 'gate', prop: 'balloons', alt: { max: 90 } }, { kind: 'ring', r: 10 }, { kind: 'pt', do: 'photo' }, { kind: 'pt', do: 'fly' }, { kind: 'spot' }, { kind: 'site' }];
  for (const m of kinds) {
    const P = MG.forMarker(m, { torn: m.kind === 'gate', agl: 40, state: 'building' });
    let R = null; try { R = P && MG.build(P, 1); } catch (e) { R = null; }
    ok(R && R.stats.tris > 0, '6 the ' + J(m) + ' marker has a prop that builds (' + J(P) + ')');
  }
  ok(MG.forMarker({ kind: 'gate', prop: 'balloons', alt: { max: 90 } }).blH === 90, '6 a balloon post stands to its gate\'s band top');
}
// 7 LIGHTS
{
  const L = name => built[name].stats.lit.lights.length;
  ok(L('weather station (built)') >= 1 && L('air-race pylon') === 0, '7 the weather station lights its mast; the day pylon carries none');
  for (const name of ['air-race pylon', 'balloon column', 'ring', 'marker flag']) {
    const R = MG.build(Object.assign(P_(name), { lights: 1 }), 0);
    ok(R.stats.lit.lights.length >= 1, '7 ' + name + ' with its night lights publishes them');
  }
}

for (const f of fails.slice(0, 40)) console.log('  FAIL ' + f);
console.log('MISSIONPROPS: ' + checks + ' checks · ' + notes.join(' · '));
console.log('GATE MISSIONPROPS: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
process.exit(fails.length ? 1 : 0);
