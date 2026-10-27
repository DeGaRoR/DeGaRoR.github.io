// _lods_lib.js - THE FAR RUNGS, MEASURED (LODS-2026-10; the user, 27 Oct: "the LODs are not great, they don't even
// represent closed volumes ... Some houses show without roof and black").
//
// Node only, no GPU. For one generated building it makes every rung the game draws of it - by the game's own rules,
// restated here from src/viewer/render_premises.js (DETAIL / detailOf, LOD1_SHELL / lod1Bags, hlodBoxes) and
// tools/town_kit.js / tools/city_cook.js (the kit's box, the city's far shell) - and measures each one:
//
//   leak     the share of a view's covered pixels whose NEAREST surface is a back face: the eye looks INTO the
//            building through a gap (an unglazed window, an open wall top, a missing roof). With the far material's
//            back-face culling that pixel shows an inner face lit from the wrong side or the ground behind: black.
//   roof     seen from straight above, the share of the near mesh's roofed plan where the rung's visible surface is
//            an up-facing front face at roof height (>= 60 % of the near roof's height over the base)
//   iou      the rung's silhouette against the near mesh's (25 views): it is still the same building
//   open     welded (1 mm) edges used by one triangle only, in metres: a closed volume has none
//   tris     what it costs
//
// A software z-buffer (orthographic, 25 views: 8 azimuths x 3 elevations + straight down) - the same visibility the
// GPU computes, so "leak" is what the far town draws, not a topological opinion (a building is an assembly of closed
// boards and slabs that interpenetrate: no manifold test can pass it, a picture can).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const TOOLS = __dirname, ROOT = path.join(TOOLS, '..');

