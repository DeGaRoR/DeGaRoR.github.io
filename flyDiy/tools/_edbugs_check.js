#!/usr/bin/env node
// _edbugs_check.js — GATE EDBUGS (G2780-G2789, EDITOR-BUGS: the user's slider
// review of 10 Oct 2026, the bugs half). One row per bug, generic (every
// aeroplane, not the one it was seen on), each red on the tree before the fix:
//
//   1 G2781  "glass center section does not work anymore (wrong material)":
//            the wing's glass carry-through wears the CABIN'S glazing (the
//            fuselage's own resolver), never a hand-rolled Standard the shed's
//            understudy flattens and the flight rebuilds as covering
//   2 G2782  "inside dimmer -> flood ... froze my interface": a dimmer notch
//            never changes the shed's light count (rows in GATE LIGHT 5f)
//   3 G2783  "sill shoulder whole cabin does not work with the mosquito": on a
//            mirrored pod the whole-cabin run reaches past the arceau
//   4 G2784  "the tundra balloon are wrong ... more like a donut": the tundra
//            carcass is a torus section — widest at mid-height, low flank, a
//            round crown; the other two carcasses as they were
//   5 G2785  "The tail cone cannot be selected": every body build that draws
//            a tail cone has a 'tail' zone (the click's answer), the mirrored
//            pod included
//   6 G2786  the comment strip the source-scan gates share is a lexer (the
//            'image/*' string opened a comment and SKINMAT / WEATHER went red
//            on intact code): its self-test, and _cage_ui.js stripped whole
//
// node tools/_edbugs_check.js   ->   "GATE EDBUGS: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = __dirname;
const { stripComments, stripLost } = require('./_src_strip.js');

const fail = [];
let rows = 0;
const check = (ok, label, extra) => { rows++; if (!ok) fail.push(label + (extra ? ' — ' + extra : '')); return ok; };
const rd = f => fs.readFileSync(path.join(T, f), 'utf8');

// ---- 6. THE STRIP (first: every source row below reads through it) ---------
{
  const cases = [
    ["a = 'image/*'; b = 1; /* c */ d = 2;", "a = 'image/*'; b = 1;   d = 2;"],
    ['x = "http://a"; // y', 'x = "http://a"; '],
    ['r = /[/*]/; k = 3; // t */', 'r = /[/*]/; k = 3; '],
    ['t = `a ${ {b: 1}.b } /* not */ c`; // gone', 't = `a ${ {b: 1}.b } /* not */ c`; '],
    ['q = a / b / c; /* x\n y */ w', 'q = a / b / c; \n w'],
  ];
  const bad = cases.filter(([a, b]) => stripComments(a) !== b);
  check(!bad.length, 'G2786: the strip is not a lexer', bad.map(c => JSON.stringify(c[0])).join(' '));
  const raw = rd('_cage_ui.js'), s = stripComments(raw);
  const lost = stripLost(raw, s, ['const WEAR_KEYS = ', 'function decReframe(', 'for (const k of WEAR_KEYS) {', 'window.CAGE_UI = {']);
  check(!lost.length, 'G2786: stripping _cage_ui.js eats code', lost.join(', '));
  let parses = true;
  try { new vm.Script(s, { filename: '_cage_ui.js (stripped)' }); } catch (e) { parses = false; }
  check(parses, 'G2786: _cage_ui.js stripped no longer parses (a string or a regex read as a comment)');
  // the negative: the old one-liner on the same text loses the tail (this is the bug, kept measurable)
  const old = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  check(stripLost(raw, old, ['window.CAGE_UI = {']).length === 1 || raw.indexOf("'image/*'") < 0,
        'G2786 selftest: the old slash-star strip no longer loses _cage_ui.js\'s tail — the probe went stale');
}

