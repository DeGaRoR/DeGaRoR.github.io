#!/usr/bin/env node
// _prophit_check.js - GATE PROPHIT (G1999, TOWN-CHEAP): A PROP'S HIT SHAPE FROM ITS KEY'S POINTS IS THE FULL MESH'S, AND CHEAP.
//
// The retro town step on a 4x-throttled CPU was 82 % obstacle rasterisation (render_premises.js shapeOf: every placement
// carried its props' FULL levels into its frame and rasterised them). Now a prop key is rasterised ONCE in its own frame at
// 0.25 m and every placement stands that raster's columns as points (29_obstacles.js columnPoints, render_premises.js
// propHitPoints). This holds, for EVERY baked prop of the game's packs (src/props, src/pier), each at several placements (a
// yaw, a ground tilt up to 8 deg, a scale) and at the two cells the page uses (0.5 m a prop, 1 m a house):
//   1 THE MESH INSIDE: every vertex of the placed mesh lies in an occupied column of the points' raster or within 0.1 m of one
//     (a turned column's square reaches into a cell between the lattice's points: k 3 bounds that by 0.088 m), within 5 cm of
//     its low / high (a tilted column's points stand on its square's corners); and the full raster's own columns covered
//     (>= 99.5 %: both rasters sample their triangles on a lattice)
//   2 BOUNDED: no occupied column of the points' raster farther than the cell + the fine cell (0.25 m) from the full raster's
//     own occupied columns (in x z), nor a low / high past the full's by more than the fine cell's reach - the 1 m rule
//   3 CHEAP: the points' raster costs a fraction of the full one (the sum over the packs, both cells) - and the key's own
//     raster is paid once
//   4 columnPoints alone: a box's points rasterised again in its own frame give the box
//   node tools/_prophit_check.js   -> "GATE PROPHIT: PASS|FAIL"      (~10-30 s)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { readGeo } = require('./_media_lib.js');
const C = require('./flight_core.js');
const OB = C.OBSTACLES;
let fails = 0;
const yes = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; return ok; };
const FINE = 0.25;

// the packs: every prop with a bin, its level-0 soup in its own frame (the viewer's decode)
const REG = { props: {}, order: [] };
const sb = { registerPropPack: p => { for (const k of p.order || Object.keys(p.props)) { REG.props[k] = p.props[k]; REG.order.push(k); } }, console };
vm.createContext(sb);
for (const sub of ['props', 'pier']) {
  const dir = path.join(__dirname, '..', 'src', sub), mf = path.join(dir, sub + '_packs.json');
  if (!fs.existsSync(mf)) continue;
  for (const f of JSON.parse(fs.readFileSync(mf, 'utf8'))) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sb, { filename: f });
}
const soupOf = prop => {
  const dec = C.decodeProp(prop, readGeo(prop.bin));
  let nv = 0, nt = 0; for (const pt of dec.parts) { nv += pt.nv; nt += pt.nt; }
  const pos = new Float32Array(nv * 3), idx = new Uint32Array(nt * 3); let vo = 0, to = 0;
  for (const pt of dec.parts) { pos.set(pt.pos, vo * 3); for (let i = 0; i < pt.idx.length; i++) idx[to + i] = pt.idx[i] + vo; vo += pt.nv; to += pt.idx.length; }
  return { pos, idx, nv };
};
// a placement: yaw about y, a tilt about x then z (the ground's), a uniform scale, a translation - a 4x4 column-major
function placement(seed) {
  let s = seed * 2654435761 >>> 0; const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const yaw = r() * Math.PI * 2, tx = (r() - 0.5) * 0.28, tz = (r() - 0.5) * 0.28, k = 0.85 + r() * 0.3;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tx), sx = Math.sin(tx), cz = Math.cos(tz), sz = Math.sin(tz);
  // R = Rz(tz) Rx(tx) Ry(yaw), scaled
  const Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy], Rx = [1, 0, 0, 0, cx, sx, 0, -sx, cx], Rz = [cz, sz, 0, -sz, cz, 0, 0, 0, 1];
  const mul = (A, B) => { const o = new Array(9); for (let c = 0; c < 3; c++) for (let rr = 0; rr < 3; rr++) o[c * 3 + rr] = A[rr] * B[c * 3] + A[3 + rr] * B[c * 3 + 1] + A[6 + rr] * B[c * 3 + 2]; return o; };
  const R = mul(Rz, mul(Rx, Ry));
  return { m: [R[0] * k, R[1] * k, R[2] * k, R[3] * k, R[4] * k, R[5] * k, R[6] * k, R[7] * k, R[8] * k], t: [(r() - 0.5) * 7.3, r() * 0.4, (r() - 0.5) * 7.3] };
}
const apply = (P, pl) => { const n = P.length / 3, o = new Float32Array(P.length), m = pl.m, t = pl.t;
  for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    o[i * 3] = m[0] * x + m[3] * y + m[6] * z + t[0]; o[i * 3 + 1] = m[1] * x + m[4] * y + m[7] * z + t[1]; o[i * 3 + 2] = m[2] * x + m[5] * y + m[8] * z + t[2]; } return o; };
