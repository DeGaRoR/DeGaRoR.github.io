// THE SPORTS GROUNDS (G392, the user: "model a few soccer/baseball
// fields/indoor swimming pools. These are very visible from the sky. Have
// some variations in there; grass, brick, etc. Maybe an athletic center too.
// Everything small.") — a fourth generator beside the house, the shed and
// the big buildings: the SOCCER FIELD, the BASEBALL DIAMOND, the RUNNING
// TRACK round a field, the HARD COURT. The pool and the athletic centre are
// buildings and live in BIG_GEN ('swimming pool', 'athletic centre').
//
// WHAT A FIELD IS FROM THE AIR: a flat coloured shape with lines on it, and
// the few things that stand up - goals, a backstop, light masts, a small
// stand, a fence. So the surface is GEOMETRY (a quad, a fan, an oval), the
// lines are thin quads a centimetre over it in their own bag (white, no map,
// they survive into the far mesh because they ARE the aerial read), and the
// standing things are the kit's beams and plates. No canvas, no texture bake:
// the same build runs headless under the gate.
//
// THE FRAME, as the house's: the ground's centre at the origin, x along the
// field's length, z across, +z the road side (the stand and the home plate
// are on the road side), y up, the surface at `P.floorY` over the datum. The
// ground need is FLATTEN: a field is level or it is not a field; the entry
// publishes `foot` (the surface's rectangle plus the margin) and the world
// cuts it.
'use strict';
(() => {
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, off, Bag, face, uvFrame, boxAB, beam, plate, cyl } = K;
const D2R = Math.PI / 180;

// ---- the bags and their materials ------------------------------------------
// turf: the grass (or the artificial green); dirt: the infield skin, the
// warning track, the gravel; court: a hard surface; track: the red running
// surface; line: every painted line; metal: goals, masts, rails, the hoop;
// post: timber posts of the stand and the backstop; net: goal nets, the
// backstop mesh, the chain-link (drawn as one translucent sheet); seat: the
// stand's boards; aoskirt: the house's ground shadow polygons.
const BAGS = ['turf', 'dirt', 'court', 'track', 'line', 'metal', 'post', 'net', 'seat'];
const EXTRA = ['aoskirt'];
const T = (typeof THREE !== 'undefined') ? THREE : null;
const std = (col, o) => T ? new T.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.95, metalness: 0.0 }, o || {})) : { color: col };
// A FINISH OF ITS OWN (G393): the premises builds an item with the generator's
// makeFinish / applyFinish(P, F) / build(P, lod, F), one finish per item
function makeMats() {
  return {
    turf: std(0x4f7a34), dirt: std(0x9a7a55, { roughness: 1.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    court: std(0x5c6a63, { roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    track: std(0x9a3f33, { roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    // the lines win the depth fight with the lot patch (which pulls itself toward the camera by 3 units)
    line: std(0xf2f2ee, { roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }),
    metal: std(0xd9dcdf, { roughness: 0.45, metalness: 0.6 }), post: std(0x6b5a45, { roughness: 0.9 }),
    net: std(0xcfd3d6, { roughness: 0.9, transparent: true, opacity: 0.35, side: T ? T.DoubleSide : 2, depthWrite: false }),
    seat: std(0x8a8f96, { roughness: 0.7, metalness: 0.3 }),
    aoskirt: HG.MAT.aoskirt,
  };
}
const makeFinish = () => ({ MAT: makeMats(), SHADE_U: T ? HG.makeShadeU() : null });
const DEFAULT_FINISH = makeFinish();
const MAT = DEFAULT_FINISH.MAT;
// the surface colours are the dials' (grass / artificial turf / gravel)
const SURFACES = ['grass', 'artificial turf', 'gravel'];
const SURF_COL = [0x4f7a34, 0x2f8a3c, 0x8d8a80];
const KINDS = ['soccer field', 'baseball diamond', 'running track', 'hard court'];

const DEF = {
  kind: 0, L: 64, w: 42, floorY: 0.02, margin: 4, slopeX: 0, slopeZ: 0,   // (the slopes are the bench's site plane; a field is flat)
  surface: 0, lines: 1, goals: 1, backstop: 1, nets: 1,
  stand: 1, standRows: 4, standLenF: 0.45,
  lights: 0, masts: 4, mastH: 14,
  fence: 0, fenceH: 1.8,
  // the diamond
  baseLen: 20, outfield: 55, skin: 1,
  // the track
  lanes: 6, laneW: 1.1,
  // the court
  hoops: 1,
  aoGround: 1, seed: 1, weather: 0.6,
};
const ROWS = [
  ['the ground', [
    ['kind', 'kind', 0, 3, 1, KINDS],
    ['L', 'length', 20, 110, 1, null, P => P.kind !== 1], ['w', 'width', 12, 75, 1, null, P => P.kind !== 1],
    ['surface', 'surface', 0, 2, 1, SURFACES],
    ['margin', 'margin round it', 1, 12, 0.5], ['lines', 'lines', 0, 1, 1],
  ]],
  ['the diamond', [
    ['baseLen', 'base path', 15, 28, 0.5, null, P => P.kind === 1],
    ['outfield', 'outfield reach', 35, 100, 1, null, P => P.kind === 1],
    ['skin', 'infield', 0, 1, 1, ['grass with dirt paths', 'all dirt'], P => P.kind === 1],
    ['backstop', 'backstop', 0, 1, 1, null, P => P.kind === 1],
  ]],
  ['the track', [
    ['lanes', 'lanes', 4, 8, 1, null, P => P.kind === 2], ['laneW', 'lane width', 0.9, 1.25, 0.05, null, P => P.kind === 2],
  ]],
  ['what stands on it', [
    ['goals', 'goals', 0, 1, 1, null, P => P.kind === 0 || P.kind === 2], ['nets', 'nets', 0, 1, 1, null, P => !!P.goals || !!P.backstop],
    ['hoops', 'hoops', 0, 1, 1, null, P => P.kind === 3],
    ['stand', 'a stand', 0, 1, 1], ['standRows', 'rows', 2, 8, 1, null, P => !!P.stand], ['standLenF', 'its length', 0.2, 1, 0.05, null, P => !!P.stand],
    ['lights', 'floodlights', 0, 1, 1], ['masts', 'masts', 2, 6, 2, null, P => !!P.lights], ['mastH', 'mast height', 8, 22, 0.5, null, P => !!P.lights],
    ['fence', 'chain-link round it', 0, 1, 1], ['fenceH', 'fence height', 1.2, 4, 0.1, null, P => !!P.fence],
    ['aoGround', 'ground skirt', 0, 1, 1], ['weather', 'weathering', 0, 1, 0.05],
  ]],
];

const PRESETS = {
  'soccer field': {},
  'soccer, turf, lit': { surface: 1, lights: 1, masts: 4, fence: 1, stand: 1, standRows: 5 },
  'baseball diamond': { kind: 1, baseLen: 20, outfield: 55, skin: 1, backstop: 1, stand: 1, standRows: 3, standLenF: 0.3 },
  'ball park, lit': { kind: 1, baseLen: 27.4, outfield: 80, skin: 0, backstop: 1, stand: 1, standRows: 6, standLenF: 0.4, lights: 1, masts: 4, mastH: 18, fence: 1, fenceH: 2.4 },
  'running track': { kind: 2, L: 84, w: 44, lanes: 6, goals: 1, stand: 1, standRows: 5, standLenF: 0.5, lights: 1, masts: 4 },
  'hard court': { kind: 3, L: 28, w: 15, hoops: 1, stand: 0, fence: 1, fenceH: 3.0, margin: 2 },
  'gravel pitch': { surface: 2, L: 50, w: 32, goals: 1, nets: 0, stand: 0, margin: 3 },
};

// ---- the plan: what the surface is, as numbers (the foot for the catalogue) ----
function plan(P) {
  const kind = Math.round(P.kind);
  let L = P.L, w = P.w;
  // the diamond: a 90-degree fan of `outfield` from the plate (x reaches
  // outfield/sqrt2 either side), the plate 4 m short of the fan's half; the
  // track: the pitch plus the lanes round its ends and sides
  if (kind === 1) { L = 2 * P.outfield * Math.SQRT1_2 + 4; w = P.outfield + 12; }
  if (kind === 2) { const r1 = P.w / 2 + 2 + Math.max(4, Math.round(P.lanes)) * P.laneW; L = P.L + 2 * r1 + 2; w = 2 * r1 + 2; }
  const m = P.margin;
  return { kind, L, w, m, foot: [[-L / 2 - m, -w / 2 - m], [L / 2 + m, -w / 2 - m], [L / 2 + m, w / 2 + m], [-L / 2 - m, w / 2 + m]] };
}

// ---- drawing helpers --------------------------------------------------------
// a flat quad on the ground, wound to face up
function flat(bag, pts, y, uvs) {
  const q = pts.map(p => [p[0], y, p[1]]);
  face(bag, q, [0, 1, 0], uvs || (p => [p[0] * 0.25, p[2] * 0.25]));
}
// a painted line from a to b, `wd` wide, a centimetre over the surface
function line(bag, a, b, y, wd) {
  const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(d[0], d[1]); if (l < 1e-4) return;
  const n = [-d[1] / l * wd / 2, d[0] / l * wd / 2];
  flat(bag, [[a[0] - n[0], a[1] - n[1]], [b[0] - n[0], b[1] - n[1]], [b[0] + n[0], b[1] + n[1]], [a[0] + n[0], a[1] + n[1]]], y);
}
function rectLines(bag, x0, z0, x1, z1, y, wd) {
  line(bag, [x0, z0], [x1, z0], y, wd); line(bag, [x1, z0], [x1, z1], y, wd);
  line(bag, [x1, z1], [x0, z1], y, wd); line(bag, [x0, z1], [x0, z0], y, wd);
}
function arcLine(bag, cx, cz, r, a0, a1, y, wd, n) {
  const N = Math.max(4, n || Math.round(Math.abs(a1 - a0) * r / 1.2));
  let p = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r];
  for (let i = 1; i <= N; i++) { const a = a0 + (a1 - a0) * i / N; const q = [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; line(bag, p, q, y, wd); p = q; }
}
// a fan (a sector) on the ground
function fan(bag, cx, cz, r, a0, a1, y, n) {
  const N = Math.max(6, n || Math.round(Math.abs(a1 - a0) * r / 3));
  for (let i = 0; i < N; i++) {
    const b0 = a0 + (a1 - a0) * i / N, b1 = a0 + (a1 - a0) * (i + 1) / N;
    face(bag, [[cx, y, cz], [cx + Math.cos(b0) * r, y, cz + Math.sin(b0) * r], [cx + Math.cos(b1) * r, y, cz + Math.sin(b1) * r]], [0, 1, 0], p => [p[0] * 0.25, p[2] * 0.25]);
  }
}
// the running track's oval: two straights of `Ls` and two semicircles of radius r; a point at parameter t in [0,1)
function ovalAt(Ls, r, t) {
  const per = 2 * Ls + 2 * Math.PI * r, s = t * per;
  if (s < Ls) return [-Ls / 2 + s, -r];
  if (s < Ls + Math.PI * r) { const a = (s - Ls) / r; return [Ls / 2 + Math.sin(a) * r, -Math.cos(a) * r]; }
  if (s < 2 * Ls + Math.PI * r) return [Ls / 2 - (s - Ls - Math.PI * r), r];
  const a = (s - 2 * Ls - Math.PI * r) / r; return [-Ls / 2 - Math.sin(a) * r, Math.cos(a) * r];
}

// ---- the pieces ---------------------------------------------------------------
function goal(bags, Q, x, dir, y, P) {
  // a 7.32 x 2.44 goal (5 x 2 on a small pitch) facing the field: posts, the bar, the net
  const big = P.w >= 40, gw = big ? 7.32 : 5.0, gh = big ? 2.44 : 2.0, depth = big ? 2.0 : 1.5;
  const r = 0.06;
  for (const sz of [-1, 1]) beam(bags.metal, [x, y, sz * gw / 2], [x, y + gh, sz * gw / 2], r, r, [1, 0, 0]);
  beam(bags.metal, [x, y + gh, -gw / 2], [x, y + gh, gw / 2], r, r, [0, 1, 0]);
  if (Q.lod === 0) {
    const xb = x + dir * depth;
    for (const sz of [-1, 1]) beam(bags.metal, [x, y + gh, sz * gw / 2], [xb, y + 0.9, sz * gw / 2], 0.03, 0.03, [0, 1, 0]);
    for (const sz of [-1, 1]) beam(bags.metal, [xb, y, sz * gw / 2], [xb, y + 0.9, sz * gw / 2], 0.03, 0.03, [1, 0, 0]);
    if (P.nets) {
      face(bags.net, [[xb, y, -gw / 2], [xb, y, gw / 2], [xb, y + 0.9, gw / 2], [xb, y + 0.9, -gw / 2]], [dir, 0, 0], uvFrame([xb, y, -gw / 2], [0, 0, 1], [0, 1, 0]));
      face(bags.net, [[xb, y + 0.9, -gw / 2], [xb, y + 0.9, gw / 2], [x, y + gh, gw / 2], [x, y + gh, -gw / 2]], [dir, 0.5, 0], uvFrame([xb, y + 0.9, -gw / 2], [0, 0, 1], [0, 1, 0]));
      for (const sz of [-1, 1]) face(bags.net, [[x, y, sz * gw / 2], [xb, y, sz * gw / 2], [xb, y + 0.9, sz * gw / 2], [x, y + gh, sz * gw / 2]], [0, 0, sz], uvFrame([x, y, sz * gw / 2], [1, 0, 0], [0, 1, 0]));
    }
  }
  return { x, z: 0, w: gw, h: gh, dir };
}
function hoop(bags, Q, x, dir, y) {
  // a post behind the baseline, the backboard over it, the ring toward the court
  const xp = x + dir * 1.2;
  beam(bags.metal, [xp, y, 0], [xp, y + 3.4, 0], 0.06, 0.06, [1, 0, 0]);
  beam(bags.metal, [xp, y + 3.35, 0], [x + dir * 0.15, y + 3.35, 0], 0.04, 0.04, [0, 1, 0]);
  const bb = [x + dir * 0.15, y + 2.9, -0.9];
  face(bags.seat, [bb, [bb[0], bb[1], 0.9], [bb[0], bb[1] + 1.05, 0.9], [bb[0], bb[1] + 1.05, -0.9]], [-dir, 0, 0], uvFrame(bb, [0, 0, 1], [0, 1, 0]));
  if (Q.lod === 0) {
    const cx = x - dir * 0.25, cy = y + 3.05, seg = 12;
    for (let i = 0; i < seg; i++) {
      const a0 = 2 * Math.PI * i / seg, a1 = 2 * Math.PI * (i + 1) / seg;
      beam(bags.metal, [cx + Math.cos(a0) * 0.23, cy, Math.sin(a0) * 0.23], [cx + Math.cos(a1) * 0.23, cy, Math.sin(a1) * 0.23], 0.012, 0.012, [0, 1, 0]);
    }
  }
  return { x, dir };
}
function stand(bags, Q, P, x0, x1, zFront, y, occ) {
  // a small stand on the road side: `standRows` boards stepping up and back
  // from zFront, on a post frame, an aisle rail at each end
  const rows = Math.max(2, Math.round(P.standRows)), rise = 0.42, run = 0.75;
  const L = x1 - x0;
  for (let i = 0; i < rows; i++) {
    const zb = zFront + i * run, yb = y + 0.45 + i * rise;
    boxAB(bags.seat, [x0, yb - 0.04, zb], [x1, yb, zb + 0.40]);            // the seat board
    if (Q.lod === 0) boxAB(bags.seat, [x0, yb - rise + 0.02, zb + 0.55], [x1, yb - 0.04, zb + 0.60]);   // the riser
    boxAB(bags.seat, [x0, yb - rise + 0.03, zb + 0.40], [x1, yb - rise + 0.06, zb + 0.75]); // the foot board
  }
  const n = Math.max(2, Math.round(L / 2.4));
  for (let i = 0; i <= n; i++) {
    const x = x0 + L * i / n;
    for (let j = 0; j < rows; j += (Q.lod === 0 ? 1 : rows - 1)) {
      const zb = zFront + j * run + 0.2, top = y + 0.45 + j * rise - 0.04;
      beam(bags.post, [x, y - 0.2, zb], [x, top, zb], 0.05, 0.05, [1, 0, 0]);
    }
  }
  const topY = y + 0.45 + (rows - 1) * rise;
  for (const x of [x0, x1]) {                                         // the end rails
    beam(bags.metal, [x, y + 0.1, zFront - 0.1], [x, topY + 1.0, zFront + (rows - 1) * run + 0.3], 0.02, 0.02, [0, 0, 1]);
    beam(bags.metal, [x, topY + 1.0, zFront + (rows - 1) * run + 0.3], [x, topY + 1.0, zFront + (rows - 1) * run + 0.3], 0.02, 0.02, [0, 0, 1]);
  }
  beam(bags.metal, [x0, topY + 1.0, zFront + (rows - 1) * run + 0.3], [x1, topY + 1.0, zFront + (rows - 1) * run + 0.3], 0.02, 0.02, [0, 1, 0]);   // the back rail
  occ.push({ x: (x0 + x1) / 2, z: zFront + (rows - 1) * run / 2 + 0.3, hx: L / 2, hz: (rows - 1) * run / 2 + 0.5, k: 0.55, soft: 1.0 });
  return { x0, x1, z0: zFront, z1: zFront + (rows - 1) * run + 0.75, rows, top: topY };
}
function mast(bags, Q, x, z, y, h, aimX, aimZ, lights) {
  cyl(bags.metal, [x, y - 0.3, z], [0, 1, 0], 0.16, h + 0.3, Q.lod === 0 ? 10 : 6, true);
  // the head: a bar with four lamps, aimed at the field
  const a = Math.atan2(aimZ - z, aimX - x);
  const ux = Math.cos(a), uz = Math.sin(a);           // toward the field
  const px = -uz, pz = ux;                             // across
  const hy = y + h;
  beam(bags.metal, [x + px * 1.2, hy, z + pz * 1.2], [x - px * 1.2, hy, z - pz * 1.2], 0.05, 0.05, [0, 1, 0]);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const s = -0.9 + 0.6 * i;
    const lx = x + px * s + ux * 0.25, lz = z + pz * s + uz * 0.25;
    if (Q.lod === 0) boxAB(bags.seat, [lx - 0.18, hy - 0.2, lz - 0.18], [lx + 0.18, hy + 0.2, lz + 0.18]);
    if (lights) out.push({ kind: 'flood', x: lx, y: hy, z: lz, nx: ux, nz: uz, aim: [aimX, y, aimZ], col: [1.0, 0.98, 0.9], k: 4.0, range: 60 });
  }
  return out;
}
function fenceRun(bags, Q, a, b, y, h, step) {
  const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]); if (l < 0.5) return;
  const n = Math.max(1, Math.round(l / step));
  for (let i = 0; i <= n; i++) {
    const x = a[0] + d[0] * i / n, z = a[1] + d[1] * i / n;
    if (Q.lod === 0 || i % 2 === 0) beam(bags.metal, [x, y - 0.3, z], [x, y + h, z], 0.025, 0.025, [d[0], 0, d[1]]);
  }
  beam(bags.metal, [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.02, 0.02, [0, 1, 0]);
  const nrm2 = [-d[1] / l, 0, d[0] / l];
  face(bags.net, [[a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]]], nrm2, uvFrame([a[0], y, a[1]], [d[0] / l, 0, d[1] / l], [0, 1, 0]));
}

// ---- THE TURF (G393, the user: "the grass really lacks macro variation and
// detailed textures. They're much, much too clean. Can you generate patches
// of lusher/deader grass?"): the field's grass is the LOT GROUND PATCH the
// village lays under a house (src/viewer/lot_tex.js, five scanned sets
// blended per vertex) - the generator publishes `stats.turf` in that
// contract: a grid over the ground with per-vertex SPLAT weights (x the
// lush/yellow drift on a slow noise, y the DEAD ground - the goalmouths, the
// centre circle, the touchline where the players run, the base paths - z the
// bare dirt, w pebbles) and TONE (x darkness, y lushness). The flat turf bag
// stays for the headless gate and any viewer without the material.
function vHash(x, z, k) { const h = Math.sin(x * 12.9898 + z * 78.233 + (k || 0) * 37.71) * 43758.5453; return h - Math.floor(h); }
function vNoise(x, z, k) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = vHash(ix, iz, k), b = vHash(ix + 1, iz, k), c = vHash(ix, iz + 1, k), d = vHash(ix + 1, iz + 1, k);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
}
function fbm(x, z, k, n) { let v = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < (n || 3); i++) { v += a * vNoise(x * f + i * 7.3, z * f + i * 3.1, k + i); t += a; a *= 0.5; f *= 2.1; } return v / t; }
function turfPlan(P, kind, ground, extra) {
  const y = P.floorY + 0.006, cell = 1.5, seed = (P.seed | 0) * 13;
  const x0 = ground.x0 - 1.0, x1 = ground.x1 + 1.0, z0 = ground.z0 - 1.0, z1 = ground.z1 + 1.0;
  const nx = Math.max(2, Math.ceil((x1 - x0) / cell)), nz = Math.max(2, Math.ceil((z1 - z0) / cell));
  const pos = [], uv = [], splat = [], tone = [], alpha = [], idx = [];
  const gauss = (dx, dz, r) => Math.exp(-(dx * dx + dz * dz) / (r * r));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
    pos.push(x, y, z); uv.push(x / 2.0, z / 2.0);
    // the slow drift and the patches: lusher here, deader there
    const lush = fbm(x * 0.05 + 3, z * 0.05 + 7, seed + 1, 3), dead = fbm(x * 0.13 + 1, z * 0.13 + 9, seed + 5, 3);
    let dry = Math.max(0, dead - 0.55) * 2.2, dirt = 0, peb = 0, inside = 1;
    if (kind === 0 || kind === 2) {
      // the wear: the two goalmouths, the centre circle, the touchlines
      for (const gx of [-P.L / 2, P.L / 2]) dry = Math.max(dry, 0.9 * gauss(x - gx, z, 5.5) * (Math.abs(x) < P.L / 2 + 0.5 ? 1 : 0));
      dry = Math.max(dry, 0.5 * gauss(x, z, 4.0));
      const tl = Math.abs(Math.abs(z) - P.w / 2);
      if (tl < 1.2 && Math.abs(x) < P.L / 2) dry = Math.max(dry, 0.45 * (1 - tl / 1.2) * (0.6 + 0.4 * dead));
      if (kind === 2 && extra && extra.r0) { const d = Math.hypot(Math.max(0, Math.abs(x) - extra.Ls / 2), z); if (d > extra.r0 - 0.5) inside = 0; }
    } else if (kind === 1 && extra) {
      // the diamond: nothing inside the skin (dirt is drawn), the outfield
      // worn along the base paths' ends, dead beyond the fence
      const dx = x - extra.plate[0], dz = z - extra.plate[1], d = Math.hypot(dx, dz);
      const ang = Math.atan2(dz, dx);
      if (d > extra.R - 0.3 || ang > -Math.PI / 4 + 0.02 || ang < -Math.PI * 3 / 4 - 0.02) inside = 0;
      if (d < extra.skinR + 0.3) inside = 0;
      dirt = Math.max(0, 1 - Math.abs(d - extra.skinR) / 1.2) * 0.6;
      dry = Math.max(dry, 0.5 * gauss(d - extra.R + 3, 0, 2.5));
    } else if (kind === 3) inside = 0;
    // the edge: the patch fades out over its last cell round the ground
    const ex = Math.min(x - x0, x1 - x) / 1.6, ez = Math.min(z - z0, z1 - z) / 1.6;
    const a = inside * Math.max(0, Math.min(1, ex, ez));
    splat.push(lush, Math.min(1, dry), Math.min(1, dirt), peb);
    tone.push(0, lush > 0.62 ? (lush - 0.62) * 2.5 : 0);
    alpha.push(a);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  return { pos, uv, splat, tone, alpha, idx, cell, n: [nx + 1, nz + 1] };
}

// ---- the build ---------------------------------------------------------------
function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const Q = { lod: lod | 0 };
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const PL = plan(P);
  const y = P.floorY, kind = PL.kind;
  const lights = [], occ = [], goals = [], out = { goals };
  const wd = 0.12, yl = y + 0.012;
  const surfBag = Math.round(P.surface) === 2 ? bags.dirt : bags.turf;
  let ground = null;   // the surface's own rectangle (what the stand and the fence stand off)

  if (kind === 0 || kind === 2) {
    // THE PITCH: the rectangle, its lines, the goals at both ends
    let L = P.L, w = P.w;
    let xIn = -L / 2 - 2, xOut = L / 2 + 2, zIn = -w / 2 - 2, zOut = w / 2 + 2;   // the run-off
    if (kind === 2) {
      // THE TRACK round it: the oval's straights are the pitch's length, its
      // inner radius half the pitch's width plus the run-off; lanes outward
      const Ls = L, r0 = w / 2 + 2, lw = P.laneW, nl = Math.max(4, Math.round(P.lanes));
      const r1 = r0 + nl * lw;
      // the surface: rings of quads between the inner and outer oval
      const N = 96;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        const a0 = ovalAt(Ls, r0, t0), a1 = ovalAt(Ls, r0, t1), b0 = ovalAt(Ls, r1, t0), b1 = ovalAt(Ls, r1, t1);
        flat(bags.track, [a0, a1, b1, b0].map(p => [p[0], p[1]]), y + 0.004);
      }
      // the lane lines, the inner kerb and the finish line
      if (P.lines) for (let k2 = 0; k2 <= nl; k2++) {
        const r = r0 + k2 * lw; const Np = 160;
        let p = ovalAt(Ls, r, 0);
        for (let i = 1; i <= Np; i++) { const q = ovalAt(Ls, r, i / Np); line(bags.line, p, q, y + 0.016, k2 === 0 ? 0.08 : wd); p = q; }
      }
      if (P.lines) line(bags.line, [Ls / 2 - 6, -r0], [Ls / 2 - 6, -r1], y + 0.018, 0.10);
      xIn = -Ls / 2 - r1 - 0.5; xOut = Ls / 2 + r1 + 0.5; zIn = -r1 - 0.5; zOut = r1 + 0.5;
      out.oval = { Ls, r0, r1 };
      // the infield turf fills the inner oval
      const Ni = 64;
      for (let i = 0; i < Ni; i++) {
        const a0 = ovalAt(Ls, r0, i / Ni), a1 = ovalAt(Ls, r0, (i + 1) / Ni);
        face(surfBag, [[0, y, 0], [a0[0], y, a0[1]], [a1[0], y, a1[1]]], [0, 1, 0], p => [p[0] * 0.25, p[2] * 0.25]);
      }
    } else {
      flat(surfBag, [[xIn, zIn], [xOut, zIn], [xOut, zOut], [xIn, zOut]], y);
    }
    if (P.lines) {
      rectLines(bags.line, -L / 2, -w / 2, L / 2, w / 2, yl, wd);
      line(bags.line, [0, -w / 2], [0, w / 2], yl, wd);
      arcLine(bags.line, 0, 0, Math.min(9.15, w * 0.18), 0, 2 * Math.PI, yl, wd, 40);
      const pd = Math.min(16.5, L * 0.18), pw = Math.min(40.3, w * 0.8), gd = Math.min(5.5, L * 0.07), gw = Math.min(18.3, w * 0.42);
      for (const s of [-1, 1]) {
        const xe = s * L / 2;
        rectLines(bags.line, xe, -pw / 2, xe - s * pd, pw / 2, yl, wd);
        rectLines(bags.line, xe, -gw / 2, xe - s * gd, gw / 2, yl, wd);
        line(bags.line, [xe - s * 11, -0.2], [xe - s * 11, 0.2], yl, wd);
      }
    }
    if (P.goals) for (const s of [-1, 1]) goals.push(goal(bags, Q, s * L / 2 + s * 0.06, s, y, P));
    ground = { x0: xIn, x1: xOut, z0: zIn, z1: zOut };
  } else if (kind === 1) {
    // THE DIAMOND: home plate on the road side (+z), the field opening away
    // from it (-z); the outfield a fan of `outfield` from the plate over 90
    // degrees round the -z axis; the infield square of `baseLen` turned 45
    // degrees with the plate at its road corner; the mound at its middle
    const R = P.outfield, b = P.baseLen;
    const hz = R / 2 - 4;                     // the plate's z: the fan fits the plan
    const a0 = -Math.PI * 3 / 4, a1 = -Math.PI / 4;     // toward -z, 45 either side
    fan(surfBag, 0, hz, R, a0, a1, y, 40);
    // the warning track: a band inside the fence
    for (let i = 0; i < 40; i++) {
      const c0 = a0 + (a1 - a0) * i / 40, c1 = a0 + (a1 - a0) * (i + 1) / 40;
      flat(bags.dirt, [[Math.cos(c0) * (R - 3), hz + Math.sin(c0) * (R - 3)], [Math.cos(c0) * R, hz + Math.sin(c0) * R], [Math.cos(c1) * R, hz + Math.sin(c1) * R], [Math.cos(c1) * (R - 3), hz + Math.sin(c1) * (R - 3)]], y + 0.02);
    }
    // the infield: the square on its corner
    const d = b / Math.SQRT2;                 // the diagonal's half = the square's half-width, the plate to 2nd base is b*sqrt2
    const plate = [0, hz], first = [d, hz - d], second = [0, hz - 2 * d], third = [-d, hz - d];
    const skinR = b * 0.95;
    // THE LAYERS STAND 3 CM APART (G401.1): at a hundred metres the depth buffer cannot tell 3 mm, and the
    // skin, the inner grass, the mound and the plate's circle fought - the user's "overlapping at the centre"
    fan(bags.dirt, 0, hz, skinR, a0, a1, y + 0.03, 24);      // the skin arc round the infield
    if (!Math.round(P.skin)) {                                 // grass inside the paths
      const k = 0.82;
      flat(surfBag, [[0, hz - 2.4], [first[0] * k, hz - (hz - first[1]) * k - 1.2], [0, hz - 2 * d * 0.9], [third[0] * k, hz - (hz - third[1]) * k - 1.2]].map(p => p), y + 0.06);
    }
    // the mound and the plate's circle
    fan(bags.dirt, 0, hz - d, 2.6, 0, 2 * Math.PI, y + 0.09, 16);
    fan(bags.dirt, 0, hz, 3.5, 0, 2 * Math.PI, y + 0.09, 16);
    if (P.lines) {
      // the foul lines out to the fence, the bases, the batter's boxes
      line(bags.line, plate, [Math.cos(a1) * (R - 0.5), hz + Math.sin(a1) * (R - 0.5)], y + 0.12, wd);
      line(bags.line, plate, [Math.cos(a0) * (R - 0.5), hz + Math.sin(a0) * (R - 0.5)], y + 0.12, wd);
      for (const bs of [first, second, third]) flat(bags.line, [[bs[0] - 0.2, bs[1] - 0.2], [bs[0] + 0.2, bs[1] - 0.2], [bs[0] + 0.2, bs[1] + 0.2], [bs[0] - 0.2, bs[1] + 0.2]], y + 0.13);
      flat(bags.line, [[-0.22, hz + 0.2], [0.22, hz + 0.2], [0.22, hz - 0.2], [0, hz - 0.4], [-0.22, hz - 0.2]], y + 0.13);
      for (const s of [-1, 1]) rectLines(bags.line, s * 0.4, hz + 0.9, s * 1.6, hz - 0.9, y + 0.12, 0.08);
    }
    // the backstop: a curved fence behind the plate, posts and mesh, 4.5 m high
    if (P.backstop) {
      const rb = 6.5, hB = 4.5, Nb = 6, aa = Math.PI / 2 - 0.9, ab = Math.PI / 2 + 0.9;
      let prev = null;
      for (let i = 0; i <= Nb; i++) {
        const a = aa + (ab - aa) * i / Nb;
        const px = Math.cos(a) * rb, pz = hz + Math.sin(a) * rb;
        beam(bags.metal, [px, y - 0.3, pz], [px, y + hB, pz], 0.05, 0.05, [1, 0, 0]);
        if (prev && P.nets) face(bags.net, [[prev[0], y, prev[1]], [px, y, pz], [px, y + hB, pz], [prev[0], y + hB, prev[1]]], [-Math.cos(a), 0, -Math.sin(a)], uvFrame([prev[0], y, prev[1]], nrm([px - prev[0], 0, pz - prev[1]]), [0, 1, 0]));
        if (prev) beam(bags.metal, [prev[0], y + hB, prev[1]], [px, y + hB, pz], 0.03, 0.03, [0, 1, 0]);
        prev = [px, pz];
      }
      out.backstop = { x: 0, z: hz + rb, h: hB, r: rb };
    }
    // the outfield fence along the arc
    if (P.fence) {
      let prev = null; const Nf = 30;
      for (let i = 0; i <= Nf; i++) { const a = a0 + (a1 - a0) * i / Nf; const q = [Math.cos(a) * R, hz + Math.sin(a) * R]; if (prev) fenceRun(bags, Q, prev, q, y, P.fenceH, 3.0); prev = q; }
    }
    out.plate = { x: 0, z: hz }; out.bases = [first, second, third]; out.diamond = { plate: [0, hz], R, skinR };
    ground = { x0: -R * Math.SQRT1_2 - 1, x1: R * Math.SQRT1_2 + 1, z0: hz - R - 1, z1: hz + 8 };
  } else {
    // THE HARD COURT: the slab, a basketball court's lines, the hoops
    const L = P.L, w = P.w;
    flat(bags.court, [[-L / 2 - 1, -w / 2 - 1], [L / 2 + 1, -w / 2 - 1], [L / 2 + 1, w / 2 + 1], [-L / 2 - 1, w / 2 + 1]], y);
    if (P.lines) {
      rectLines(bags.line, -L / 2, -w / 2, L / 2, w / 2, yl, 0.05);
      line(bags.line, [0, -w / 2], [0, w / 2], yl, 0.05);
      arcLine(bags.line, 0, 0, Math.min(1.8, w * 0.12), 0, 2 * Math.PI, yl, 0.05, 24);
      for (const s of [-1, 1]) {
        const xe = s * L / 2, kd = Math.min(5.8, L * 0.2), kw = Math.min(4.9, w * 0.33);
        rectLines(bags.line, xe, -kw / 2, xe - s * kd, kw / 2, yl, 0.05);
        arcLine(bags.line, xe - s * 1.575, 0, Math.min(6.75, w * 0.45), s > 0 ? Math.PI / 2 + 0.35 : -Math.PI / 2 + 0.35, s > 0 ? 3 * Math.PI / 2 - 0.35 : Math.PI / 2 - 0.35, yl, 0.05, 30);
      }
    }
    if (P.hoops) for (const s of [-1, 1]) goals.push(hoop(bags, Q, s * L / 2, s, y));
    ground = { x0: -L / 2 - 1, x1: L / 2 + 1, z0: -w / 2 - 1, z1: w / 2 + 1 };
  }
  // THE STAND on the road side, centred, off the surface by a metre
  let st = null;
  if (P.stand) {
    const half = (ground.x1 - ground.x0) * P.standLenF / 2;
    st = stand(bags, Q, P, -half, half, ground.z1 + 1.0, y, occ);
  }
  // THE MASTS at the corners (four) or the long sides (two / six)
  if (P.lights) {
    const n = Math.max(2, Math.round(P.masts)), xs = [];
    const zBack = ground.z0 - 1.5, zFront = (st ? st.z1 : ground.z1) + 1.5;
    const along = n === 2 ? [0] : (n === 4 ? [ground.x0 - 1.5, ground.x1 + 1.5] : [ground.x0 + (ground.x1 - ground.x0) / 6, 0, ground.x1 - (ground.x1 - ground.x0) / 6]);
    for (const x of along) xs.push([x, zBack], [x, zFront]);
    for (const m of xs) { for (const l of mast(bags, Q, m[0], m[1], y, P.mastH, 0, 0, P.lights)) lights.push(l); occ.push({ x: m[0], z: m[1], r: 0.3, k: 0.5, soft: 0.4 }); }
    out.masts = xs;
  }
  // THE FENCE round the whole ground (the diamond's outfield fence is the arc above)
  if (P.fence && kind !== 1) {
    const m = 1.5, x0 = ground.x0 - m, x1 = ground.x1 + m, z0 = ground.z0 - m, z1 = (st ? st.z1 : ground.z1) + m;
    fenceRun(bags, Q, [x0, z0], [x1, z0], y, P.fenceH, 3.0); fenceRun(bags, Q, [x1, z0], [x1, z1], y, P.fenceH, 3.0);
    // the road side has its gate: two runs
    fenceRun(bags, Q, [x1, z1], [2.0, z1], y, P.fenceH, 3.0); fenceRun(bags, Q, [-2.0, z1], [x0, z1], y, P.fenceH, 3.0);
    fenceRun(bags, Q, [x0, z1], [x0, z0], y, P.fenceH, 3.0);
    out.fence = { x0, x1, z0, z1, gate: [-2, 2] };
  }
  if (P.aoGround && occ.length) HG.buildGroundAO(bags.aoskirt, occ, () => y - 0.005);
  // the grass as the lot ground patch's record (the viewer draws it over the flat turf)
  const turf = Math.round(P.surface) === 2 ? null : turfPlan(P, kind, ground, kind === 2 ? out.oval : (kind === 1 ? out.diamond : null));
  // ---- the numbers
  let tris = 0, verts = 0, nan = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of BAGS) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) {
      const x = d.pos[i], yy = d.pos[i + 1], z = d.pos[i + 2];
      if (!isFinite(x) || !isFinite(yy) || !isFinite(z)) { nan++; continue; }
      if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (yy < bb.y0) bb.y0 = yy; if (yy > bb.y1) bb.y1 = yy; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z;
    }
  }
  const stats = Object.assign({
    lod: Q.lod, tris, verts, per, bbox: bb, nan, degen: 0, kind: KINDS[kind], role: 'sports', foot: PL.foot,
    ground, stand: st, turf, lit: { windows: 0, panes: 0, bulbs: 0, lights }, groundAO: occ, floorY: y,
    ridgeY: bb.y1, eaveY: 0, footprint: (ground.x1 - ground.x0) * (ground.z1 - ground.z0), area: 0, surface: SURFACES[Math.round(P.surface)],
  }, out);
  return { bags, stats, P, MAT: F ? F.MAT : MAT };
}
function applyFinish(P, F) {
  if (!T) return;
  const MAT = F ? F.MAT : DEFAULT_FINISH.MAT, SHADE_U = F ? F.SHADE_U : DEFAULT_FINISH.SHADE_U;
  MAT.turf.color.setHex(Math.round(P.surface) === 1 ? SURF_COL[1] : SURF_COL[0]);   // gravel is the dirt bag's colour
  // THE WEATHERING (G393, the user: "some overall weathering of the
  // materials"): the house's dirt ramp and repetition breaker on every
  // surface, the weather clouds (bleach / brown / blacken) on the track,
  // the court, the dirt, the lines and the stand - a painted line that has
  // seen a season is not pure white
  for (const k of ['dirt', 'court', 'track', 'line', 'metal', 'post', 'seat']) HG.shadeHouse(MAT[k], SHADE_U);
  for (const k of ['court', 'track', 'line', 'dirt', 'seat']) HG.cloudWeather(MAT[k], P.weather === undefined ? 0.6 : P.weather, 0);
  HG.shadeSkirt(MAT.aoskirt);
  SHADE_U.uDirtTop.value = P.floorY + 0.6; SHADE_U.uDirtH.value = 0.6;
  SHADE_U.uDirtK.value = 0.35; SHADE_U.uNoiseK.value = 0.35; SHADE_U.uAOd.value = 0.3; SHADE_U.uSag.value = 0;
  for (const k of ['dirt', 'court', 'track', 'line', 'metal', 'post', 'seat']) {
    const ud = MAT[k].userData && MAT[k].userData.dirt; if (!ud) continue;
    ud.uDirtGain.value = k === 'line' ? 1.4 : (k === 'post' ? 1.3 : 0.9); ud.uAgeDesat.value = k === 'post' ? 0.5 : 0; ud.uAgeDark.value = k === 'post' ? 0.3 : 0;
    ud.uDirtOwn.value.setHex(k === 'track' ? 0x5a3a30 : 0x6d6353); ud.uWander.value = 0;
  }
}
function randomSport(seed) {
  let st = ((seed | 0) * 2654435761 + 7) >>> 0;
  const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const names = Object.keys(PRESETS);
  const P = Object.assign({}, DEF, PRESETS[names[Math.floor(rnd() * names.length)]]);
  P.surface = Math.floor(rnd() * 3); P.lights = rnd() < 0.4 ? 1 : 0; P.stand = rnd() < 0.7 ? 1 : 0; P.fence = rnd() < 0.5 ? 1 : 0;
  if (P.kind !== 1) { P.L = Math.round(P.L * (0.8 + rnd() * 0.4)); P.w = Math.round(P.w * (0.8 + rnd() * 0.4)); }
  P.seed = seed | 0;
  return P;
}

