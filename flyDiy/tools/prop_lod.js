#!/usr/bin/env node
// prop_lod.js — LEVELS OF DETAIL for baked props (G301, the user: "For the
// people, could you handle the decimation and texture remapping? And generate
// a couple of LODs yourself? It is important to see people from far away, but
// not to carry their full detail until up close ... As much as we can keep a
// self-contained package here, I like it better").
//
// WHAT IT DOES. Reads a baked pack (the pier kit's people by default) through
// the same pack files the page loads, decimates every listed prop to the
// triangle counts in LEVELS with a quadric-error half-edge collapse, and
// writes the levels back as props of their own — `person_andrew_l1`, `_l2`,
// `_l3` — in a pack of their own (src/pier/pier_lods.js, bins under
// media/geo/pier_lod/), each carrying `lodOf` (the full prop) and `lodDist`
// (the metres past which it stands in for it). props.js reads those two
// fields and places a THREE.LOD; nothing else in the pipeline knows.
//
// WHY HALF-EDGE (a vertex slides onto its neighbour, never to a new point):
// a surviving vertex keeps its position, its normal and its UV EXACTLY as the
// author exported them, so the level wears the same atlas with no re-bake and
// no drift — "texture remapping" is then the trivial case, the map stays and
// the mesh is a subset. The pack's int16 positions ride through untouched.
//
// WHY SEAMS ARE HANDLED. The atlas is cut into islands; at a cut the mesh
// carries two vertices at one position (two "wedges"). Collapsing one wedge
// and not its twin opens a crack. So the topology is the wedge graph, the
// quadric is per POSITION (both wedges share it), a seam edge gets a
// boundary penalty (a plane through it, normal to the face) so it stays where
// it was drawn, and a position may only collapse when EVERY wedge of it has
// a wedge of the target to collapse into along a shared triangle — a seam
// vertex collapses along its seam or not at all.
//
// Usage: node tools/prop_lod.js            (bake the levels)
//        node tools/prop_lod.js --report   (decimate, print, write nothing)
// Run after tools/pier_prep.py (the levels are cut from its bins).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const PIER = path.join(ROOT, 'src', 'pier');
const SUB = 'geo/pier_lod';
const OUT = path.join(PIER, 'pier_lods.js');
const MANIFEST = path.join(PIER, 'pier_packs.json');

// THE LEVELS: [triangles, metres]. A 1.8 m person on a 1080-pixel view at
// 50 deg is ~85 px tall at 25 m and ~24 px at 90 m; 5k triangles is dense at
// the first, 1.2k is a silhouette at the second. Level 1 is a fifth of a
// person's delivered mesh - still every fold of the jacket - for the middle
// distance, where most of a village is seen from.
const LEVELS = {
  people: [[24000, 8], [5000, 30], [1200, 90]],
};
// per material: the small props on a person (a phone, the notes) shrink in
// the same ratio as the body but never below this many triangles
const MIN_TRIS = 60;
// boundary penalties, in units of edge length squared (the face quadrics are
// area-weighted): a true border is stiff, an atlas seam a little less
const W_BORDER = 10, W_SEAM = 1;
// a collapse that turns a triangle over (its normal past this cosine from
// where it was) is refused
const FLIP_COS = 0.2;

// ---------------------------------------------------------------------------
// reading the packs the way the page does: the file is a script that calls
// registerPropPack(pack) with B = '' here, so `bin` is the media path
// ---------------------------------------------------------------------------
function readPacks() {
  const raw = [];
  const sb = { registerPropPack: p => raw.push(p), console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(MANIFEST, 'utf8')))
    if (f !== path.basename(OUT))
      vm.runInContext(fs.readFileSync(path.join(PIER, f), 'utf8'), sb, { filename: f });
  return raw;
}

