#!/usr/bin/env node
// infra_gen.js - THE INFRASTRUCTURE KIT: the high-voltage pylons (ASSETS-OCT G3140, 2026-10-13; the user: "could you
// also model (or take from the substation set) pillars for electricity, like the major large ones please? And make
// them usable assets under an INFRASTRUCTURE category.").
//
// WHY PROCEDURAL. The bank's "Substation" (One80 Solar, CC BY 4.0, 45 MB) is ONE merged OBJ - 24 spatial chunks, one
// material, ~650 k triangles - and its tall frames are a yard's bus gantries, not line towers; no CC0 pylon is in the
// bank and nothing is downloaded without the user's OK. A lattice tower IS a list of straight members, so it is
// written here as one: exact dimensions, every level cut from the same list (no decimator, no bake), no licence, no
// map at all (flat galvanised steel, porcelain, timber and concrete records - nothing for KTX2 to do).
//
// THE SET (group 'infra', "infrastructure" in the editor's prop list; src/infra/infra_pylon.js, lazy like the
// scenery kit's packs):
//   pylon_suspension  a double-circuit lattice tower on a straight run, ~44 m: three crossarms a side (the middle one
//                     longest, the "barrel" outline), the conductors on hanging insulator strings, an earth-wire peak
//   pylon_tall        the same with a 9 m body extension (the usual way a line crosses water or a valley)
//   pylon_tension     angle / section tower: a wider, heavier body, shorter arms, the strings STRAINED along the
//                     line both ways with a jumper loop under each arm; rated to 30 deg of line angle
//   pylon_terminal    the line's end into a substation: the tension tower's body, the strings on the line side only
//   pylon_hframe      the WOODEN 115 kV H-FRAME - two poles, a double crossarm, an X brace, three suspension strings
//                     and two shield wires on the pole tops: what Annette Island and Ketchikan's lines mostly are (A0)
//
// THE LEVELS (prop_lod.js's convention: props of their own, `lodOf` + `lodDist`, group 'lod', in the same pack -
// totem_lod.js's layout): L1 keeps the legs, the struts, ONE diagonal a panel and the arms' chords (~a third);
// L2 is the outline - the legs in two straight runs, one X a body face, a member an arm, no insulator. props.js adds
// the empty level past a pixel and a half. No alpha card: prop materials carry no alphaTest, and a ~200-triangle
// outline costs less than teaching them one.
//
// THE ATTACH POINTS (for a future line tool; powerline.js already strings catenaries through TRAM_RUN.ropeCurve):
// every prop carries `attach` - [{ id, kind: 'phase'|'earth', circuit, phase, p: [x, y, z], type: 'suspension'|
// 'strain', side: 'both'|'back'|'ahead' }] in the prop frame (x across the line, y up, z ALONG the line: 'ahead' is
// +z) - and `line` - { volts, maxAngle (deg), span: [typical min, max] m, dir: '+z' }. A suspension point takes the
// conductor from both sides; a strain end takes it from its own side only.
//
// Usage: node tools/infra_gen.js             (write src/infra/ + media/geo/infra/)
//        node tools/infra_gen.js --report    (build, print, write nothing)
//        node tools/infra_gen.js --check     (build, compare with what is on disk; exit 1 when stale - GATE INFRA)
'use strict';
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL, mediaRel } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'infra');
const OUT = path.join(OUT_DIR, 'infra_pylon.js');
const MANIFEST = path.join(OUT_DIR, 'infra_packs.json');
const GEO = 'geo/infra';

// ---- the materials: flat records, no maps (props.js propMaterial) ---------------------------------------------------
const MATS = {
  infra_steel:    { col: [0.56, 0.58, 0.57], rough: 0.55, metal: 0.35, ao: 0, opacity: 1, dbl: 0 },   // weathered galvanising
  infra_porcelain: { col: [0.30, 0.37, 0.35], rough: 0.20, metal: 0, ao: 0, opacity: 1, dbl: 0 },     // toughened glass discs
  infra_wire:     { col: [0.22, 0.22, 0.21], rough: 0.45, metal: 0.4, ao: 0, opacity: 1, dbl: 0 },    // the jumper loops
  infra_concrete: { col: [0.60, 0.59, 0.56], rough: 0.90, metal: 0, ao: 0, opacity: 1, dbl: 0 },      // the leg footings
  infra_timber:   { col: [0.33, 0.25, 0.18], rough: 0.85, metal: 0, ao: 0, opacity: 1, dbl: 0 },      // creosoted fir
};

