// proto/skin/march.js — scalar field -> one indexed, watertight, skinned mesh.
//
// PROTOTYPE. Nothing here is imported by the app.
//
// SURFACE NETS, NOT MARCHING CUBES — a deliberate change from the plan, made
// once the two were written out side by side:
//
//   * Marching cubes needs a 256x16 triangle table. Four thousand hand-entered
//     integers is four thousand chances to put a hole in an animal, and a wrong
//     entry fails as a silent one-cell crack rather than as an error.
//   * Surface nets is table-free: one vertex per cell that straddles the surface,
//     one quad per grid edge that does. It is watertight by construction, because
//     every crossed edge emits exactly one quad and every quad references cells
//     that must exist.
//   * It produces roughly half the vertices of marching cubes at the same grid
//     spacing, which matters against the triangle budget.
//   * Its known weakness is rounding sharp features. Our surface is a smooth
//     union of capsules; it has no sharp features to lose.
//
// Two things are computed from the field rather than from the mesh, and both
// matter more than they look:
//
//   NORMALS come from the analytic gradient (central differences), not from
//   computeVertexNormals(). Face-averaged normals on a surface-nets mesh show the
//   grid: you get faint quad facets crawling over the body as the resolution
//   changes. The gradient is the true surface normal and is free of the
//   tessellation entirely.
//
//   WINDING is chosen per triangle by testing it against that gradient. Deriving
//   the cyclic order of the four cells around a grid edge by hand is the other
//   classic way to ship inside-out geometry; comparing a cross product to a
//   normal we already have cannot be got wrong.

import * as THREE from 'three';

// Cube corner c = (c&1, (c>>1)&1, (c>>2)&1). The twelve edges as corner pairs.
const EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7],   // along x
  [0, 2], [1, 3], [4, 6], [5, 7],   // along y
  [0, 4], [1, 5], [2, 6], [3, 7],   // along z
];

// THE COST DIAL, and it is a sample count rather than a cell size on purpose.
//
// Measured over 30 random genomes with the grid sized only by girth: median 755
// ms and 35k triangles, worst case 2.5 s and 91k. The cause is that girth sets
// the cell size while the ANIMAL sets how many cells there are, and a sprawling
// 20-body creature is fifteen units across — a hundred cells per axis before
// anyone has chosen anything. Budgeting the total instead makes the cost of a
// creature independent of how big it happens to be, which is the property a
// frame budget actually needs.
const SAMPLE_BUDGET = 300000;

// Empty-space skipping block edge, in cells. The field is a distance, so one
// evaluation at a block's centre can prove the surface is nowhere inside it.
const BLOCK = 4;

const COARSE = 1;   // sample filled from a block test: sign true, magnitude not
const EXACT = 2;

/**
 * @param {object} field   from makeField()
 * @param {object} [opts]
 * @param {number} [opts.res=3]     cells per girth radius — the fine limit
 * @param {number} [opts.budget]    max grid samples; the coarse limit
 * @returns {{ geometry: THREE.BufferGeometry, stats: object }}
 */
