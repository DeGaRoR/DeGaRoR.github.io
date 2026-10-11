// _navaid_gen.js - THE RADIO NAVAIDS (ASSETS-OCT G2909, 2026-10-11, the user: "the real model, at the real
// spot" - the Annette Island VOR/DME, ANN 117.1, 55 03'37.471"N 131 34'42.238"W, 174 ft).
//
// A DOPPLER VOR (DVOR) with its DME, as the FAA builds them, one thing said in four parts:
//
//   THE COUNTERPOISE  a flat metal disc on steel columns - the ground plane the antennas radiate over,
//                     raised so the terrain under it does not bend the course. Esri imagery of the ANN site
//                     shows a 44-46 m disc (A0, z18 at 0.342 m/px: ~130 px), concentric rings and radial
//                     panel joints: the FAA's extended 150 ft (45.7 m) counterpoise. Height: a conventional
//                     DVOR counterpoise stands ~5 m (16 ft); the default is that (a dial).
//   THE ARRAY         the CARRIER radome at the centre, and the SIDEBAND ring: 50 Doppler antennas, each a
//                     small fibreglass "derby" dome on a stub, on a 44 ft (13.4 m) circle (FAA DVOR, 50
//                     antennas on a 22 ft radius - US DOT/FAA reports; dials)
//   THE DME           a slender fibreglass radome on a mast over the carrier, the site's highest point, with
//                     its RED OBSTRUCTION LIGHT (rule 29: the glass is the emitting geometry, glow palette 2 =
//                     red; published as a `beacon` light for the night lamp pool)
//   THE SITE          the equipment shelter west of the disc (a painted hut on its slab, its door lamp) and
//                     the access ladder up to the counterpoise
//
// Its MATERIALS are the control towers' (TOWER_GEN's finish: the house library's galvanised steel for the
// disc and the columns, the pale casing paint for the fibreglass, the cladding paint for the shelter) - no new
// material site, one finish shared. Same API as the other generators (DEF/ROWS/PRESETS/BAGS/MAT/build/
// applyFinish/makeFinish/catOf/CATALOGUE); headless for the gates. Loaded ON DEMAND (build.js MANIFEST.lazy):
// a record that names a navaid/ key asks for it (world_boot.js, the house worker, the editor).
(() => {
'use strict';
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const TW = window.TOWER_GEN;
const { clamp, Bag, face, uvFrame, boxAB, beam, cyl } = K;

const BAGS = TW.BAGS, EXTRA = TW.EXTRA;
const makeFinish = () => TW.makeFinish();
const MAT = TW.MAT;
const SETS = role => HG.ROLE_SETS[({ siding: 'wall', roof: 'roof', steel: 'steel', stone: 'stone', metal: 'metal' })[role] || role];
const SET_IDX = (role, key) => Math.max(0, SETS(role).indexOf(key));
const setNames = role => SETS(role).slice();
const FT = 0.3048;

const DEF = {
  seed: 7,
  // the counterpoise
  cpD: 150 * FT, cpH: 16 * FT, cpT: 0.12, cpSegs: 64, rings: 3, joints: 24,
  colRings: 4, colW: 0.22,
  // the array
  sbN: 50, sbD: 44 * FT, sbStub: 0.45, sbDomeR: 0.32, sbDomeH: 0.34, carrierR: 0.55, carrierH: 1.3,
  // the DME and its light
  dme: 1, dmeH: 3.2, dmeR: 0.16, lights: 1,
  // the site
  shelter: 1, shelterL: 4.2, shelterW: 3.0, shelterH: 2.7, shelterGap: 3.5, ladder: 1,
  // the finish (TOWER_GEN's dials)
  steelSet: SET_IDX('steel', 'steelgrey'), metalSet: SET_IDX('metal', 'galv'), roofSet: SET_IDX('roof', 'galv'),
  wallSet: SET_IDX('siding', 'boxprof'), wallCol: 6, stoneSet: SET_IDX('stone', 'concrete'), trimCol: 6,
  dirt: 0.3, dirtH: 0.8, noise: 0.14, clouds: 0.35, ao: 0.8, aoRange: 0.6, aoDirect: 0.35, aoGround: 1,
  slopeX: 0, slopeZ: 0,
};
const ROWS = [
  ['the counterpoise', [
    ['cpD', 'diameter (m)', 20, 50, 0.1], ['cpH', 'height above ground (m)', 2.5, 8, 0.05],
    ['rings', 'panel rings', 0, 5, 1], ['joints', 'radial joints', 0, 48, 2], ['colRings', 'column rings', 2, 6, 1],
  ]],
  ['the array', [
    ['sbN', 'sideband antennas', 24, 60, 1], ['sbD', 'sideband circle (m)', 8, 18, 0.05],
    ['carrierH', 'carrier radome height', 0.6, 2.4, 0.05],
  ]],
  ['the DME and the site', [
    ['dme', 'DME mast', 0, 1, 1], ['dmeH', 'DME mast height', 1.5, 6, 0.1, null, P => !!P.dme],
    ['lights', 'obstruction + door lights', 0, 1, 1],
    ['shelter', 'equipment shelter', 0, 1, 1], ['shelterGap', 'shelter off the disc (m)', 1, 12, 0.5, null, P => !!P.shelter],
    ['ladder', 'access ladder', 0, 1, 1],
    ['slopeZ', 'ground slope z', -8, 8, 0.5], ['slopeX', 'ground slope x', -6, 6, 0.5],
  ]],
  ['finish', [
    ['metalSet', 'counterpoise', 0, SETS('metal').length - 1, 1, setNames('metal')],
    ['steelSet', 'columns', 0, SETS('steel').length - 1, 1, setNames('steel')],
    ['wallSet', 'shelter cladding', 0, SETS('siding').length - 1, 1, setNames('siding')], ['wallCol', 'shelter paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['roofSet', 'shelter roof', 0, SETS('roof').length - 1, 1, setNames('roof')], ['stoneSet', 'footings', 0, SETS('stone').length - 1, 1, setNames('stone')],
    ['trimCol', 'radome paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['dirt', 'dirt', 0, 1, 0.05], ['clouds', 'weather clouds', 0, 1, 0.05], ['ao', 'baked occlusion', 0, 1, 0.05], ['aoGround', 'ground skirt', 0, 1, 1],
  ]],
];
const PRESETS = {
  'DVOR-DME': {},                                                  // the FAA's: Annette Island ANN 117.1
  'DVOR-DME compact': { cpD: 100 * FT, sbN: 48, shelterGap: 2.5 },   // the conventional 30 m counterpoise
};
const CATS = { 'DVOR-DME': 'landmark', 'DVOR-DME compact': 'landmark' };
const catOf = name => CATS[name] || null;

// a flat annulus strip on the counterpoise's top (a panel seam): n quads between radii r0, r1 at y
function annulus(bag, r0, r1, y, n) {
  for (let i = 0; i < n; i++) {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n;
    const p = (r, a) => [Math.cos(a) * r, y, Math.sin(a) * r];
    face(bag, [p(r1, a0), p(r1, a1), p(r0, a1), p(r0, a0)], [0, 1, 0], q => [q[0], q[2]]);
  }
}

function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const Q = { lod: lod | 0 };
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const LIT = HG.litBegin();
  const occ = [];
  const R = P.cpD / 2, Hc = P.cpH, T = P.cpT;
  const yTop = Hc, yBot = Hc - T;
  const N = Q.lod === 0 ? Math.round(P.cpSegs) : 32;

  // ==== THE COUNTERPOISE: the disc (top, underside, rim) ====
  const rim = []; for (let i = 0; i < N; i++) { const a = 2 * Math.PI * i / N; rim.push([Math.cos(a) * R, Math.sin(a) * R]); }
  for (let i = 0; i < N; i++) {
    const a = rim[i], b = rim[(i + 1) % N];
    face(bags.metal, [[0, yTop, 0], [b[0], yTop, b[1]], [a[0], yTop, a[1]]], [0, 1, 0], q => [q[0], q[2]]);
    face(bags.metal, [[0, yBot, 0], [a[0], yBot, a[1]], [b[0], yBot, b[1]]], [0, -1, 0], q => [q[0], q[2]]);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ml = Math.hypot(mid[0], mid[1]) || 1;
    face(bags.metal, [[a[0], yBot, a[1]], [b[0], yBot, b[1]], [b[0], yTop, b[1]], [a[0], yTop, a[1]]], [mid[0] / ml, 0, mid[1] / ml],
         q => [Math.atan2(q[2], q[0]) * R, q[1]]);
  }
  occ.push({ x: 0, z: 0, r: R, k: 0.22, soft: 0.8 });          // a raised disc: open under, a light shade
  // the panel seams the imagery shows: concentric rings and radial joints, in the column steel, 1 cm proud
  if (Q.lod === 0) {
    const rings = Math.round(P.rings);
    for (let k = 1; k <= rings; k++) { const r = R * k / (rings + 1); annulus(bags.steel, r - 0.06, r + 0.06, yTop + 0.01, Math.max(24, Math.round(N * r / R))); }
    annulus(bags.steel, R - 0.12, R, yTop + 0.01, N);
    const J = Math.round(P.joints);
    for (let k = 0; k < J; k++) {
      const a = 2 * Math.PI * (k + 0.5) / J, c = Math.cos(a), s = Math.sin(a), w = 0.05;
      const r0 = P.sbD / 2 + 0.6;
      face(bags.steel, [[c * r0 - s * w, yTop + 0.01, s * r0 + c * w], [c * R - s * w, yTop + 0.01, s * R + c * w],
                        [c * R + s * w, yTop + 0.01, s * R - c * w], [c * r0 + s * w, yTop + 0.01, s * r0 - c * w]], [0, 1, 0], q => [q[0], q[2]]);
    }
  }
  // the columns: rings of square steel columns, a concrete footing under each (lod 0), radial girders under the disc
  let cols = 0;
  const CR = Math.round(P.colRings);
  for (let k = 1; k <= CR; k++) {
    const r = (R - 0.6) * k / CR, n = Math.max(4, Math.round(6 * k * (CR >= 4 ? 1 : 1.5)));
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * (i + (k % 2) * 0.5) / n, x = Math.cos(a) * r, z = Math.sin(a) * r, y0 = g(x, z);
      beam(bags.steel, [x, y0 - 0.1, z], [x, yBot, z], P.colW / 2, P.colW / 2, [1, 0, 0], 0);
      if (Q.lod === 0) boxAB(bags.stone, [x - 0.3, y0 - 0.25, z - 0.3], [x + 0.3, y0 + 0.12, z + 0.3], { ny: 1 });
      occ.push({ x, z, r: 0.35, k: 0.3 });
      cols++;
    }
  }
  if (Q.lod === 0) for (let k = 0; k < 12; k++) {
    const a = 2 * Math.PI * k / 12, c = Math.cos(a), s = Math.sin(a);
    beam(bags.steel, [c * 0.4, yBot - 0.18, s * 0.4], [c * (R - 0.3), yBot - 0.18, s * (R - 0.3)], 0.08, 0.09, [0, 1, 0], 0);
  }

  // ==== THE ARRAY ====
  // the carrier: a fibreglass radome at the centre (casing paint), on a short steel plinth
  const segD = Q.lod === 0 ? 12 : 8;
  cyl(bags.steel, [0, yTop, 0], [0, 1, 0], P.carrierR * 0.8, 0.25, segD, false);
  const yC = yTop + 0.25;
  K.prismRings(bags.trim, K.ringN(0, 0, P.carrierR, segD, 0, yC), K.ringN(0, 0, P.carrierR, segD, 0, yC + P.carrierH), false, false);
  K.apexTo(bags.trim, K.ringN(0, 0, P.carrierR, segD, 0, yC + P.carrierH), [0, yC + P.carrierH + P.carrierR * 0.45, 0]);
  // the sidebands: n derby domes on stubs on the circle
  const nSB = Math.round(P.sbN), rSB = P.sbD / 2, segS = Q.lod === 0 ? 8 : 5;
  for (let i = 0; i < nSB; i++) {
    const a = 2 * Math.PI * i / nSB, x = Math.cos(a) * rSB, z = Math.sin(a) * rSB;
    cyl(bags.steel, [x, yTop, z], [0, 1, 0], 0.035, P.sbStub, Q.lod === 0 ? 4 : 3, false);
    const yd = yTop + P.sbStub;
    K.prismRings(bags.trim, K.ringN(x, z, P.sbDomeR, segS, 0, yd), K.ringN(x, z, P.sbDomeR, segS, 0, yd + P.sbDomeH * 0.6), true, false);
    K.apexTo(bags.trim, K.ringN(x, z, P.sbDomeR, segS, 0, yd + P.sbDomeH * 0.6), [x, yd + P.sbDomeH, z]);
  }

  // ==== THE DME and its RED OBSTRUCTION LIGHT ====
  let top = yC + P.carrierH + P.carrierR * 0.45, beacon = null;
  if (P.dme) {
    const y0 = yC + P.carrierH + 0.1;
    cyl(bags.steel, [0, y0, 0], [0, 1, 0], 0.05, 0.4, 6, false);
    K.prismRings(bags.trim, K.ringN(0, 0, P.dmeR, 8, 0, y0 + 0.4), K.ringN(0, 0, P.dmeR, 8, 0, y0 + P.dmeH), true, false);
    const yl = y0 + P.dmeH;
    cyl(bags.steel, [0, yl, 0], [0, 1, 0], 0.07, 0.06, 8, false);
    bags.glass.setGlow(P.lights ? 2 : 0);
    K.prismRings(bags.glass, K.ringN(0, 0, 0.09, 8, 0, yl + 0.06), K.ringN(0, 0, 0.09, 8, 0, yl + 0.24), false, true);
    bags.glass.setGlow(0);
    top = yl + 0.24;
    if (P.lights) { beacon = { kind: 'beacon', x: 0, y: yl + 0.15, z: 0, nx: 0, nz: 0, col: [1.0, 0.12, 0.06], k: 2.0, range: 60.0, beacon: 1, alt: [1.0, 0.12, 0.06] }; LIT.lights.push(beacon); }
  }

  // ==== THE SITE: the shelter west of the disc (-x), the ladder up to the rim ====
  let shelter = null;
  if (P.shelter) {
    const L = P.shelterL, W = P.shelterW, Hs = P.shelterH;
    const x1 = -(R + P.shelterGap), x0 = x1 - W, z0 = -L / 2, z1 = L / 2;
    const y0 = Math.max(g(x0, z0), g(x0, z1), g(x1, z0), g(x1, z1));
    boxAB(bags.stone, [x0 - 0.3, y0 - 0.4, z0 - 0.3], [x1 + 0.3, y0 + 0.15, z1 + 0.3], { ny: 1 });            // the slab
    boxAB(bags.siding, [x0, y0 + 0.15, z0], [x1, y0 + 0.15 + Hs, z1], { ny: 1, py: 1 });
    boxAB(bags.roof, [x0 - 0.2, y0 + 0.15 + Hs, z0 - 0.2], [x1 + 0.2, y0 + 0.3 + Hs, z1 + 0.2], { ny: 1 });   // a flat roof, its edge
    // the door on the east face (toward the disc) and its lamp
    face(bags.trim, [[x1 + 0.01, y0 + 0.15, -0.45], [x1 + 0.01, y0 + 0.15, 0.45], [x1 + 0.01, y0 + 2.2, 0.45], [x1 + 0.01, y0 + 2.2, -0.45]], [1, 0, 0],
         uvFrame([x1, y0, -0.45], [0, 0, 1], [0, 1, 0]));
    bags.glass.setGlow(P.lights ? 1 : 0);
    boxAB(bags.glass, [x1 + 0.01, y0 + 2.35, -0.08], [x1 + 0.12, y0 + 2.5, 0.08], { nx: 1 });
    bags.glass.setGlow(0);
    if (P.lights) LIT.lights.push({ kind: 'porch', x: x1 + 0.2, y: y0 + 2.4, z: 0, nx: 1, nz: 0, col: [1.0, 0.82, 0.55], k: 1.0, range: 9.0 });
    occ.push({ x: (x0 + x1) / 2, z: 0, hx: W / 2 + 0.3, hz: L / 2 + 0.3, k: 0.45 });
    shelter = { x0, z0, x1, z1, floorY: y0 + 0.15, door: [x1, y0 + 0.15, 0] };
  }
  if (P.ladder) {
    const xl = -(R + 0.05), zl = (P.shelter ? P.shelterL / 2 + 1.5 : 0), y0 = g(xl, zl);
    for (const s of [-0.22, 0.22]) beam(bags.steel, [xl - 0.4, y0, zl + s], [xl, yTop + 1.0, zl + s], 0.025, 0.025, [0, 0, 1], 0);
    if (Q.lod === 0) for (let k = 1; k * 0.3 < yTop - y0; k++) { const t = k * 0.3 / (yTop + 1.0 - y0), x = xl - 0.4 * (1 - t);
      beam(bags.steel, [x, y0 + k * 0.3, zl - 0.22], [x, y0 + k * 0.3, zl + 0.22], 0.012, 0.012, [0, 1, 0], 0); }
  }

  // ==== THE GROUND SKIRT AND THE BAKE ====
  for (const o of occ) o.dry = true;
  if (P.aoGround) HG.buildGroundAO(bags.aoskirt, occ, g);
  const aoInfo = K.bakeAO(BAGS.map(k => bags[k]), { strength: P.ao === undefined ? 0.8 : P.ao, range: P.aoRange || 0.6, ground: g });
  let tris = 0, verts = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of BAGS) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) { const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2];
      if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z; }
  }
  const stats = {
    tris, verts, per, bbox: bb, footprint: Math.PI * R * R, eaveY: yTop, ridgeY: top, floorY: 0,
    role: 'navaid', navaid: { kind: 'DVOR/DME', counterpoise: { d: P.cpD, y: yTop }, sidebands: { n: nSB, d: P.sbD }, columns: cols, top, beacon: !!beacon },
    shelter, front: { x: shelter ? shelter.x0 - 2 : -(R + 2), z: 0, side: -1, depth: 0 },
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, pier: null, lit: LIT, smoke: null, sign: null, yard: [],
  };
  return { bags, stats, P, V: { L: P.cpD, w: P.cpD, wallT: 0.12, floorY: 0 }, R: null, MAT: F ? F.MAT : MAT };
}
// the finish: the control towers' own, its dials mapped (a navaid has no timber, no deck, no derelict)
function applyFinish(P, F) { return TW.applyFinish(Object.assign({}, TW.DEF, DEF, P || {}, { derelict: 0 }), F); }
function finishReport() { return TW.finishReport(); }