// ---- vector bits ----------------------------------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.sqrt(dot(a, a));
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const frame = d => { const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const u = norm(cross(d, ref)); return [u, cross(d, u)]; };

// ---- the mesh: per material, flat or smooth, float positions until the pack -----------------------------------------
function Mesh() { this.m = new Map(); }
Mesh.prototype.of = function (mat) { let g = this.m.get(mat); if (!g) this.m.set(mat, g = { pos: [], nrm: [], idx: [] }); return g; };
Mesh.prototype.vert = function (g, p, n) { g.pos.push(p[0], p[1], p[2]); g.nrm.push(n[0], n[1], n[2]); return g.pos.length / 3 - 1; };
Mesh.prototype.quad = function (mat, a, b, c, d) {          // a flat quad a-b-c-d, counter-clockwise from outside
  const g = this.of(mat), n = norm(cross(sub(b, a), sub(d, a)));
  const i = this.vert(g, a, n), j = this.vert(g, b, n), k = this.vert(g, c, n), l = this.vert(g, d, n);
  g.idx.push(i, j, k, i, k, l);
};
Mesh.prototype.tris = function () { let t = 0; for (const g of this.m.values()) t += g.idx.length / 3; return t; };
// a MEMBER: a square prism a -> b, side w, no caps (a member always ends inside another or the ground); `twist`
// turns the section (a leg's faces follow the tower's faces, not the world's axes)
Mesh.prototype.member = function (mat, a, b, w, twist) {
  const d = norm(sub(b, a));
  let [u, v] = frame(d);
  if (twist) { const c = Math.cos(twist), s = Math.sin(twist); [u, v] = [add(mul(u, c), mul(v, s)), add(mul(u, -s), mul(v, c))]; }
  const h = w / 2, C = [add(mul(u, h), mul(v, h)), add(mul(u, -h), mul(v, h)), add(mul(u, -h), mul(v, -h)), add(mul(u, h), mul(v, -h))];
  for (let k = 0; k < 4; k++) {
    const c0 = C[k], c1 = C[(k + 1) % 4];
    this.quad(mat, add(a, c0), add(a, c1), add(b, c1), add(b, c0));
  }
};
// a BOX between two corners (axis-aligned): the footings, the timbers
Mesh.prototype.box = function (mat, lo, hi, noBottom) {
  const [x0, y0, z0] = lo, [x1, y1, z1] = hi;
  const P = (x, y, z) => [x, y, z];
  this.quad(mat, P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1));   // +x
  this.quad(mat, P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), P(x0, y0, z0));   // -x
  this.quad(mat, P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0));   // +y
  if (!noBottom) this.quad(mat, P(x0, y0, z1), P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1));   // -y
  this.quad(mat, P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1));   // +z
  this.quad(mat, P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0));   // -z
};
// a LATHE along a -> b: `prof` = [[t 0..1, r], ...], `sides` around, smooth normals (an insulator string, a pole)
Mesh.prototype.lathe = function (mat, a, b, prof, sides) {
  const g = this.of(mat), ax = sub(b, a), L = len(ax), d = norm(ax), [u, v] = frame(d);
  const rings = [];
  for (let i = 0; i < prof.length; i++) {
    const [t, r] = prof[i];
    // the profile's slope tilts the normal: dr/ds along the axis
    const j0 = Math.max(0, i - 1), j1 = Math.min(prof.length - 1, i + 1);
    const ds = (prof[j1][0] - prof[j0][0]) * L || 1e-6, dr = prof[j1][1] - prof[j0][1];
    const ring = [], c = lerp(a, b, t);
    for (let k = 0; k < sides; k++) {
      const th = 2 * Math.PI * k / sides, rad = add(mul(u, Math.cos(th)), mul(v, Math.sin(th)));
      ring.push(this.vert(g, add(c, mul(rad, r)), norm(add(rad, mul(d, -dr / ds)))));
    }
    rings.push(ring);
  }
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides, A = rings[i][k], B = rings[i][k1], Cc = rings[i + 1][k1], D = rings[i + 1][k];
    g.idx.push(A, B, Cc, A, Cc, D);
  }
};
// a polyline TUBE (the jumper loop): a member per segment, `sides` 4
Mesh.prototype.polyline = function (mat, pts, w) { for (let i = 0; i + 1 < pts.length; i++) this.member(mat, pts[i], pts[i + 1], w); };