export function surfaceNet(field, opts = {}) {
  const t0 = performance.now();
  const res = Math.max(1, opts.res ?? 3);
  const budget = Math.max(4096, opts.budget ?? SAMPLE_BUDGET);
  const floorFrac = opts.floorFrac ?? 0.16;

  // THE GRID IS SIZED BY THE THINNEST THING THAT HAS TO SURVIVE, not by the
  // largest — a hair-thin limb on a fat body is what a uniform grid loses first.
  // But taken literally that is unaffordable: one 0.05-radius fin on a 2-unit
  // animal asks for a 240^3 grid. So the field is given a thickness floor
  // relative to the animal's own girth, and everything below it is inflated to
  // the floor rather than sampled into rags. See field.setMinRadius.
  const rMin = Math.max(Math.min(...field.rChar), field.girthRef * floorFrac);
  field.setMinRadius(rMin);
  const { lo, hi } = field.bounds();

  let h = rMin / res;
  let nx, ny, nz;
  let coarsened = 0;
  for (;;) {
    nx = Math.ceil((hi[0] - lo[0]) / h) + 3;
    ny = Math.ceil((hi[1] - lo[1]) / h) + 3;
    nz = Math.ceil((hi[2] - lo[2]) / h) + 3;
    if (nx * ny * nz <= budget) break;
    h *= 1.26;                  // ~2x the cell count per step
    coarsened++;
  }
  // One cell of margin all round, so the surface never touches the grid boundary
  // and every crossed edge has its four cells.
  const ox = lo[0] - h, oy = lo[1] - h, oz = lo[2] - h;

  const sx = 1, sy = nx, sz = nx * ny;                 // sample strides

  // ── sample, skipping empty space ──────────────────────────────────────────
  //
  // The field is a distance, so ONE evaluation at a block's centre can prove the
  // surface is nowhere inside that block: if |d| exceeds the block's half
  // diagonal, nothing within reach of the centre is on the other side. Most of a
  // creature's bounding box is exactly that — an animal is a thin shell inside a
  // large empty box, and a sprawling one is mostly the gaps between its limbs.
  //
  // Two corrections to the naive test, and both are load-bearing:
  //   + h    covers the one-cell halo, so a sample on a block FACE — shared with
  //          a neighbour that may be evaluated exactly — still has a true sign.
  //   + k/4  smin can pull the field up to k/4 below min(a, b), so a value that
  //          looks far enough may be closer than it says. Underestimating the
  //          distance is safe; overestimating punches holes.
  const val = new Float32Array(nx * ny * nz);
  const grade = new Uint8Array(nx * ny * nz);
  const evalField = field.eval;
  const BIG = 1e3;
  const maxK = Math.max(...field.kBlend);
  // Infinity, not -1: the test is `|d| > margin`, so the value that disables
  // skipping is the one nothing exceeds. -1 disables nothing — it skips
  // EVERYTHING, and the reference path silently becomes the broken path.
  const margin = opts.skip === false
    ? Infinity
    : 0.5 * BLOCK * h * Math.sqrt(3) + h + 0.25 * maxK;
  let evals = 0;
  let signFlips = 0;   // must stay 0; a non-zero here means `margin` is too small

  for (let k0 = 0; k0 < nz; k0 += BLOCK) {
    const kEnd = Math.min(k0 + BLOCK, nz - 1);
    for (let j0 = 0; j0 < ny; j0 += BLOCK) {
      const jEnd = Math.min(j0 + BLOCK, ny - 1);
      for (let i0 = 0; i0 < nx; i0 += BLOCK) {
        const iEnd = Math.min(i0 + BLOCK, nx - 1);
        const dc = evalField(
          ox + (i0 + BLOCK * 0.5) * h,
          oy + (j0 + BLOCK * 0.5) * h,
          oz + (k0 + BLOCK * 0.5) * h,
        );
        evals++;
        if (Math.abs(dc) > margin) {
          const v = dc > 0 ? BIG : -BIG;
          for (let k = k0; k <= kEnd; k++) {
            for (let j = j0; j <= jEnd; j++) {
              let o = i0 * sx + j * sy + k * sz;
              for (let i = i0; i <= iEnd; i++, o += sx) {
                // Never downgrade a sample a neighbouring block already resolved.
                if (grade[o] === 0) { val[o] = v; grade[o] = COARSE; }
              }
            }
          }
        } else {
          for (let k = k0; k <= kEnd; k++) {
            const z = oz + k * h;
            for (let j = j0; j <= jEnd; j++) {
              const y = oy + j * h;
              let o = i0 * sx + j * sy + k * sz;
              for (let i = i0; i <= iEnd; i++, o += sx) {
                val[o] = evalField(ox + i * h, y, z);
                grade[o] = EXACT;
                evals++;
              }
            }
          }
        }
      }
    }
  }
  const tSample = performance.now();

  const cx = nx - 1, cy = ny - 1, cz = nz - 1;         // cell counts
  const cellVert = new Int32Array(cx * cy * cz).fill(-1);

  const positions = [];
  const normals = [];
  const skinIdx = [];
  const skinWgt = [];

  const cv = new Float32Array(8);
  const co = new Int32Array(8);
  const wIdx = new Uint16Array(4);
  const wWgt = new Float32Array(4);

  // ── one vertex per straddled cell ─────────────────────────────────────────
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        const base = i * sx + j * sy + k * sz;
        let mask = 0;
        let anyCoarse = false;
        for (let c = 0; c < 8; c++) {
          const o = base + (c & 1) * sx + ((c >> 1) & 1) * sy + ((c >> 2) & 1) * sz;
          co[c] = o;
          const v = val[o];
          cv[c] = v;
          if (v < 0) mask |= 1 << c;
          if (grade[o] === COARSE) anyCoarse = true;
        }
        if (mask === 0 || mask === 255) continue;

        // A straddled cell may still hold a block-filled corner, whose SIGN is
        // right and whose magnitude is a placeholder. Interpolating against
        // +/-1000 would snap the vertex onto that corner, so resolve it now. The
        // sign cannot change — the block test already proved this corner is more
        // than a cell from the surface — so the mask above stands.
        if (anyCoarse) {
          for (let c = 0; c < 8; c++) {
            const o = co[c];
            if (grade[o] !== COARSE) continue;
            const ii = i + (c & 1), jj = j + ((c >> 1) & 1), kk = k + ((c >> 2) & 1);
            const exact = evalField(ox + ii * h, oy + jj * h, oz + kk * h);
            if ((exact < 0) !== (val[o] < 0)) signFlips++;
            val[o] = exact;
            grade[o] = EXACT;
            evals++;
            cv[c] = exact;
          }
        }

        // Vertex = mean of the edge crossings. This is what makes surface nets
        // smooth: the point is fitted to the data, not snapped to an edge.
        let ax = 0, ay = 0, az = 0, count = 0;
        for (let e = 0; e < 12; e++) {
          const a = EDGES[e][0], b = EDGES[e][1];
          const va = cv[a], vb = cv[b];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          ax += (a & 1) + t * ((b & 1) - (a & 1));
          ay += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1));
          az += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
          count++;
        }
        const px = ox + (i + ax / count) * h;
        const py = oy + (j + ay / count) * h;
        const pz = oz + (k + az / count) * h;

        // Gradient of the field IS the outward normal: the field is negative
        // inside, so it increases outward.
        const d = h * 0.5;
        let gx = evalField(px + d, py, pz) - evalField(px - d, py, pz);
        let gy = evalField(px, py + d, pz) - evalField(px, py - d, pz);
        let gz = evalField(px, py, pz + d) - evalField(px, py, pz - d);
        const gl = Math.hypot(gx, gy, gz) || 1;
        gx /= gl; gy /= gl; gz /= gl;

        field.weightsAt(px, py, pz, wIdx, wWgt, 0);

        cellVert[i + j * cx + k * cx * cy] = positions.length / 3;
        positions.push(px, py, pz);
        normals.push(gx, gy, gz);
        skinIdx.push(wIdx[0], wIdx[1], wIdx[2], wIdx[3]);
        skinWgt.push(wWgt[0], wWgt[1], wWgt[2], wWgt[3]);
      }
    }
  }
  const tVerts = performance.now();

  // ── one quad per straddled grid edge ──────────────────────────────────────
  const index = [];

  let droppedQuads = 0;

  /** Two triangles over four cell vertices, each wound to agree with the
   *  gradient normal we already stored. */
  function quad(c0, c1, c2, c3) {
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) { droppedQuads++; return; }
    tri(c0, c1, c2);
    tri(c0, c2, c3);
  }
  function tri(a, b, c) {
    const a3 = a * 3, b3 = b * 3, c3 = c * 3;
    const ux = positions[b3] - positions[a3];
    const uy = positions[b3 + 1] - positions[a3 + 1];
    const uz = positions[b3 + 2] - positions[a3 + 2];
    const vx = positions[c3] - positions[a3];
    const vy = positions[c3 + 1] - positions[a3 + 1];
    const vz = positions[c3 + 2] - positions[a3 + 2];
    const fx = uy * vz - uz * vy;
    const fy = uz * vx - ux * vz;
    const fz = ux * vy - uy * vx;
    const nx0 = normals[a3] + normals[b3] + normals[c3];
    const ny0 = normals[a3 + 1] + normals[b3 + 1] + normals[c3 + 1];
    const nz0 = normals[a3 + 2] + normals[b3 + 2] + normals[c3 + 2];
    if (fx * nx0 + fy * ny0 + fz * nz0 < 0) index.push(a, c, b);
    else index.push(a, b, c);
  }

  const ci = (i, j, k) => cellVert[i + j * cx + k * cx * cy];

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const m = i * sx + j * sy + k * sz;
        const inside = val[m] < 0;
        // The four cells sharing a grid edge. Every index used must be a LEGAL
        // cell (0..c*-1) on all three axes — cellVert is a flat array, so an
        // index one past the end of a row is not out of bounds, it is a
        // different cell, and the resulting quad stitches two unrelated parts of
        // the animal together.
        if (i < cx && j > 0 && j < cy && k > 0 && k < cz && inside !== (val[m + sx] < 0)) {
          quad(ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k));
        }
        if (j < cy && i > 0 && i < cx && k > 0 && k < cz && inside !== (val[m + sy] < 0)) {
          quad(ci(i - 1, j, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i - 1, j, k));
        }
        if (k < cz && i > 0 && i < cx && j > 0 && j < cy && inside !== (val[m + sz] < 0)) {
          quad(ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k));
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIdx, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWgt, 4));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();

  const t1 = performance.now();
  return {
    geometry,
    stats: {
      grid: [nx, ny, nz],
      cell: h,
      coarsened,
      minRadius: rMin,
      inflated: field.rChar.reduce((k, r) => k + (r < rMin ? 1 : 0), 0),
      samples: nx * ny * nz,
      evals,
      signFlips,
      droppedQuads,
      skipped: 1 - evals / (nx * ny * nz),
      vertices: positions.length / 3,
      triangles: index.length / 3,
      msSample: tSample - t0,
      msVertices: tVerts - tSample,
      msQuads: t1 - tVerts,
      msTotal: t1 - t0,
    },
  };
}