// one part of a prop's bin, RAW: the int16/int8/uint16 exactly as packed
function readPart(bin, part) {
  const dv = new DataView(bin.buffer, bin.byteOffset + part.off, part.len);
  const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
  let o = 8;
  const pos = new Int16Array(nv * 3);
  for (let i = 0; i < nv * 3; i++, o += 2) pos[i] = dv.getInt16(o, true);
  const nrm = new Int8Array(nv * 3);
  for (let i = 0; i < nv * 3; i++, o++) nrm[i] = dv.getInt8(o);
  const uv = new Float32Array(nv * 2);
  const [u0, v0] = part.uvMin, [us, vs] = part.uvScl;
  for (let i = 0; i < nv; i++, o += 4) {
    uv[i * 2] = u0 + dv.getUint16(o, true) / 65535 * us;
    uv[i * 2 + 1] = v0 + dv.getUint16(o + 2, true) / 65535 * vs;
  }
  const idx = new Uint32Array(nt * 3);
  for (let i = 0; i < nt * 3; i++, o += 2) idx[i] = dv.getUint16(o, true);
  return { nv, nt, pos, nrm, uv, idx };
}

// ---------------------------------------------------------------------------
// one material's mesh out of its parts (prop_prep cuts a material at 65 536
// vertices, duplicating the vertices on the cut - welded back here so a cut
// line is not a border the decimator would keep)
// ---------------------------------------------------------------------------
// A WEDGE IS A TOLERANCE, NOT A KEY: two exports of these (andrew, koky)
// carry every vertex twice with UVs a quantisation step apart (< 1e-4, a
// tenth of a texel) and identical normals - an exact key kept 300k wedges
// for 176k positions and the seam rule then refused half the collapses. Same
// position, normal within a few int8 steps, uv within UV_TOL: one wedge.
const UV_TOL = 3e-4, NRM_TOL = 3;
function mergeParts(parts) {
  const key = new Map();        // 'x,y,z' -> [wedge, ...] at that position
  const pos = [], nrm = [], uv = [], idx = [];
  for (const P of parts) {
    const map = new Int32Array(P.nv);
    for (let i = 0; i < P.nv; i++) {
      const k = P.pos[i * 3] + ',' + P.pos[i * 3 + 1] + ',' + P.pos[i * 3 + 2];
      let ws = key.get(k);
      if (!ws) key.set(k, ws = []);
      let j = -1;
      for (const w of ws) {
        if (Math.abs(nrm[w * 3] - P.nrm[i * 3]) > NRM_TOL || Math.abs(nrm[w * 3 + 1] - P.nrm[i * 3 + 1]) > NRM_TOL ||
            Math.abs(nrm[w * 3 + 2] - P.nrm[i * 3 + 2]) > NRM_TOL) continue;
        if (Math.abs(uv[w * 2] - P.uv[i * 2]) > UV_TOL || Math.abs(uv[w * 2 + 1] - P.uv[i * 2 + 1]) > UV_TOL) continue;
        j = w; break;
      }
      if (j < 0) {
        j = pos.length / 3;
        ws.push(j);
        pos.push(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]);
        nrm.push(P.nrm[i * 3], P.nrm[i * 3 + 1], P.nrm[i * 3 + 2]);
        uv.push(P.uv[i * 2], P.uv[i * 2 + 1]);
      }
      map[i] = j;
    }
    for (let t = 0; t < P.nt; t++) {
      const a = map[P.idx[t * 3]], b = map[P.idx[t * 3 + 1]], c = map[P.idx[t * 3 + 2]];
      if (a === b || b === c || a === c) continue;
      idx.push(a, b, c);
    }
  }
  return { nv: pos.length / 3, nt: idx.length / 3,
           pos: Int16Array.from(pos), nrm: Int8Array.from(nrm),
           uv: Float32Array.from(uv), idx: Uint32Array.from(idx) };
}