// ---- the insulator string: a disc stack as one lathe ----------------------------------------------------------------
// a cap-and-pin string of n discs (a 254 mm disc at 146 mm pitch; 115 kV ~8, 230 kV ~14-16) as one lathe. Level 1: a plain
// 4-sided rod.
function insulator(M, a, b, n, lv) {
  if (lv >= 1) { M.member('infra_porcelain', a, b, 0.16); return; }
  // a swell every three discs (at a tower's scale a run of rims reads as one): 5 sides, two rings a swell
  const sw = Math.ceil(n / 3), prof = [[0, 0.05]];
  for (let i = 0; i < sw; i++) prof.push([(i + 0.2) / sw, 0.05], [(i + 0.6) / sw, 0.13]);
  prof.push([1, 0.05]);
  M.lathe('infra_porcelain', a, b, prof, 5);
}

// ---- THE LATTICE TOWERS ---------------------------------------------------------------------------------------------
// P: the dimensions (metres). The body tapers from `b0` (half-width at the ground) to `bw` at the waist `yw`, then
// stands straight (the cage) to `yt`; arms at `arms` = [[y, reach from the cage face], ...] on both sides (x); the
// earth peak to `yp`. Sizes `wLeg` (legs), `wBr` (bracing), `wArm` (arm chords). `mode` 'suspension' | 'strain'.
// `sides` 'both' | 'ahead' (the terminal's strings on +z only).
const LATTICE = {
  suspension: { b0: 4.0, bw: 1.0, yw: 26, yt: 39.6, yp: 44.2, arms: [[27.2, 5.2], [32.6, 6.6], [38.0, 5.2]],
                wLeg: 0.22, wBr: 0.10, wArm: 0.14, mode: 'suspension', sides: 'both', discs: 15, kv: 230,
                maxAngle: 2, span: [300, 420], panels: 6,
                label: 'lattice pylon - suspension (double circuit, 230 kV)' },
  tall:       { b0: 4.0, bw: 1.0, yw: 26, yt: 39.6, yp: 44.2, arms: [[27.2, 5.2], [32.6, 6.6], [38.0, 5.2]], ext: 9,
                wLeg: 0.24, wBr: 0.10, wArm: 0.14, mode: 'suspension', sides: 'both', discs: 15, kv: 230,
                maxAngle: 2, span: [350, 550], panels: 6,
                label: 'lattice pylon - tall suspension, +9 m body (double circuit, 230 kV)' },
  tension:    { b0: 5.0, bw: 1.3, yw: 24, yt: 37.4, yp: 41.4, arms: [[25.0, 4.4], [30.4, 5.4], [35.8, 4.4]],
                wLeg: 0.30, wBr: 0.13, wArm: 0.18, mode: 'strain', sides: 'both', discs: 16, kv: 230,
                maxAngle: 30, span: [250, 400], panels: 6,
                label: 'lattice pylon - tension / angle to 30 deg (double circuit, 230 kV)' },
  terminal:   { b0: 5.4, bw: 1.4, yw: 24, yt: 37.4, yp: 41.4, arms: [[25.0, 4.4], [30.4, 5.4], [35.8, 4.4]],
                wLeg: 0.34, wBr: 0.14, wArm: 0.18, mode: 'strain', sides: 'ahead', discs: 16, kv: 230,
                maxAngle: 45, span: [80, 400], panels: 6,
                label: 'lattice pylon - terminal / dead-end (double circuit, 230 kV)' },
};