// ---- the far rules, restated (each line names where it lives in the game) --------------------------------------
// render_premises.js DETAIL (the second cut keeps keep2 largest plain bags; a hangar shell bag of keepShare stays)
function readDetail() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  const m = /const DETAIL = \{ px: ([\d.]+), area: ([\d.]+), hyst: ([\d.]+), px2: ([\d.]+), keep2: (\d+), keepShare: ([\d.]+)/.exec(src);
  const h = /const HLOD = \{[^}]*near: ([\d.]+), far2: ([\d.]+)[\s\S]*?swapPx: ([\d.]+), detailPx: ([\d.]+)/.exec(src);
  const sh = /const LOD1_SHELL = \/(.*)\/;/.exec(src);
  const e = /const LOD_E = \[(\d+), (\d+)\]/.exec(src);
  return { area: +m[2], keep2: +m[5], keepShare: +m[6], near: +h[1], far2: +h[2], swapPx: +h[3], detailPx: +h[4],
           shell: sh ? new RegExp(sh[1]) : null, box: /^(siding|roof)/, LOD_E: [+e[1], +e[2]],
           // WHAT THE GAME DOES TODAY, read off its code (LODS-2026-10 lands in steps; the ratchet measures each step's game)
           itemBanded: /grp\.userData\.lod1 = lod1Bags\(GEN, it\.P/.test(src),       // step 1: a site item on its lod 1
           outBanded: /og\.userData\.lod1 = lod1Bags\(HG, plot\.out\.P/.test(src),   // step 1: an outbuilding banded on its own mesh
           boxes: /function hlodBoxes\(/.test(src) };                                  // (gone at step 2)
}
const RULE = readDetail();
// the switch distances at the game's camera (46 deg vertical, 1080 rows: F = 540 / tan 23 deg)
const F1080 = 540 / Math.tan(23 * Math.PI / 180);
const edgeOf = R => Math.min(RULE.LOD_E[1], Math.max(RULE.LOD_E[0], R * F1080 / RULE.swapPx));
const detailEdgeOf = R => Math.max(R * F1080 / RULE.detailPx, edgeOf(R) * 1.27);

// ---- the generators, headless (GATE HOUSE's stub THREE, with the material facts the far rules read) --------------
function stubTHREE() {
  const src = fs.readFileSync(path.join(TOOLS, '_house_check.js'), 'utf8');
  const T = new Function(src.slice(src.indexOf('function makeTHREE()'), src.indexOf('const win = {};')) + '; return makeTHREE;')()();
  const Base = T.MeshStandardMaterial;
  // detailOf's `plain`: type MeshStandardMaterial, opaque, no emissive; lod1Bags: isMeshStandardMaterial, opaque
  function Std(o) { Base.call(this, o); this.type = 'MeshStandardMaterial'; this.isMeshStandardMaterial = true; this.side = (o && o.side) || 0;
                    this.emissiveHex = o && o.emissive ? o.emissive : 0; this.transparent = !!(o && o.transparent); this.userData = (o && o.userData) || {}; }
  Std.prototype = Object.create(Base.prototype);
  function Basic(o) { Base.call(this, o); this.type = 'MeshBasicMaterial'; this.side = (o && o.side) || 0; this.transparent = !!(o && o.transparent); this.userData = (o && o.userData) || {}; }
  Basic.prototype = Object.create(Base.prototype);
  T.MeshStandardMaterial = Std; T.MeshBasicMaterial = Basic; T.MeshLambertMaterial = Basic;
  return T;
}
function readLibrary() {
  const f = path.join(ROOT, 'src', 'viewer', 'house_tex.js');
  if (!fs.existsSync(f)) return null;
  const src = fs.readFileSync(f, 'utf8'), out = {};
  const re = /(\w+): \{ kind: '(\w+)', name: '([^']*)', tile: ([\d.]+), px: (\d+), metal: ([\d.]+), ribbed: (true|false)/g;
  let m; while ((m = re.exec(src))) out[m[1]] = { kind: m[2], name: m[3], tile: +m[4], px: +m[5], metal: +m[6], ribbed: m[7] === 'true' };
  return Object.keys(out).length ? out : null;
}
// the meteo station's generator: tools/_meteo_gen.js when this checkout has it, else the branch that carries it
function meteoSource(p) {
  for (const f of [p, path.join(TOOLS, '_meteo_gen.js')]) if (f && fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  try { return execFileSync('git', ['show', 'origin/claude/meteo-code:flyDiy/tools/_meteo_gen.js'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; }
}
let GENS = null;
function loadGens(o) {
  if (GENS) return GENS;
  const win = {};
  const ctx = { window: win, THREE: stubTHREE(), console: { log() {}, warn() {}, info() {}, error: console.error }, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const LIB = readLibrary(); if (LIB) ctx.HOUSE_TEX_SETS = LIB;
  for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_sport_gen.js', '_marine_gen.js', '_shed_gen.js', '_hangar_gen.js', '_tower_gen.js', '_navaid_gen.js', '_tram_gen.js', '_totem_gen.js', '_village_gen.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
  const ms = meteoSource(o && o.meteo);
  // (the meteo branch adds HOUSE_GEN.std, the house's own material factory, in the same commit: restated when absent)
  if (ms && !win.HOUSE_GEN.std) vm.runInContext('window.HOUSE_GEN.std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.92, metalness: 0 }, o || {}));', ctx);
  if (ms) vm.runInContext(ms, ctx, { filename: '_meteo_gen.js' });
  GENS = { win, ctx };
  return GENS;
}

// ---- a build as bags: { name, mat, raw } in the building's own frame ----------------------------------------------
function bagsOf(GEN, built, F) {
  const out = [];
  for (const k of (built.BAGS || GEN.BAGS)) {
    const b = built.bags[k], mt = F.MAT[k];
    if (!b || !mt) continue;
    const r = b.raw(); if (!r.idx.length) continue;
    out.push({ name: k, mat: mt, pos: r.pos, idx: r.idx });
  }
  return out;
}
const triArea = (P, a, b, c) => {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
};
const bagArea = b => { let a = 0; for (let i = 0; i < b.idx.length; i += 3) a += triArea(b.pos, b.idx[i], b.idx[i + 1], b.idx[i + 2]); return a; };
const isPlain = m => m.type === 'MeshStandardMaterial' && !m.transparent && !m.emissiveHex && !m.emissiveMap;
const isOpaqueStd = m => !!m.isMeshStandardMaterial && !m.transparent;

// render_premises.js detailOf: what a building WITHOUT a lod 1 (a site item, an outbuilding) sends to the far town
function keepOf(bags, shellMats) {
  const cand = bags.filter(b => isPlain(b.mat)).map(b => [b, bagArea(b)]).sort((a, b) => a[1] - b[1]);
  const total = cand.reduce((t, x) => t + x[1], 0), list = [];
  let acc = 0;
  for (const [b, a] of cand) { if (acc + a > RULE.area * total) break; acc += a; list.push(b); }
  const list2 = cand.slice(0, Math.max(0, cand.length - RULE.keep2)).filter(x => !(shellMats && shellMats.has(x[0].mat) && x[1] >= RULE.keepShare * total)).map(x => x[0]).filter(b => !list.includes(b));
  return cand.map(x => x[0]).filter(b => !list.includes(b) && !list2.includes(b));
}
// render_premises.js lod1Bags: a banded house's far town (every opaque standard bag of lod 1)
const lod1Of = bags => bags.filter(b => isOpaqueStd(b.mat));
// what stays past the far town's detail band (LOD1_SHELL)
const shellOfL1 = bags => bags.filter(b => RULE.shell.test(b.name));
// hlodBoxes: the extent of the box bags, five faces, the top at 85 % (no floor)
function boxOf(bags) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bags) for (let i = 0; i < b.pos.length; i += 3) for (let a = 0; a < 3; a++) { const v = b.pos[i + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  if (!isFinite(lo[0])) return null;
  const top = lo[1] + 0.85 * (hi[1] - lo[1]);
  const BOX_F = [[[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
                 [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]];
  const pos = [], idx = [];
  for (const f of BOX_F) { const b0 = pos.length / 3; for (const s of f) pos.push(s[0] ? hi[0] : lo[0], s[1] ? top : lo[1], s[2] ? hi[2] : lo[2]); idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); }
  return [{ name: 'box', mat: { side: 0 }, pos, idx }];
}
// a soup of [pts, outward normal] polygons (city_cook shellFaces, already oriented) as one bag
function polyBag(name, polys) {
  const pos = [], idx = [];
  for (const pts of polys) { const b0 = pos.length / 3; for (const p of pts) pos.push(p[0], p[1], p[2]); for (let k = 1; k + 1 < pts.length; k++) idx.push(b0, b0 + k, b0 + k + 1); }
  return { name, mat: { side: 0 }, pos, idx };
}

// ---- the measurements -------------------------------------------------------------------------------------------
function soup(bags) {
  let nT = 0; for (const b of bags) nT += b.idx.length / 3;
  const T = new Float64Array(nT * 9), dbl = new Uint8Array(nT), N = new Float64Array(nT * 3);
  let t = 0;
  for (const b of bags) {
    const P = b.pos, d = b.mat && b.mat.side === 2 ? 1 : 0;
    for (let i = 0; i < b.idx.length; i += 3, t++) {
      for (let k = 0; k < 3; k++) { const v = b.idx[i + k] * 3; T[t * 9 + k * 3] = P[v]; T[t * 9 + k * 3 + 1] = P[v + 1]; T[t * 9 + k * 3 + 2] = P[v + 2]; }
      const o = t * 9, ux = T[o + 3] - T[o], uy = T[o + 4] - T[o + 1], uz = T[o + 5] - T[o + 2], vx = T[o + 6] - T[o], vy = T[o + 7] - T[o + 1], vz = T[o + 8] - T[o + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      N[t * 3] = nx / l; N[t * 3 + 1] = ny / l; N[t * 3 + 2] = nz / l; dbl[t] = d;
    }
  }
  return { T, N, dbl, n: nT };
}
function boundsOf(S) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < S.n * 9; i += 3) for (let a = 0; a < 3; a++) { const v = S.T[i + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  return { lo, hi, c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], R: 0.5 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) };
}
const VIEWS = (() => { const v = []; for (const el of [12, 35, 60]) for (let az = 0; az < 360; az += 45) v.push([az + (el === 35 ? 22.5 : 0), el]); v.push([0, 90]); return v; })();
// one orthographic z-buffer: per pixel the nearest surface (any side) and the nearest FRONT surface (the culled draw)
function zbuf(S, B, view, res) {
  const az = view[0] * Math.PI / 180, el = view[1] * Math.PI / 180;
  const d = [-Math.cos(el) * Math.sin(az), -Math.sin(el), -Math.cos(el) * Math.cos(az)];   // the eye looks along d
  let r = Math.abs(d[1]) > 0.99 ? [1, 0, 0] : [d[2], 0, -d[0]]; { const l = Math.hypot(r[0], r[1], r[2]); r = r.map(x => x / l); }
  const u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
  const ext = B.R * 1.05, px = 2 * ext / res, n = res * res;
  const zA = new Float64Array(n).fill(Infinity), fA = new Int8Array(n), tA = new Int32Array(n).fill(-1), zF = new Float64Array(n).fill(Infinity), tF = new Int32Array(n).fill(-1);
  const sx = new Float64Array(3), sy = new Float64Array(3), sz = new Float64Array(3);
  for (let t = 0; t < S.n; t++) {
    const o = t * 9;
    for (let k = 0; k < 3; k++) {
      const x = S.T[o + k * 3] - B.c[0], y = S.T[o + k * 3 + 1] - B.c[1], z = S.T[o + k * 3 + 2] - B.c[2];
      sx[k] = (x * r[0] + y * r[1] + z * r[2] + ext) / px; sy[k] = (x * u[0] + y * u[1] + z * u[2] + ext) / px; sz[k] = x * d[0] + y * d[1] + z * d[2];
    }
    const nd = S.N[t * 3] * d[0] + S.N[t * 3 + 1] * d[1] + S.N[t * 3 + 2] * d[2];
    const front = S.dbl[t] || nd < 0;
    const x0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2]))), x1 = Math.min(res - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2]))), y1 = Math.min(res - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
    const den = (sy[1] - sy[2]) * (sx[0] - sx[2]) + (sx[2] - sx[1]) * (sy[0] - sy[2]);
    if (Math.abs(den) < 1e-12) continue;
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const X = i + 0.5, Y = j + 0.5;
      const a = ((sy[1] - sy[2]) * (X - sx[2]) + (sx[2] - sx[1]) * (Y - sy[2])) / den, b = ((sy[2] - sy[0]) * (X - sx[2]) + (sx[0] - sx[2]) * (Y - sy[2])) / den, c = 1 - a - b;
      if (a < -1e-9 || b < -1e-9 || c < -1e-9) continue;
      const z = a * sz[0] + b * sz[1] + c * sz[2], p = j * res + i;
      if (z < zA[p] - 1e-6) { zA[p] = z; fA[p] = front ? 1 : -1; tA[p] = t; }
      else if (Math.abs(z - zA[p]) <= 1e-6 && front) { fA[p] = 1; tA[p] = t; }     // a coplanar pair (a slab's two skins): the front one wins
      if (front && z < zF[p]) { zF[p] = z; tF[p] = t; }
    }
  }
  return { zA, fA, tA, zF, tF, d, u, r, ext, px };
}
// the views of one rung against the near mesh's
function measure(near, rung, opt) {
  const res = (opt && opt.res) || 112;
  const S0 = soup(near), S1 = soup(rung), B = boundsOf(S0);
  const names = []; for (const b of rung) for (let i = 0; i < b.idx.length; i += 3) names.push(b.name);
  const by = {};
  let cov = 0, leak = 0, inter = 0, uni = 0;
  const per = [];
  let roofN = 0, roofOk = 0, nearN = 0, holeN = 0;
  const holeT = Math.max(1.5, 0.1 * B.R);   // deeper than a porch, a rail, a removed trim
  for (const v of VIEWS) {
    const A = zbuf(S0, B, v, res), Z = zbuf(S1, B, v, res);
    let c = 0, l = 0;
    for (let p = 0; p < res * res; p++) {
      const a = A.zA[p] < Infinity, z = Z.zA[p] < Infinity;
      if (a || z) uni++; if (a && z) inter++;
      if (z) { c++; if (Z.fA[p] < 0) { l++; const k = names[Z.tA[p]]; by[k] = (by[k] || 0) + 1; } }
      // a HOLE: where the near mesh shows its outside, the rung shows something more than HOLE_T behind it (the far
      // wall's inner face through an opening, the floor of a roofless box, the sky through a missing storey)
      if (A.tF[p] >= 0) { nearN++; if (Z.tF[p] < 0 ? (Z.zA[p] === Infinity ? false : true) : Z.zF[p] - A.zF[p] > holeT) holeN++; }
    }
    cov += c; leak += l; per.push([v[0], v[1], c ? l / c : 0]);
    if (v[1] === 90) {
      // the roof, from straight above: heights over the near mesh's base
      const base = B.lo[1];
      for (let p = 0; p < res * res; p++) {
        if (A.tF[p] < 0) continue;
        const h0 = -(A.zF[p]) + B.c[1] - base;           // looking down: depth = -(y - c.y)
        if (h0 < 1.5) continue;
        roofN++;
        const t = Z.tF[p];
        if (t < 0 || Z.fA[p] < 0) continue;              // nothing, or the eye is inside
        const h1 = -(Z.zF[p]) + B.c[1] - base;
        if (S1.N[t * 3 + 1] > 0.2 && h1 >= 0.6 * h0) roofOk++;
      }
    }
  }
  for (const k in by) by[k] = +(by[k] / Math.max(1, cov)).toFixed(4);
  return { tris: S1.n, leakBy: by, hole: nearN ? holeN / nearN : 0, leak: cov ? leak / cov : 0, worst: per.reduce((w, x) => (x[2] > w[2] ? x : w), [0, 0, 0]), roof: roofN ? roofOk / roofN : 1, iou: uni ? inter / uni : 1, R: B.R };
}
// welded edges used once (a closed volume has none): their total length, and per bag
function openEdges(bags) {
  let L = 0; const per = {};
  for (const b of bags) {
    const key = i => Math.round(b.pos[i * 3] * 1000) + ',' + Math.round(b.pos[i * 3 + 1] * 1000) + ',' + Math.round(b.pos[i * 3 + 2] * 1000);
    const id = new Map(), vid = new Int32Array(b.pos.length / 3);
    for (let i = 0; i < vid.length; i++) { const k = key(i); let v = id.get(k); if (v === undefined) id.set(k, v = id.size); vid[i] = v; }
    const E = new Map();
    for (let i = 0; i < b.idx.length; i += 3) for (let k = 0; k < 3; k++) {
      const a = vid[b.idx[i + k]], c = vid[b.idx[i + (k + 1) % 3]]; if (a === c) continue;
      const e = a < c ? a + ':' + c : c + ':' + a; const q = E.get(e); if (q) q[0]++; else E.set(e, [1, b.idx[i + k], b.idx[i + (k + 1) % 3]]);
    }
    let l = 0;
    for (const [, q] of E) if (q[0] === 1) { const a = q[1] * 3, c = q[2] * 3; l += Math.hypot(b.pos[a] - b.pos[c], b.pos[a + 1] - b.pos[c + 1], b.pos[a + 2] - b.pos[c + 2]); }
    if (l > 0.01) per[b.name] = +(l + (per[b.name] || 0)).toFixed(1);
    L += l;
  }
  return { len: L, per };
}