// ---------------------------------------------------------------------------
// THE DECIMATOR. Garland-Heckbert quadrics per position, half-edge collapses
// on the wedge graph, lazy heap.
// ---------------------------------------------------------------------------
function decimate(M, bb, target) {
  const W = M.nv, T = M.nt, idx = M.idx;
  if (T <= target) return { idx: Array.from(idx), alive: null, nt: T };
  // metres, for the quadrics
  const [x0, y0, z0, x1, y1, z1] = bb;
  const sx = (x1 - x0) / 65535, sy = (y1 - y0) / 65535, sz = (z1 - z0) / 65535;
  const X = new Float64Array(W * 3);
  for (let i = 0; i < W; i++) {
    X[i * 3] = x0 + (M.pos[i * 3] + 32768) * sx;
    X[i * 3 + 1] = y0 + (M.pos[i * 3 + 1] + 32768) * sy;
    X[i * 3 + 2] = z0 + (M.pos[i * 3 + 2] + 32768) * sz;
  }
  // wedges -> positions (welded on the int16 triple)
  const wPos = new Int32Array(W);
  const pmap = new Map();
  let P = 0;
  for (let i = 0; i < W; i++) {
    const k = (M.pos[i * 3] + 32768) * 4294967296 + (M.pos[i * 3 + 1] + 32768) * 65536 + (M.pos[i * 3 + 2] + 32768);
    let p = pmap.get(k);
    if (p === undefined) { p = P++; pmap.set(k, p); }
    wPos[i] = p;
  }
  const pWedges = new Array(P);
  const pX = new Float64Array(P * 3);
  for (let i = 0; i < W; i++) { const p = wPos[i]; pX[p * 3] = X[i * 3]; pX[p * 3 + 1] = X[i * 3 + 1]; pX[p * 3 + 2] = X[i * 3 + 2]; }

  // triangles, and every wedge's triangles
  const tri = new Int32Array(idx);
  const tAlive = new Uint8Array(T).fill(1);
  const wTris = new Array(W);
  for (let i = 0; i < W; i++) wTris[i] = [];
  for (let t = 0; t < T; t++) { wTris[tri[t * 3]].push(t); wTris[tri[t * 3 + 1]].push(t); wTris[tri[t * 3 + 2]].push(t); }
  // a wedge no triangle uses (a level cut from a level leaves them) is not
  // part of the surface: not alive, not a wedge of its position
  const wAlive = new Uint8Array(W);
  for (let i = 0; i < W; i++) if (wTris[i].length) {
    wAlive[i] = 1;
    (pWedges[wPos[i]] || (pWedges[wPos[i]] = [])).push(i);
  }

  // quadrics per position: area-weighted face planes
  const Q = new Float64Array(P * 10);
  const addPlane = (p, a, b, c, d, w) => {
    const o = p * 10;
    Q[o] += a * a * w; Q[o + 1] += a * b * w; Q[o + 2] += a * c * w; Q[o + 3] += a * d * w;
    Q[o + 4] += b * b * w; Q[o + 5] += b * c * w; Q[o + 6] += b * d * w;
    Q[o + 7] += c * c * w; Q[o + 8] += c * d * w; Q[o + 9] += d * d * w;
  };
  const tN = new Float64Array(T * 3);      // face normals (unit), kept for the flip test
  for (let t = 0; t < T; t++) {
    const a = tri[t * 3] * 3, b = tri[t * 3 + 1] * 3, c = tri[t * 3 + 2] * 3;
    const ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2];
    const vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-18) { tAlive[t] = 0; continue; }
    nx /= l; ny /= l; nz /= l;
    tN[t * 3] = nx; tN[t * 3 + 1] = ny; tN[t * 3 + 2] = nz;
    const d = -(nx * X[a] + ny * X[a + 1] + nz * X[a + 2]);
    const area = l * 0.5;
    addPlane(wPos[tri[t * 3]], nx, ny, nz, d, area);
    addPlane(wPos[tri[t * 3 + 1]], nx, ny, nz, d, area);
    addPlane(wPos[tri[t * 3 + 2]], nx, ny, nz, d, area);
  }
  // boundaries and seams: a wedge edge in one triangle only is a border of
  // the wedge graph; if its positions meet in more triangles it is a seam
  const wEdge = new Map(), pEdge = new Map();
  const ek = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  for (let t = 0; t < T; t++) {
    if (!tAlive[t]) continue;
    for (let e = 0; e < 3; e++) {
      const a = tri[t * 3 + e], b = tri[t * 3 + (e + 1) % 3];
      const kw = ek(a, b), kp = ek(wPos[a], wPos[b]);
      wEdge.set(kw, (wEdge.get(kw) || 0) + 1);
      pEdge.set(kp, (pEdge.get(kp) || 0) + 1);
    }
  }
  let nBorder = 0, nSeam = 0;
  for (let t = 0; t < T; t++) {
    if (!tAlive[t]) continue;
    for (let e = 0; e < 3; e++) {
      const a = tri[t * 3 + e], b = tri[t * 3 + (e + 1) % 3];
      if (wEdge.get(ek(a, b)) !== 1) continue;
      const seam = pEdge.get(ek(wPos[a], wPos[b])) > 1;
      if (seam) nSeam++; else nBorder++;
      // the plane through the edge, normal to the face
      const ax = X[a * 3], ay = X[a * 3 + 1], az = X[a * 3 + 2];
      const ex = X[b * 3] - ax, ey = X[b * 3 + 1] - ay, ez = X[b * 3 + 2] - az;
      const fx = tN[t * 3], fy = tN[t * 3 + 1], fz = tN[t * 3 + 2];
      let nx = fy * ez - fz * ey, ny = fz * ex - fx * ez, nz = fx * ey - fy * ex;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-18) continue;
      nx /= l; ny /= l; nz /= l;
      const d = -(nx * ax + ny * ay + nz * az);
      const w = (ex * ex + ey * ey + ez * ez) * (seam ? W_SEAM : W_BORDER);
      addPlane(wPos[a], nx, ny, nz, d, w);
      addPlane(wPos[b], nx, ny, nz, d, w);
    }
  }
  wEdge.clear(); pEdge.clear();

  const evalQ = (pa, pb, p) => {
    const a = pa * 10, b = pb * 10, x = pX[p * 3], y = pX[p * 3 + 1], z = pX[p * 3 + 2];
    const q = i => Q[a + i] + Q[b + i];
    return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x +
      q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9);
  };

  // THE HEAP: entries (cost, a, b, va, vb) - collapse wedge a onto wedge b,
  // valid while both keep the versions it was pushed with
  let cap = T * 6;
  let eCost = new Float64Array(cap), eA = new Int32Array(cap), eB = new Int32Array(cap),
    eVa = new Int32Array(cap), eVb = new Int32Array(cap);
  let nE = 0;
  let heap = new Int32Array(cap), nH = 0;
  const wVer = new Int32Array(W);
  const grow = () => {
    cap *= 2;
    const g = (old, C) => { const n = new C(cap); n.set(old); return n; };
    eCost = g(eCost, Float64Array); eA = g(eA, Int32Array); eB = g(eB, Int32Array);
    eVa = g(eVa, Int32Array); eVb = g(eVb, Int32Array); heap = g(heap, Int32Array);
  };
  const push = (a, b) => {
    if (nE >= cap) grow();
    const e = nE++;
    eCost[e] = evalQ(wPos[a], wPos[b], wPos[b]); eA[e] = a; eB[e] = b; eVa[e] = wVer[a]; eVb[e] = wVer[b];
    let i = nH++;
    heap[i] = e;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (eCost[heap[p]] <= eCost[heap[i]]) break;
      const s = heap[p]; heap[p] = heap[i]; heap[i] = s; i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap[--nH];
    if (nH > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < nH && eCost[heap[l]] < eCost[heap[m]]) m = l;
        if (r < nH && eCost[heap[r]] < eCost[heap[m]]) m = r;
        if (m === i) break;
        const s = heap[m]; heap[m] = heap[i]; heap[i] = s; i = m;
      }
    }
    return top;
  };
  const pushAround = w => {
    const ts = wTris[w];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (!tAlive[t]) continue;
      for (let e = 0; e < 3; e++) {
        const o = tri[t * 3 + e];
        if (o === w) continue;
        push(o, w); push(w, o);
      }
    }
  };
  for (let t = 0; t < T; t++) {
    if (!tAlive[t]) continue;
    for (let e = 0; e < 3; e++) { const a = tri[t * 3 + e], b = tri[t * 3 + (e + 1) % 3]; push(a, b); push(b, a); }
  }

  const adjacent = (a, b) => {
    const ts = wTris[a];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (!tAlive[t]) continue;
      if (tri[t * 3] === b || tri[t * 3 + 1] === b || tri[t * 3 + 2] === b) return true;
    }
    return false;
  };
  const compact = w => {
    const ts = wTris[w], out = [];
    for (let i = 0; i < ts.length; i++) if (tAlive[ts[i]]) out.push(ts[i]);
    wTris[w] = out;
    return out;
  };
  let alive = 0;
  for (let t = 0; t < T; t++) alive += tAlive[t];
  const pairs = [];
  let refused = 0, refSeam = 0;
  while (alive > target && nH > 0) {
    const e = pop();
    const a = eA[e], b = eB[e];
    if (!wAlive[a] || !wAlive[b] || wVer[a] !== eVa[e] || wVer[b] !== eVb[e]) continue;
    const pa = wPos[a], pb = wPos[b];
    if (pa === pb) continue;
    // THE SEAM RULE: every wedge of pa finds exactly one wedge of pb across a
    // shared triangle
    pairs.length = 0;
    let ok = true;
    const A = pWedges[pa], B = pWedges[pb];
    for (let i = 0; i < A.length && ok; i++) {
      const ai = A[i];
      let hit = -1;
      for (let j = 0; j < B.length; j++) {
        if (!adjacent(ai, B[j])) continue;
        if (hit >= 0) { ok = false; break; }
        hit = B[j];
      }
      if (hit < 0) ok = false;
      else pairs.push(ai, hit);
    }
    if (!ok) { refused++; refSeam++; continue; }
    // THE FLIP TEST on every triangle that survives the move
    const bx = pX[pb * 3], by = pX[pb * 3 + 1], bz = pX[pb * 3 + 2];
    for (let k = 0; k < pairs.length && ok; k += 2) {
      const ai = pairs[k];
      const ts = wTris[ai];
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i];
        if (!tAlive[t]) continue;
        const w0 = tri[t * 3], w1 = tri[t * 3 + 1], w2 = tri[t * 3 + 2];
        if (wPos[w0] === pb || wPos[w1] === pb || wPos[w2] === pb) continue;   // dies
        const p0 = w0 * 3, p1 = w1 * 3, p2 = w2 * 3;
        const x0 = w0 === ai ? bx : X[p0], y0 = w0 === ai ? by : X[p0 + 1], z0 = w0 === ai ? bz : X[p0 + 2];
        const x1 = w1 === ai ? bx : X[p1], y1 = w1 === ai ? by : X[p1 + 1], z1 = w1 === ai ? bz : X[p1 + 2];
        const x2 = w2 === ai ? bx : X[p2], y2 = w2 === ai ? by : X[p2 + 1], z2 = w2 === ai ? bz : X[p2 + 2];
        const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0;
        const vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz);
        if (l < 1e-16 || (nx * tN[t * 3] + ny * tN[t * 3 + 1] + nz * tN[t * 3 + 2]) / l < FLIP_COS) { ok = false; break; }
      }
    }
    if (!ok) { refused++; continue; }
    // COLLAPSE
    for (let k = 0; k < pairs.length; k += 2) {
      const ai = pairs[k], bj = pairs[k + 1];
      const ts = wTris[ai];
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i];
        if (!tAlive[t]) continue;
        const w0 = tri[t * 3], w1 = tri[t * 3 + 1], w2 = tri[t * 3 + 2];
        if (wPos[w0] === pb || wPos[w1] === pb || wPos[w2] === pb) { tAlive[t] = 0; alive--; continue; }
        if (w0 === ai) tri[t * 3] = bj; if (w1 === ai) tri[t * 3 + 1] = bj; if (w2 === ai) tri[t * 3 + 2] = bj;
        // the face normal moves with the vertex
        const q0 = tri[t * 3] * 3, q1 = tri[t * 3 + 1] * 3, q2 = tri[t * 3 + 2] * 3;
        const ux = X[q1] - X[q0], uy = X[q1 + 1] - X[q0 + 1], uz = X[q1 + 2] - X[q0 + 2];
        const vx = X[q2] - X[q0], vy = X[q2 + 1] - X[q0 + 1], vz = X[q2 + 2] - X[q0 + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        tN[t * 3] = nx / l; tN[t * 3 + 1] = ny / l; tN[t * 3 + 2] = nz / l;
        wTris[bj].push(t);
      }
      wTris[ai] = null;
      wAlive[ai] = 0;
    }
    for (let i = 0; i < 10; i++) Q[pb * 10 + i] += Q[pa * 10 + i];
    pWedges[pa] = null;
    for (let j = 0; j < B.length; j++) {
      const bj = B[j];
      wVer[bj]++;
      compact(bj);
      pushAround(bj);
    }
  }
  const out = [];
  for (let t = 0; t < T; t++) if (tAlive[t]) out.push(tri[t * 3], tri[t * 3 + 1], tri[t * 3 + 2]);
  return { idx: out, alive: wAlive, nt: alive, nBorder, nSeam, refused, refSeam };
}