// the panel levels of the tapered body: taller at the bottom (a real tower's bracing is closer near the waist)
function bodyLevels(P) {
  const yw = P.yw + (P.ext || 0), n = P.panels + (P.ext ? 2 : 0), out = [0.3];
  // geometric: each panel 0.82 of the one below
  const r = 0.82, h0 = (yw - 0.3) * (1 - r) / (1 - Math.pow(r, n));
  let y = 0.3, h = h0;
  for (let i = 0; i < n; i++) { y += h; out.push(i === n - 1 ? yw : y); h *= r; }
  return out;
}
function lattice(name, lv) {
  const P = LATTICE[name], M = new Mesh();
  const ext = P.ext || 0, yw = P.yw + ext, yt = P.yt + ext, yp = P.yp + ext;
  // the leg slope continues below the original foot when the body is extended
  const slope = (P.b0 - P.bw) / P.yw, b0 = P.bw + slope * yw;
  const half = y => (y >= yw ? P.bw : P.bw + slope * (yw - y));
  const C = (y, sx, sz) => { const h = half(y); return [sx * h, y, sz * h]; };
  const CORN = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const armY = P.arms.map(a => a[0] + ext);
  // the levels the cage is braced at: the waist, each arm's bottom and top chord root, the cage top
  const cage = [yw];
  for (const y of armY) { if (y - 1e-3 > cage[cage.length - 1]) cage.push(y); cage.push(Math.min(yt, y + 1.6)); }
  if (yt - 1e-3 > cage[cage.length - 1]) cage.push(yt);
  const body = bodyLevels(P);
  const levels = body.concat(cage.filter(y => y > yw + 1e-3));
  // ---- the footings: a concrete muff round each leg, 1.5 m into the ground (a slope's low side shows it)
  if (lv < 2) for (const [sx, sz] of CORN) {
    const c = C(0, sx, sz), f = 0.55;
    M.box('infra_concrete', [c[0] - f, -1.5, c[2] - f], [c[0] + f, 0.3, c[2] + f], true);
  }
  // ---- the legs: the four corner members, panel by panel (L2: two straight runs)
  const legYs = lv >= 2 ? [-1.5, yw, yt] : [-1.5].concat(levels.slice(1));
  for (const [sx, sz] of CORN) for (let i = 0; i + 1 < legYs.length; i++)
    M.member('infra_steel', C(legYs[i], sx, sz), C(legYs[i + 1], sx, sz), P.wLeg * (lv >= 2 ? 1.6 : 1), Math.PI / 4);
  // ---- the faces: struts at every level, X bracing (L1: one diagonal, alternating; L2: one X over the body)
  const faces = [[0, 1], [1, 2], [2, 3], [3, 0]];
  for (const [fa, fb] of faces) {
    const A = CORN[fa], B = CORN[fb];
    if (lv >= 2) {
      M.member('infra_steel', C(0.3, A[0], A[1]), C(yw, B[0], B[1]), P.wBr * 2.2);
      M.member('infra_steel', C(0.3, B[0], B[1]), C(yw, A[0], A[1]), P.wBr * 2.2);
      continue;
    }
    for (let i = 0; i + 1 < levels.length; i++) {
      const y0 = levels[i], y1 = levels[i + 1];
      if (i > 0) M.member('infra_steel', C(y0, A[0], A[1]), C(y0, B[0], B[1]), P.wBr);
      if (lv === 0 || i % 2 === 0) M.member('infra_steel', C(y0, A[0], A[1]), C(y1, B[0], B[1]), P.wBr);
      if (lv === 0 || i % 2 === 1) M.member('infra_steel', C(y0, B[0], B[1]), C(y1, A[0], A[1]), P.wBr);
    }
    M.member('infra_steel', C(yt, A[0], A[1]), C(yt, B[0], B[1]), P.wBr);
  }
  // ---- the plan bracing at the waist (the diaphragm the eye sees from below)
  if (lv === 0) { M.member('infra_steel', C(yw, 1, 1), C(yw, -1, -1), P.wBr); M.member('infra_steel', C(yw, -1, 1), C(yw, 1, -1), P.wBr); }
  // ---- the earth peak: four members to the apex (L2: one)
  const apex = [0, yp, 0];
  if (lv >= 2) M.member('infra_steel', [0, yt, 0], apex, P.wLeg * 1.6);
  else for (const [sx, sz] of CORN) M.member('infra_steel', C(yt, sx, sz), apex, P.wBr * 1.3);
  if (lv === 0) M.member('infra_steel', [-0.35, yp - 0.15, 0], [0.35, yp - 0.15, 0], P.wBr);   // the earth-wire bracket
  // ---- the arms, both sides
  const attach = [], strain = P.mode === 'strain';
  P.arms.forEach(([ya0, reach], ai) => {
    const ya = ya0 + ext, bw = P.bw, hTop = 1.6;
    for (const sx of [1, -1]) {
      const tipX = sx * (bw + reach), tip = z => [tipX, ya, z];
      const zt = 0.25;
      if (lv >= 2) { M.member('infra_steel', [sx * bw, ya + 0.4, 0], tip(0), 0.45); }
      else {
        // the bottom chords from the cage's two corners on this face to the tip, the top chords from higher up
        for (const sz of [1, -1]) {
          M.member('infra_steel', [sx * bw, ya, sz * bw], tip(sz * zt), P.wArm);
          M.member('infra_steel', [sx * bw, ya + hTop, sz * bw * 0.6], tip(sz * zt), P.wArm);
        }
        M.member('infra_steel', tip(zt), tip(-zt), P.wArm);
        if (lv === 0) {
          // the lacing: a zigzag in the bottom plane and on each side face, three stations along the reach
          const st = [0.3, 0.6, 0.85].map(t => t);
          const bot = (t, sz) => lerp([sx * bw, ya, sz * bw], tip(sz * zt), t);
          const topc = (t, sz) => lerp([sx * bw, ya + hTop, sz * bw * 0.6], tip(sz * zt), t);
          let prev = [bot(0, 1), bot(0, -1)];
          st.forEach((t, k) => {
            const cur = [bot(t, 1), bot(t, -1)];
            M.member('infra_steel', prev[k % 2], cur[(k + 1) % 2], P.wBr * 0.8);
            M.member('infra_steel', cur[0], cur[1], P.wBr * 0.8);
            for (const sz of [1, -1]) M.member('infra_steel', bot(t, sz), topc(k === 0 ? 0 : st[k - 1], sz), P.wBr * 0.8);
            prev = cur;
          });
        }
      }
      // ---- the insulators and the attach points
      const circuit = sx > 0 ? 'A' : 'B', phase = ai + 1, id = circuit + phase;
      if (!strain) {
        const top = [tipX, ya - 0.05, 0], bot = [tipX, ya - 0.05 - P.discs * 0.146, 0];
        if (lv < 2) insulator(M, top, bot, P.discs, lv);
        attach.push({ id, kind: 'phase', circuit, phase, p: r3([tipX, bot[1] - 0.25, 0]), type: 'suspension', side: 'both' });
      } else {
        const ends = P.sides === 'ahead' ? [1] : [1, -1];
        const Ls = P.discs * 0.146 + 0.6;   // the string + its hardware
        const endsP = [];
        for (const sz of ends) {
          const a = [tipX, ya - 0.1, sz * zt], b = [tipX, ya - 0.45, sz * (zt + Ls)];
          if (lv < 2) insulator(M, a, b, P.discs, lv);
          const e = [tipX, ya - 0.5, sz * (zt + Ls + 0.3)];
          endsP.push(e);
          attach.push({ id: id + (sz > 0 ? 'a' : 'b'), kind: 'phase', circuit, phase, p: r3(e), type: 'strain', side: sz > 0 ? 'ahead' : 'back' });
        }
        // the JUMPER: the loop that carries the conductor under the arm from one string's end to the other
        if (lv < 2 && endsP.length === 2) {
          const [e0, e1] = endsP, pts = [];
          const n = lv === 0 ? 5 : 3;
          for (let k = 0; k <= n; k++) { const t = k / n; const p = lerp(e0, e1, t); p[1] -= 2.2 * 4 * t * (1 - t); pts.push(p); }
          M.polyline('infra_wire', pts, 0.06);
        }
      }
    }
  });
  // the earth wire: one peak, suspended (both sides) on a suspension tower, strained both ways on the others
  if (!strain) attach.push({ id: 'E', kind: 'earth', circuit: null, phase: 0, p: r3([0, yp - 0.15, 0]), type: 'suspension', side: 'both' });
  else for (const sz of (P.sides === 'ahead' ? [1] : [1, -1]))
    attach.push({ id: 'E' + (sz > 0 ? 'a' : 'b'), kind: 'earth', circuit: null, phase: 0, p: r3([0, yp - 0.15, sz * 0.4]), type: 'strain', side: sz > 0 ? 'ahead' : 'back' });
  return { M, attach, line: { kv: P.kv, maxAngle: P.maxAngle, span: P.span, dir: '+z' }, label: P.label, b0, h: yp };
}
const r3 = p => p.map(v => +v.toFixed(3));