// ---- 1. THE GLASS CENTRE -----------------------------------------------------
{
  const W = stripComments(rd('_cage_wing.js'));
  const blk = W.slice(W.indexOf('if (gs.canopy) {'), W.indexOf('if (gs.canopy) {') + 2600);
  check(blk.length > 100, 'G2781: the glass carry-through block (gs.canopy in _cage_wing.js) is not found');
  check(/window\.CAGE_MAT_OF\('windshield'\)/.test(blk),
        'G2781: the glass centre does not wear the cabin\'s glazing (CAGE_MAT_OF(\'windshield\'))');
  check(!/new THREE\.Mesh\(parts\.x\.geo, glassMat\(\)\)/.test(blk),
        'G2781: the glass centre is drawn with the hand-rolled glassMat() again — matte in the shed, covering in flight');
  check(/vol < 0/.test(blk) && /gi\.setX\(t \+ 2, b\)/.test(blk),
        'G2781: the FrontSide pane has no outward-winding guard (an inside-out loft would show its inside)');
  // the glazing it borrows is a real glass: aeroGlass marks itself for the understudy and the snapshot
  const SK = stripComments(fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'aeroskin.js'), 'utf8'));
  const ag = SK.slice(SK.indexOf('function aeroGlass(THREE, o)'));
  check(/m\.userData\.aeroFinish = 'glass'/.test(ag.slice(0, 8000)),
        'G2781: aeroGlass no longer stamps aeroFinish \'glass\' — the flown pane would rebuild as covering');
}

// ---- 2. THE DIMMER (GATE LIGHT 5f carries the rows; this one says they exist)
check(/G2782/.test(rd('_light_check.js')) && /made\.filter\(m => \/level\\\(P\/\.test\(m\)\)/.test(rd('_light_check.js')),
      'G2782: GATE LIGHT\'s dimmer rows (5f) are gone');

// ---- 4. THE TUNDRA CARCASS ---------------------------------------------------
{
  function Mat(o) { Object.assign(this, o || {}); }
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
  class BufferGeometry { constructor() { this.attributes = {}; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = i; } computeVertexNormals() {} }
  const win = {};
  const ctx = { window: win, console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite,
                THREE: { BufferAttribute, BufferGeometry, Mesh: function () {}, LineSegments: function () {},
                         LineBasicMaterial: Mat, MeshLambertMaterial: Mat, MeshBasicMaterial: Mat, DoubleSide: 2, FrontSide: 0 } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['_gear_kit.js', '_gear_gen.js']) vm.runInContext(rd(f), ctx, { filename: f });
  const GG = win.GEAR_GEN;
  if (check(!!(GG && GG.TYRE && GG.tyreTorus), 'G2784: GEAR_GEN.TYRE / tyreTorus not published')) {
    const TY = GG.TYRE;
    // the standard and the slim carcasses are what they were (byte-for-byte rows)
    check(JSON.stringify(TY[0]) === JSON.stringify({ hw: 0.40, bead: 0.42, bulge: 1.02, bulgeAt: 0.80, crown: 0.035 }) &&
          JSON.stringify(TY[2]) === JSON.stringify({ hw: 0.29, bead: 0.46, bulge: 1.00, bulgeAt: 0.84, crown: 0.02 }),
          'G2784: the standard / slim carcass rows moved (this fix is the tundra\'s alone)');
    const tu = TY[1];
    check(!!tu.torus, 'G2784: the tundra carcass is not a torus');
    const R = 1, hw = tu.hw, rb = tu.bead * 1.03, zb = hw * tu.beadW;
    const S = GG.tyreTorus(R, rb, zb, hw, []);
    const pts = S.pts;
    const rMax = Math.max(...pts.map(p => p[0]));
    check(Math.abs(rMax - R) < 1e-9, 'G2784: the torus crown is not at the tyre radius', rMax.toFixed(4));
    const e0 = pts[0], e1 = pts[pts.length - 1];
    check(Math.abs(e0[0] - rb) < 1e-6 && Math.abs(e1[0] - rb) < 1e-6 && Math.abs(e0[1] + zb) < 1e-6 && Math.abs(e1[1] - zb) < 1e-6,
          'G2784: the torus does not end on the bead seats', JSON.stringify([e0, e1]));
    // widest at MID-HEIGHT (the user: "their flank goes too high")
    const wid = pts.reduce((a, p) => Math.abs(p[1]) > Math.abs(a[1]) ? p : a);
    const mid = (rb + R) / 2;
    check(Math.abs(wid[0] - mid) < 0.12 * (R - rb), 'G2784: the tundra is not widest at mid-height', 'widest at r ' + wid[0].toFixed(3) + ', mid ' + mid.toFixed(3));
    // a LOW flank and a round crown: at 0.945 R the section is under 0.6 of its width
    // (the old flank still held 0.81 of it there, then a flat band)
    const atR = r => { let best = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i];
      if ((a[0] - r) * (b[0] - r) <= 0 && a[1] >= 0 && b[1] >= 0) { const t = (r - a[0]) / ((b[0] - a[0]) || 1e-12); best = Math.max(best, a[1] + (b[1] - a[1]) * t); } } return best; };
    const w945 = atR(0.945 * R) / hw;
    check(w945 < 0.6, 'G2784: the tundra\'s flank still runs high (width at 0.945 R)', w945.toFixed(3) + ' of the half-width');
    // round, not a buoy: section height over width, the old carcass's 0.57
    const aspect = (R - rb) / (2 * hw);
    check(aspect > 0.62 && aspect < 1.2, 'G2784: the tundra section is not round (height / width)', aspect.toFixed(3));
    // the generator draws it: wheel() revolves the torus when the row asks
    check(/if \(prof\.torus\) \{[\s\S]{0,600}tyreTorus\(R, bead \* 1\.03, beadH, hw \* B, grooves\)/.test(stripComments(rd('_gear_gen.js'))),
          'G2784: wheel() does not revolve the torus for a torus carcass');
  }
}