// ---------------------------------------------------------------------------
// back into pack parts: <= 65 534 vertices each, the pack's own layout
// ---------------------------------------------------------------------------
function packParts(name, M, idx) {
  const parts = [];
  const CAP = 65534;
  let t = 0;
  const nt = idx.length / 3;
  while (t < nt) {
    const map = new Map(), verts = [], tris = [];
    while (t < nt) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      let need = 0;
      for (const w of [a, b, c]) if (!map.has(w)) need++;
      if (verts.length + need > CAP) break;
      const tr = [];
      for (const w of [a, b, c]) {
        let j = map.get(w);
        if (j === undefined) { j = verts.length; map.set(w, j); verts.push(w); }
        tr.push(j);
      }
      tris.push(tr);
      t++;
    }
    const nv = verts.length;
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (const w of verts) {
      const u = M.uv[w * 2], v = M.uv[w * 2 + 1];
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const ur = (u1 - u0) || 1.0, vr = (v1 - v0) || 1.0;
    const buf = Buffer.alloc(8 + nv * 6 + nv * 3 + nv * 4 + tris.length * 6);
    let o = 0;
    buf.writeUInt32LE(nv, 0); buf.writeUInt32LE(tris.length, 4); o = 8;
    for (const w of verts) { buf.writeInt16LE(M.pos[w * 3], o); buf.writeInt16LE(M.pos[w * 3 + 1], o + 2); buf.writeInt16LE(M.pos[w * 3 + 2], o + 4); o += 6; }
    for (const w of verts) { buf.writeInt8(M.nrm[w * 3], o); buf.writeInt8(M.nrm[w * 3 + 1], o + 1); buf.writeInt8(M.nrm[w * 3 + 2], o + 2); o += 3; }
    for (const w of verts) {
      buf.writeUInt16LE(Math.round((M.uv[w * 2] - u0) / ur * 65535), o);
      buf.writeUInt16LE(Math.round((M.uv[w * 2 + 1] - v0) / vr * 65535), o + 2);
      o += 4;
    }
    for (const tr of tris) { buf.writeUInt16LE(tr[0], o); buf.writeUInt16LE(tr[1], o + 2); buf.writeUInt16LE(tr[2], o + 4); o += 6; }
    parts.push({ mat: name, nv, nt: tris.length,
                 uvMin: [+u0.toFixed(6), +v0.toFixed(6)], uvScl: [+ur.toFixed(6), +vr.toFixed(6)],
                 bytes: buf });
  }
  return parts;
}