// ---- one building: its rungs as the game draws them -------------------------------------------------------------
// THE DETAIL ROLES (the plan's S4): each generator says what LEAVES at the detail band - the trims, rails, posts, signs:
// what is sub-pixel there - and everything else of its lod 1 stays (so a lighthouse keeps its lantern, an over-the-water
// house its deck). OPEN: not a closed volume (a pier, a breakwater, a pitch, a park): no closure rows, its lod 1 whole.
const DETAIL_OF = {
  HOUSE_GEN: /^(trim|rib|post|pile|logend|flag|star|awning|pane)/, SHED_GEN: /^(trim|rib|post|pile|logend|pane)/,
  BIG_GEN: /^(sign|awning|trim|beam|metal)$/, HANGAR_GEN: /^(metal|beam|trim)$/,
  METEO_GEN: /^(steel|rail|flue|paint|trim|post|metal)$/, TOWER_GEN: /^(trim|sock)$/, NAVAID_GEN: /^(trim|sock)$/,
};
const OPEN = new Set(['MARINE_GEN', 'SPORT_GEN', 'TOTEM_GEN']);
const genName = GEN => Object.keys(GENS.win).find(k => GENS.win[k] === GEN) || '';
const shellFor = (GEN, bags) => { const re = DETAIL_OF[genName(GEN)]; return re ? bags.filter(b => !re.test(b.name)) : bags; };
// path 'item'  a site's item (premises_build genItem: lod 0 only): far = detailOf's keep of lod 0, box past far2
// path 'plot'  a sampled plot's house (genHouse: lod 0 + lod 1, banded): far = lod 1 on the town shader, its detail
//              leaving at the second band (the shells stay); no box (hlodFarTarr takes every bag)
// path 'out'   an outbuilding (genDress: lod 1 only, no userData.lod1): far = detailOf's keep of ITS lod 1, box
// what the game keeps past the detail band of a lod 1: every bag but its generator's LOD_DETAIL roles (since LODS-2026-10
// step 1; before, the house's LOD1_SHELL list - read off the page while it stands)
const gameShells = (GEN, L1) => (RULE.shell ? L1.filter(b => RULE.shell.test(b.name)) : GEN.LOD_DETAIL ? L1.filter(b => !GEN.LOD_DETAIL.test(b.name)) : L1);
// THE GAME'S RUNGS, as its code stands (the ratchet's ids are stable across the steps: `far`, `coarsest`):
//   banded (a plot's house; a site item and an outbuilding from step 1): far = its lod 1, coarsest = what stays past the
//   detail band; not banded (an item before step 1, an outbuilding's old keep): far = detailOf's keep, coarsest = the box
// plus the FIX rungs (the plan's target, --fix): its own lod 1, and that less the plan's detail roles
function rungsOf(GEN, P, pathKind) {
  const F = GEN.makeFinish(); GEN.applyFinish(P, F);
  const shellMats = new Set(); const HL = GENS.win.HANGAR_GEN && GENS.win.HANGAR_GEN.LIB;
  if (HL) for (const s of Object.keys(HL)) for (const k of Object.keys(HL[s])) shellMats.add(HL[s][k]);
  const b0 = bagsOf(GEN, GEN.build(P, 0, F), F);
  if (pathKind === 'plot') {
    const b1 = bagsOf(GEN, GEN.build(P, 1, F), F), L1 = lod1Of(b1);
    return { near: b0, rungs: [['far (lod 1)', L1, 'edge', 'both'], ['coarsest (lod 1 past the detail band)', gameShells(GEN, L1), 'detail'], ['FIX R2: its lod 1 shells', shellFor(GEN, L1), 'detail', 'fix']] };   // (a plot is on the fix's path already; its R2 takes the declared detail roles)
  }
  const src = pathKind === 'out' ? bagsOf(GEN, GEN.build(P, 1, F), F) : b0;
  const keep = keepOf(src, shellMats);
  const banded = pathKind === 'out' ? RULE.outBanded : RULE.itemBanded;
  const r = [];
  if (banded) {
    const L1 = pathKind === 'out' ? lod1Of(src) : lod1Of(bagsOf(GEN, GEN.build(P, 1, F), F));
    r.push(['far (lod 1)', L1, 'edge'], ['coarsest (lod 1 past the detail band)', gameShells(GEN, L1), 'detail']);
  } else {
    r.push(['far (' + (pathKind === 'out' ? 'lod 1' : 'lod 0') + ' keep ' + keep.map(b => b.name).join('+') + ')', keep, 'near']);
    const bx = RULE.boxes ? boxOf(keep) : null; if (bx) r.push(['coarsest (box past far2)', bx, 'far2']);
  }
  // THE FIX (LODS-2026-10 S2-S4): its own lod 1 whole on its finish, then its shells (an outbuilding: its near IS lod 1)
  const l1 = pathKind === 'out' ? lod1Of(src) : lod1Of(bagsOf(GEN, GEN.build(P, 1, F), F));
  r.push(['FIX R1: its lod 1', l1, 'edge', 'fix'], ['FIX R2: its lod 1 shells', shellFor(GEN, l1), 'detail', 'fix']);
  return { near: pathKind === 'out' ? src : b0, rungs: r, keep: keep.map(b => b.name), plainBags: src.filter(b => isPlain(b.mat)).map(b => b.name) };
}
function audit(GEN, P, pathKind, opt) {
  const R = rungsOf(GEN, P, pathKind);
  const nearTris = R.near.reduce((t, b) => t + b.idx.length / 3, 0);
  const n0 = measure(R.near, R.near, opt);
  const out = { path: pathKind, nearTris, R: n0.R, nearLeak: n0.leak, nearRoof: n0.roof, keep: R.keep || null, rungs: [] };
  for (const [name, bags, at, fix] of R.rungs) {
    const m = measure(R.near, bags, opt), oe = openEdges(bags);
    const dist = at === 'edge' ? edgeOf(n0.R) : at === 'detail' ? detailEdgeOf(n0.R) : at === 'far2' ? RULE.far2 : RULE.near;
    out.rungs.push({ name, fix: !!fix, dist: Math.round(dist), tris: m.tris, leak: m.leak, hole: m.hole, leakBy: m.leakBy, worst: m.worst, roof: m.roof, iou: m.iou, open: oe.len, openPer: oe.per,
                     hasRoofBag: bags.some(b => /roof/.test(b.name) || b.name === 'box' || b.name === 'shell'), bags: bags.map(b => b.name) });
  }
  return out;
}

module.exports = { DETAIL_OF, OPEN, shellFor, genName, RULE, F1080, edgeOf, detailEdgeOf, loadGens, bagsOf, keepOf, lod1Of, shellOfL1, boxOf, polyBag, soup, measure, openEdges, rungsOf, audit, VIEWS, isPlain };