// ---- 5. THE TAIL CONE'S ZONE, and 3. THE MOSQUITO'S SHOULDER ------------------
{
  const G = require('./_cage_gen.js');
  const mosq = JSON.parse(rd('fixtures/repro/mosquito.json'));
  const cases = [
    ['stock', {}],
    ['mirrored pod', { mirror: 1 }],
    ['pod + bubble', { mirror: 1, canopy: 3 }],
    ['the Mosquito', mosq.spec.cage],
  ];
  for (const [name, over] of cases) {
    const P = { ...G.CAGE_PARAMS, ...over };
    const S = G.cageSpec(P);
    const zs = G.cageBodyZones(S) || [];
    const keys = zs.map(z => z.key);
    check(keys.includes('tail'), 'G2785: ' + name + ': no tail zone — a click on the tail cone answers ' + (keys[keys.length - 1] || 'nothing'), keys.join(','));
    const last = zs[zs.length - 1];
    check(!!last && last.key === 'tail' && last.z0 === -Infinity, 'G2785: ' + name + ': the tail is not the aft-most zone', JSON.stringify(zs.map(z => [z.key, z.z0])));
    const boom = zs.find(z => z.key === 'boom');
    if (boom) check(isFinite(boom.z0) && isFinite(boom.z1) && boom.z0 < boom.z1, 'G2785: ' + name + ': the boom zone is not a finite stretch ahead of the cone', JSON.stringify([boom.z0, boom.z1]));
  }
}

// ---- 3. THE MIRRORED POD'S WHOLE-CABIN SHOULDER --------------------------------
// 'whole cabin' on a pod must build the aft cabin's sill too (aft of the arceau),
// each part closed; 'pilot bay' stays forward of it. The user's Mosquito, and the
// pod shapes the shoulder's own table carries.
{
  const G = require('./_cage_gen.js');
  const SG = require('./_shoulder_gen.js');
  const mosq = JSON.parse(rd('fixtures/repro/mosquito.json'));
  const cases = [
    ['the Mosquito', mosq.spec.cage],
    ['mirrored pod', { intOn: 1, cutParts: 1, mirror: 1 }],
    ['pod + bubble', { intOn: 1, cutParts: 1, mirror: 1, canopy: 3 }],
  ];
  for (const [name, over] of cases) {
    const got = {};
    for (const run of [0, 1]) {
      const built = G.cageSheet({ ...G.CAGE_PARAMS, ...over, shoulderOn: 1, shoulderRun: run }, { level: 2 });
      const sh = built.mesh.shoulder;
      const R = G.cageResolve(built.spec);
      const zArc = R.mirrorZ != null ? R.mirrorZ - (built.spec.cabinPillarW || 0) / 2 : null;
      const parts = (sh && sh.parts) || [];
      const res = sh ? SG.shoulderCheck(built.mesh) : [];
      got[run] = { aft: parts.filter(p => zArc != null && p.z1 < zArc + 1e-6), parts, bad: res.filter(r => !r.ok).length };
    }
    check(got[0].parts.length > 0 && !got[0].aft.length, 'G2783: ' + name + ': the pilot-bay shoulder is missing or runs aft of the arceau',
          got[0].parts.length + ' parts, ' + got[0].aft.length + ' aft');
    check(new Set(got[1].aft.map(p => p.side)).size === 2, 'G2783: ' + name + ': \'whole cabin\' builds no aft-cabin sill on both flanks',
          got[1].aft.length + ' aft parts of ' + got[1].parts.length);
    check(!got[1].bad, 'G2783: ' + name + ': a whole-cabin shoulder part is not a closed solid', got[1].bad + ' bad');
  }
}

console.log(`GATE EDBUGS: ${rows} rows, ${fail.length} red`);
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE EDBUGS: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