// ---------------------------------------------------------------------------
function main(argv) {
  const report = argv.includes('--report');
  const only = argv.filter(a => !a.startsWith('--'));
  const packs = readPacks();
  const texs = {};
  for (const p of packs) Object.assign(texs, p.texs);
  const props = {}, order = [], emitted = [], usedTex = new Set();
  let tris0 = 0, tris1 = 0;
  for (const pack of packs) for (const key of pack.order) {
    const prop = pack.props[key];
    const levels = LEVELS[prop.group];
    if (!levels || (only.length && !only.includes(key))) continue;
    const bin = fs.readFileSync(path.join(ROOT, prop.bin));
    // the material meshes, welded across the baker's 65k cuts
    const byMat = new Map();
    for (const part of prop.parts) (byMat.get(part.mat) || byMat.set(part.mat, []).get(part.mat)).push(readPart(bin, part));
    const meshes = [];
    for (const [mat, parts] of byMat) meshes.push([mat, mergeParts(parts)]);
    const total = meshes.reduce((s, m) => s + m[1].nt, 0);
    console.log('%s  %d parts, %d materials, %d tris (%d welded)', key, prop.parts.length, meshes.length, prop.nt, total);
    tris0 += prop.nt;
    let prev = null;
    levels.forEach(([target, dist], li) => {
      const lk = key + '_l' + (li + 1);
      const t0 = Date.now();
      const parts = [], next = new Map();
      let nt = 0, note = [];
      for (const [mat, M] of meshes) {
        const want = Math.max(MIN_TRIS, Math.round(target * M.nt / total));
        const src = prev ? prev.get(mat) : M;
        const D = decimate(src, prop.bb, want);
        next.set(mat, { nv: src.nv, nt: D.nt, pos: src.pos, nrm: src.nrm, uv: src.uv, idx: Uint32Array.from(D.idx) });
        for (const p of packParts(mat, src, D.idx)) parts.push(p);
        nt += D.nt;
        if (D.nBorder !== undefined) note.push(mat + ' ' + src.nt + '->' + D.nt + (D.nSeam ? ' seam ' + D.nSeam : '') + (D.nBorder ? ' border ' + D.nBorder : '') + ' refused ' + D.refused + '/' + D.refSeam);
      }
      // one level is cut from the one above it, so the chain is consistent
      // and the small levels fall out fast
      prev = next;
      const nv = parts.reduce((s, p) => s + p.nv, 0);
      const rec = { key: lk, group: 'lod', label: prop.label + ', LOD ' + (li + 1), lodOf: key, lodDist: dist,
                    place: prop.place, bb: prop.bb, dim: prop.dim, nv, nt, src: prop.src,
                    mats: JSON.parse(JSON.stringify(prop.mats)), parts };
      for (const m in rec.mats) for (const f of ['map', 'nor', 'arm', 'emisMap', 'aoMap'])
        if (rec.mats[m][f]) usedTex.add(rec.mats[m][f]);
      const geo = parts.reduce((s, p) => s + p.bytes.length, 0);
      console.log('  ' + lk.padEnd(20) + String(nt).padStart(7) + ' tris' + String(nv).padStart(7) + ' verts ' + String(parts.length).padStart(2) + ' parts ' + (geo / 1024).toFixed(1).padStart(6) + ' KB  past ' + String(dist).padStart(3) + ' m  ' + ((Date.now() - t0) / 1000).toFixed(1) + 's  ' + note.join(', '));
      tris1 += nt;
      props[lk] = rec;
      order.push(lk);
    });
  }
  if (report) return;
  for (const k of order) {
    const rec = props[k];
    const buf = Buffer.concat(rec.parts.map(p => p.bytes));
    let off = 0;
    for (const p of rec.parts) { p.off = off; p.len = p.bytes.length; off += p.len; delete p.bytes; }
    rec.bin = writeMedia(SUB, k, 'bin', buf);
    emitted.push(rec.bin);
  }
  const gone = pruneMedia(SUB, emitted);
  const pack = { v: 2, groups: [['lod', 'levels of detail']], order,
                 texs: Object.fromEntries([...usedTex].map(id => [id, texs[id]])), props };
  const body = '// GENERATED FILE - DO NOT EDIT. Built by tools/prop_lod.js from the\n' +
    '// baked pier packs (the people). Group: levels of detail - every prop here\n' +
    '// is a decimated stand-in for the prop named by its `lodOf`, used past\n' +
    '// `lodDist` metres (src/viewer/props.js places a THREE.LOD). Decoded by\n' +
    '// src/core/51_prop_codec.js; geometry in media/' + SUB + '/, textures the\n' +
    '// full props\' own in media/tex/pier/.\n' +
    'registerPropPack((p => {\n  ' + BASE_DECL + '\n' +
    '  for (const k in p.texs) p.texs[k] = B + p.texs[k];\n' +
    '  for (const k in p.props) if (p.props[k].bin) p.props[k].bin = B + p.props[k].bin;\n' +
    '  return p;\n})(' + JSON.stringify(pack) + '));\n';
  fs.writeFileSync(OUT, body);
  const mf = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (!mf.includes(path.basename(OUT))) {
    mf.push(path.basename(OUT));
    fs.writeFileSync(MANIFEST, JSON.stringify(mf, null, 1));
  }
  console.log('---\n%s: %d levels of %d props, %s -> %s tris in the levels, %d bins in media/%s/%s',
    path.relative(ROOT, OUT), order.length, order.length / 3, tris0.toLocaleString(), tris1.toLocaleString(),
    emitted.length, SUB, gone.length ? ' · pruned ' + gone.join(', ') : '');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { decimate, mergeParts, packParts, readPart, LEVELS };