// ---- THE WOODEN H-FRAME (115 kV) ------------------------------------------------------------------------------------
// Two Douglas-fir poles 4.6 m apart, 18 m above the ground (2.4 m set in it), a double crossarm 8.6 m long at 15.6 m,
// an X brace between the poles under it, three suspension strings (8 discs, 115 kV) 3.8 m apart, a shield wire on each
// pole top. Level 1 from 100 m (four-sided poles, plain strings), level 2 the outline from 350 m.
const HF = { sep: 4.6, h: 18.0, bury: 2.4, r0: 0.19, r1: 0.14, armY: 15.6, armL: 8.6, ph: 3.8, discs: 8, kv: 115,
             maxAngle: 4, span: [180, 260], label: 'wooden H-frame - suspension (115 kV)' };
function hframe(lv) {
  const P = HF, M = new Mesh(), hx = P.sep / 2;
  // the poles
  for (const sx of [1, -1]) {
    const a = [sx * hx, -P.bury, 0], b = [sx * hx, P.h, 0];
    if (lv === 0) M.lathe('infra_timber', a, b, [[0, P.r0 + 0.02], [0.15, P.r0], [1, P.r1]], 8);
    else M.member('infra_timber', a, b, (P.r0 + P.r1) * (lv >= 2 ? 1.3 : 1.0), Math.PI / 4);
  }
  // the double crossarm (L2: one timber)
  const zs = lv >= 2 ? [0] : [0.24, -0.24];
  for (const z of zs) M.box('infra_timber', [-P.armL / 2, P.armY - 0.14, z - 0.06], [P.armL / 2, P.armY + 0.14, z + 0.06]);
  // the X brace between the poles, on the -z face; the knee braces from the poles to the arm ends (L0 only)
  const zb = -(P.r0 + 0.05);
  M.member('infra_timber', [hx, P.armY - 0.8, zb], [-hx, P.armY - 6.2, zb], lv >= 2 ? 0.2 : 0.12);
  M.member('infra_timber', [-hx, P.armY - 0.8, zb], [hx, P.armY - 6.2, zb], lv >= 2 ? 0.2 : 0.12);
  if (lv === 0) for (const sx of [1, -1]) for (const z of zs)
    M.member('infra_timber', [sx * hx, P.armY - 1.6, z], [sx * (hx + 1.5), P.armY - 0.14, z], 0.08);
  // the strings + the attach points
  const attach = [];
  [-P.ph, 0, P.ph].forEach((x, i) => {
    const top = [x, P.armY - 0.14, 0], bot = [x, P.armY - 0.14 - P.discs * 0.146, 0];
    if (lv < 2) insulator(M, top, bot, P.discs, lv);
    attach.push({ id: 'A' + (i + 1), kind: 'phase', circuit: 'A', phase: i + 1, p: r3([x, bot[1] - 0.2, 0]), type: 'suspension', side: 'both' });
  });
  for (const sx of [1, -1]) {
    if (lv === 0) M.member('infra_steel', [sx * hx, P.h - 0.1, 0], [sx * hx, P.h + 0.35, 0], 0.06);   // the shield-wire peak
    attach.push({ id: 'E' + (sx > 0 ? 'a' : 'b'), kind: 'earth', circuit: null, phase: 0, p: r3([sx * hx, P.h + 0.35, 0]), type: 'suspension', side: 'both' });
  }
  return { M, attach, line: { kv: P.kv, maxAngle: P.maxAngle, span: P.span, dir: '+z' }, label: P.label, b0: hx + P.r0, h: P.h + 0.35 };
}