const pointIdx = n => { const I = new Uint32Array(n * 3); for (let i = 0; i < n; i++) { I[i * 3] = I[i * 3 + 1] = I[i * 3 + 2] = i; } return I; };

console.log('4. columnPoints alone');
{
  const b = OB.box(2, 1, 1.5, FINE), P = OB.columnPoints(b, undefined, 2), S = OB.rasterise(P, pointIdx(P.length / 3), FINE);   // (k 2: the corners alone - a column's own cell)
  let same = S && S.cells === b.cells;
  if (same) for (let j = 0; j < b.nz; j++) for (let i = 0; i < b.nx; i++) { const k = j * b.nx + i; if (!(b.hi[k] >= b.lo[k])) continue;
    const kk = Math.round((b.oz + j * FINE - S.oz) / FINE) * S.nx + Math.round((b.ox + i * FINE - S.ox) / FINE); if (Math.abs(S.lo[kk] - b.lo[k]) > 1e-6 || Math.abs(S.hi[kk] - b.hi[k]) > 1e-6) same = false; }
  yes(same, 'a box\'s points, rasterised again in its own frame at its own cell, are the box (' + (S && S.cells) + ' / ' + b.cells + ' columns)');
}

console.log('1-3. every baked prop, placed, at 0.5 m and 1 m');
const keys = REG.order.filter(k => REG.props[k].bin && !REG.props[k].lodOf);
let n = 0, worstMiss = 0, worstMissY = 0, worstOut = 0, worstY = 0, tFull = 0, tPts = 0, tKey = 0, bad = []; const cov = [0, 0];
for (const k of keys) {
  const soup = soupOf(REG.props[k]);
  if (!soup.idx.length) continue;
  let t = process.hrtime.bigint();
  const fineS = OB.rasterise(soup.pos, soup.idx, FINE, { pad: 0 });
  const P = OB.columnPoints(fineS);
  tKey += Number(process.hrtime.bigint() - t) / 1e6;
  if (!P) continue;
  const Pidx = pointIdx(P.length / 3);
  for (let q = 0; q < 3; q++) {
    const pl = placement(n * 7 + q + 1);
    const full = apply(soup.pos, pl), pts = apply(P, pl);
    for (const cell of [0.5, 1.0]) {
      t = process.hrtime.bigint(); const A = OB.rasterise(full, soup.idx, cell); tFull += Number(process.hrtime.bigint() - t) / 1e6;
      t = process.hrtime.bigint(); const B = OB.rasterise([], null, cell, { pts }); tPts += Number(process.hrtime.bigint() - t) / 1e6;   // (as shapeOf stands them: rasterise's pts)
      if (!A) continue;
      if (!B) { bad.push(k + ':none'); continue; }
      const at = (S, x0, z0) => { const i = Math.round((x0 - S.ox) / cell), j = Math.round((z0 - S.oz) / cell); return (i < 0 || j < 0 || i >= S.nx || j >= S.nz) ? -1 : j * S.nx + i; };
      // 1 THE MESH INSIDE: every vertex of the placed mesh in an occupied column of the points' raster, between its low and its
      // high (GATE OBSTACLE's own rule, now for the points) - and the full raster's columns covered (both rasters SAMPLE their
      // triangles on a lattice, so a cell the full one reached through a sample is counted, not required)
      // a vertex is COVERED when an occupied cell within 0.1 m of it (x z: the distance to the cell's square, 0 inside) holds its
      // height within 5 cm: missH = its distance to the nearest cell holding its height (to 5 cm), missY = its height's distance
      // to the nearest cell within 0.1 m - each the worst over the vertices
      let miss = 0, missY = 0;
      for (let v = 0; v < soup.nv; v++) { const x = full[v * 3], y = full[v * 3 + 1], z = full[v * 3 + 2];
        const ci = Math.floor((x - B.ox) / cell), cj = Math.floor((z - B.oz) / cell);
        let h = Infinity, yy = Infinity;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i2 = ci + di, j2 = cj + dj; if (i2 < 0 || j2 < 0 || i2 >= B.nx || j2 >= B.nz) continue;
          const kb = j2 * B.nx + i2; if (!(B.hi[kb] >= B.lo[kb])) continue;
          const sx0 = B.ox + i2 * cell, sz0 = B.oz + j2 * cell, d = Math.max(0, sx0 - x, x - (sx0 + cell), sz0 - z, z - (sz0 + cell));
          const dy = Math.max(0, B.lo[kb] - y, y - B.hi[kb]);
          if (dy <= 0.05 && d < h) h = d;
          if (d <= 0.1 && dy < yy) yy = dy; }
        if (h > miss) miss = h; if (yy > missY) missY = yy; }
      if (missY > worstMissY) worstMissY = missY;
      for (let j = 0; j < A.nz; j++) for (let i = 0; i < A.nx; i++) { const ka = j * A.nx + i; if (!(A.hi[ka] >= A.lo[ka])) continue;
        cov[0]++; const kb = at(B, A.ox + i * cell, A.oz + j * cell); if (kb >= 0 && B.hi[kb] >= B.lo[kb]) cov[1]++; }
      // 2 bounded: every occupied column of B within (cell + FINE) of an occupied column of A; its low / high within FINE's reach
      let out = 0, outY = 0;
      const occA = []; for (let j = 0; j < A.nz; j++) for (let i = 0; i < A.nx; i++) { const ka = j * A.nx + i; if (A.hi[ka] >= A.lo[ka]) occA.push([A.ox + (i + 0.5) * cell, A.oz + (j + 0.5) * cell, A.lo[ka], A.hi[ka]]); }
      let aLo = Infinity, aHi = -Infinity; for (const c of occA) { if (c[2] < aLo) aLo = c[2]; if (c[3] > aHi) aHi = c[3]; }
      for (let j = 0; j < B.nz; j++) for (let i = 0; i < B.nx; i++) { const kb = j * B.nx + i; if (!(B.hi[kb] >= B.lo[kb])) continue;
        const cx = B.ox + (i + 0.5) * cell, cz = B.oz + (j + 0.5) * cell; let d = Infinity;
        for (const c of occA) { const dd = Math.max(Math.abs(c[0] - cx), Math.abs(c[1] - cz)); if (dd < d) d = dd; }
        out = Math.max(out, d); outY = Math.max(outY, aLo - B.lo[kb], B.hi[kb] - aHi); }
      if (miss > worstMiss) worstMiss = miss; if (out > worstOut) worstOut = out; if (outY > worstY) worstY = outY;
      if (miss > 0.1 || missY > 0.05 || out > cell + FINE + 1e-3 || outY > FINE * 1.5 + 1e-3) bad.push(k + '@' + cell + ':' + miss.toFixed(3) + '/' + out.toFixed(3) + '/' + outY.toFixed(3));
    }
  }
  n++;
}
yes(n >= 100, n + ' baked props, 3 placements each, at 0.5 m and 1 m');
yes(worstMiss <= 0.1 && worstMissY <= 0.05, '1 THE MESH INSIDE: every vertex of every placed mesh (turned, tilted to 8 deg, scaled) in an occupied column of the points\' raster or within 0.1 m of one (worst ' + worstMiss.toFixed(3) + ' m), within 5 cm of its low / high (worst ' + worstMissY.toFixed(3) + ' m) - the full raster itself overshoots by up to a cell');
yes(cov[1] >= 0.995 * cov[0], '1b the full raster\'s columns covered: ' + cov[1] + ' / ' + cov[0] + ' (' + (100 * cov[1] / Math.max(1, cov[0])).toFixed(2) + ' %; the rest a lattice sample\'s reach)');
yes(worstOut <= 1.0 + FINE + 1e-3 && worstY <= FINE * 1.5 + 1e-3, '2 BOUNDED: no column farther than the cell + 0.25 m from the full raster\'s (worst ' + worstOut.toFixed(3) + ' m centre to centre), no low / high past it by more than ' + (FINE * 1.5) + ' m (worst ' + worstY.toFixed(3) + ' m)');
yes(bad.length === 0, 'no prop off the rules' + (bad.length ? ': ' + bad.slice(0, 6).join(' ') : ''));
yes(tPts < 0.25 * tFull, '3 CHEAP: the points\' rasters ' + tPts.toFixed(0) + ' ms against the full meshes\' ' + tFull.toFixed(0) + ' ms (x ' + (tFull / Math.max(1, tPts)).toFixed(1) + '), the keys\' own rasters once: ' + tKey.toFixed(0) + ' ms');
console.log('GATE PROPHIT: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