window.NAVAID_GEN = { DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, SET_IDX, CATS, catOf, build, applyFinish, makeFinish, finishReport };
// THE CATALOGUE: a landmark; the foot is the counterpoise's circle and the shelter west of it; the ground levelled
// under the whole foot (a DVOR wants flat ground round it), the way in from the west (the access road)
window.NAVAID_GEN.CATALOGUE_V = 1;
window.NAVAID_GEN.CATALOGUE_ALIASES = {};
window.NAVAID_GEN.CATALOGUE = Object.keys(PRESETS).map(name => {
  const Pd = Object.assign({}, DEF, PRESETS[name]);
  const ext = P => { const p = Object.assign({}, Pd, P || {}); const R = p.cpD / 2; return { R: R + 1.5, west: R + (p.shelter ? p.shelterGap + p.shelterW + 1.5 : 1.5) }; };
  const foot = P => { const e = ext(P), out = []; for (let i = 0; i < 24; i++) { const a = 2 * Math.PI * i / 24, c = Math.cos(a);
    out.push([c < 0 ? Math.min(c * e.R, c * e.west) : c * e.R, Math.sin(a) * e.R]); } return out; };
  return { key: 'navaid/' + name, kind: 'building', gen: 'NAVAID_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
    foot, keepOut: 6,
    // the MEDIAN of the ground under the foot (siteShelves' rule for a need that is not 'level'): a 50 m pad
    // levelled to its highest corner would stand on a fill bank on any slope
    ground: { need: 'median', falloff: 10, standing: 'slab' },
    size: P => { const e = ext(P); return { L: e.R + e.west, w: 2 * e.R }; },
    hooks: P => [{ name: 'gate', kind: 'path', p: [-ext(P).west - 1, 0, 0], dir: [-1, 0, 0] }], hooksOf: () => [],
    lod: { dist: [0, 300, 900, 2500] }, slots: { lights: 'stats.lit.lights', ao: 'stats.groundAO' },
    tags: ['navaid', 'vor', 'dme', 'radio'], role: 'navaid', cat: catOf(name), headless: true, gate: 'HOUSE' };
});
})();