// ---- THE SHEET: the props, their levels (metres past which each stands in) ------------------------------------------
const SHEET = [
  { key: 'pylon_suspension', build: lv => lattice('suspension', lv), levels: [150, 600] },
  { key: 'pylon_tall',       build: lv => lattice('tall', lv),       levels: [150, 600] },
  { key: 'pylon_tension',    build: lv => lattice('tension', lv),    levels: [150, 600] },
  { key: 'pylon_terminal',   build: lv => lattice('terminal', lv),   levels: [150, 600] },
  { key: 'pylon_hframe',     build: lv => hframe(lv),                levels: [100, 350] },
];
// the budgets GATE INFRA holds every level to (triangles)
const BUDGET = { lattice: [5000, 2000, 320], hframe: [900, 300, 120] };

// ---- into the pack's layout (51_prop_codec.js): int16 positions over the prop's bb, int8 normals, uv 0 ------------
function bbOf(meshes) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const M of meshes) for (const g of M.m.values()) for (let i = 0; i < g.pos.length; i += 3)
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], g.pos[i + k]); hi[k] = Math.max(hi[k], g.pos[i + k]); }
  // a hair of margin so the quantiser's ends are inside
  return lo.map(v => +(v - 0.005).toFixed(4)).concat(hi.map(v => +(v + 0.005).toFixed(4)));
}
function packMesh(M, bb) {
  const parts = [], q = (v, k) => {
    const s = (v - bb[k]) / (bb[k + 3] - bb[k]);
    return Math.max(-32768, Math.min(32767, Math.round(s * 65535) - 32768));
  };
  for (const mat of [...M.m.keys()].sort()) {
    const g = M.m.get(mat), nv = g.pos.length / 3, nt = g.idx.length / 3;
    if (nv > 65534) throw new Error('infra_gen: ' + mat + ' has ' + nv + ' vertices (a part is <= 65 534)');
    const buf = Buffer.alloc(8 + nv * 6 + nv * 3 + nv * 4 + nt * 6);
    let o = 8;
    buf.writeUInt32LE(nv, 0); buf.writeUInt32LE(nt, 4);
    for (let i = 0; i < nv; i++, o += 6) for (let k = 0; k < 3; k++) buf.writeInt16LE(q(g.pos[i * 3 + k], k), o + k * 2);
    for (let i = 0; i < nv * 3; i++, o++) buf.writeInt8(Math.max(-127, Math.min(127, Math.round(g.nrm[i] * 127))), o);
    o += nv * 4;                                   // uv: zero (no map)
    for (let i = 0; i < nt * 3; i++, o += 2) buf.writeUInt16LE(g.idx[i], o);
    parts.push({ mat, nv, nt, uvMin: [0, 0], uvScl: [1, 1], bytes: buf });
  }
  return parts;
}