const catOf = () => 'sports';
window.SPORT_GEN = { DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, KINDS, SURFACES, build, plan, applyFinish, makeFinish, randomSport, catOf };
// THE CATALOGUE (PREMISES-CONTRACT section 2): a ground the world flattens
window.SPORT_GEN.CATALOGUE_V = 1;
window.SPORT_GEN.CATALOGUE_ALIASES = {};
window.SPORT_GEN.CATALOGUE = Object.keys(PRESETS).map(name => {
  const Pd = Object.assign({}, DEF, PRESETS[name]);
  // kind BUILDING, not park: a site item the composer flattens at its foot's median and the renderer
  // builds like any generator's (a park is a plot-stood thing with a `stand`, the totems' way)
  return { key: 'sport/' + name, kind: 'building', gen: 'SPORT_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
    foot: P => plan(Object.assign({}, Pd, P || {})).foot, keepOut: 2,
    ground: { need: 'flatten', level: 'median', falloff: 8, standing: 'slab' },
    size: P => { const pl = plan(Object.assign({}, Pd, P || {})); return { L: pl.L + 2 * pl.m, w: pl.w + 2 * pl.m }; },
    hooks: () => [], hooksOf: () => [], lod: { dist: [0, 200, 600, 1500] },
    slots: { lights: 'stats.lit.lights', ao: 'stats.groundAO' },
    tags: ['institution', 'sports', KINDS[Math.round(Pd.kind)]], role: 'sports', cat: 'sports', headless: true, gate: 'HOUSE' };
});
})();