// ---- build everything (no writes) ------------------------------------------------------------------------------------
function buildAll() {
  const props = {}, order = [], bins = [];
  for (const row of SHEET) {
    const L = [0, 1, 2].map(lv => row.build(lv));
    const bb = bbOf(L.map(x => x.M));
    const dim = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map(v => +v.toFixed(3));
    L.forEach((x, lv) => {
      const key = lv === 0 ? row.key : row.key + '_l' + lv;
      const parts = packMesh(x.M, bb);
      const used = {};
      for (const p of parts) used[p.mat] = Object.assign({}, MATS[p.mat]);
      const rec = { key, group: lv === 0 ? 'infra' : 'lod', label: lv === 0 ? x.label : x.label + ', LOD ' + lv,
                    place: 'level', bb, dim, nv: parts.reduce((s, p) => s + p.nv, 0), nt: parts.reduce((s, p) => s + p.nt, 0),
                    src: { title: 'procedural (tools/infra_gen.js)', author: 'flyDiy', lic: 'own' }, mats: used, parts };
      if (lv === 0) {
        rec.note = 'Procedural, ours: no source model, no licence row. Line along +z; attach = the conductor / earth-wire points for a line tool.';
        rec.attach = x.attach; rec.line = x.line;
      } else { rec.lodOf = row.key; rec.lodDist = row.levels[lv - 1]; }
      props[key] = rec; order.push(key);
      bins.push(rec);
    });
  }
  return { props, order, bins };
}

function packText(pack) {
  return '// GENERATED FILE - DO NOT EDIT. Built by tools/infra_gen.js (procedural: no source model).\n' +
    '// Group: infrastructure - the high-voltage pylons, their levels (group lod, `lodOf` + `lodDist`)\n' +
    '// and their conductor attach points (`attach`, `line`). Decoded by src/core/51_prop_codec.js;\n' +
    '// geometry in media/geo/infra/ (per-prop bin, parts carry off/len); no textures.\n' +
    'registerPropPack((p => {\n  ' + BASE_DECL + '\n' +
    "  for (const k in p.texs) if (typeof p.texs[k] === 'string') p.texs[k] = B + p.texs[k];\n" +
    '  for (const k in p.props) if (p.props[k].bin) p.props[k].bin = B + p.props[k].bin;\n' +
    '  return p;\n})(' + JSON.stringify(pack) + '));\n';
}

function main(argv) {
  const report = argv.includes('--report'), check = argv.includes('--check');
  const { props, order, bins } = buildAll();
  const emitted = [];
  for (const rec of bins) {
    const buf = Buffer.concat(rec.parts.map(p => p.bytes));
    let off = 0;
    for (const p of rec.parts) { p.off = off; p.len = p.bytes.length; off += p.len; delete p.bytes; }
    rec.bin = (report || check) ? mediaRel(GEO, rec.key, 'bin', buf) : writeMedia(GEO, rec.key, 'bin', buf);
    emitted.push(rec.bin);
    console.log('  ' + rec.key.padEnd(22) + String(rec.nt).padStart(6) + ' tris ' + String(rec.nv).padStart(6) + ' verts  ' +
      String(rec.parts.length) + ' parts  ' + rec.dim.join(' x ') + ' m' + (rec.lodDist ? '  past ' + rec.lodDist + ' m' : '') +
      (rec.attach ? '  attach ' + rec.attach.length : ''));
  }
  const pack = { v: 2, groups: [['infra', 'infrastructure'], ['lod', 'levels of detail']], order, texs: {}, props };
  const text = packText(pack);
  if (report) return 0;
  if (check) {
    const on = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    const missing = emitted.filter(r => !fs.existsSync(path.join(ROOT, ...r.split('/'))));
    if (on !== text || missing.length) {
      console.log('infra_gen --check: STALE - ' + (on !== text ? 'src/infra/infra_pylon.js differs' : '') + (missing.length ? ' missing ' + missing.join(', ') : '') + ' (node tools/infra_gen.js)');
      return 1;
    }
    console.log('infra_gen --check: fresh');
    return 0;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, text);
  fs.writeFileSync(MANIFEST, JSON.stringify(['infra_pylon.js'], null, 1) + '\n');
  const gone = pruneMedia(GEO, emitted);
  console.log('---\nsrc/infra/infra_pylon.js: %d props (%d levels), %d bins in media/%s%s', SHEET.length, order.length - SHEET.length,
    emitted.length, GEO, gone.length ? ' · pruned ' + gone.join(', ') : '');
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { SHEET, BUDGET, LATTICE, HF, MATS, buildAll, lattice, hframe };
