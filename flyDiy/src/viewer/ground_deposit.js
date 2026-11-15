// ground_deposit.js — THE MUD ON THE AEROPLANE, COMPUTED FROM ITS GEOMETRY (GROUND-FX, 2026-11-15).
//
// The user (15 Nov): "I also suspect the plane's projections to be a little slapped. I'd really want that we do some
// calculations for projecting on the right places, as a function of the actual plane geometry". Design:
// futureDesigns/GROUND-FX-2026-11-15.md section 3.
//
// What it replaces: aeroweather's WHEEL MUD CONE (a hand-shaped envelope aft and up of each tyre's contact, painting
// whatever faces down or forward inside it, with no occlusion) times one number for the flight. Here the mud lands where
// the thrown clods and drops actually HIT the drawn aeroplane:
//
//   THE GRID     GROUND_DEPOSIT.make(tris, opts) -> G: the drawn aeroplane voxelised in CRAFT SPACE (aeroweather's
//                vCraftPos: metres, x lateral, y AFT, z up), cell `h` m, only up to `reach` m above the lowest contact
//                (what thrown mud can reach). Each cell: 0 empty, 1 airframe, 2 a tyre (the throw's own source: a clod
//                leaves the tread through it, so it is not a target; the tyre's own dirt is aeroweather's wheel layer).
//                A triangle marks every cell its surface passes through (a barycentric lattice at h / 2: no gaps).
//                Any garage build: its meshes in, its grid out. Nothing hand-placed.
//   THE HITS     GROUND_DEPOSIT.collide(G, pool, toCraft, dt, k): each live clod / drop of the dust pool (dust.js's G
//                arrays: kind 2 clod, 5 drop) is moved back along its velocity by the frame's dt into its segment, the
//                segment taken into craft space (toCraft: the aeroplane root's inverse, a 4x4 column-major array, with
//                the axis map), and marched through the grid (3-D DDA, Amanatides & Woo 1987). The first airframe cell
//                is the hit: the particle dies there and its mud is deposited. What is behind it (a leg's lee, the stab
//                behind the flap) is shadowed BY what is in front, because the clods stop.
//   THE DEPOSIT  four channels a cell: the mud ARRIVING moving +z (up: it lands on what faces down), +y (aft: on what
//                faces forward), -x and +x (sideways: on the flanks facing it). A hit adds mass x the channel's share
//                of its direction (cos^2), spread over its cell's 3x3x3 neighbours (the fragment's own surface lies within
//                a cell of the hit). Mass = the particle's volume x the mud's wetness x its impact speed over 6 m/s
//                (a slow drop sticks less, INFERRED).
//   THE LOOK     GROUND_DEPOSIT.sample(G, p, n) = the shader's own arithmetic on the CPU (the gate's and the pictures'):
//                each channel times how squarely the surface faces the arrival (-n . b), summed, then 1 - e^(-D / D0).
//                A wing's top over a muddy underside faces away from every arrival: clean, whatever the cell holds.
//   WASH         GROUND_DEPOSIT.wash(G, dt, rain, waterZ): rain takes a share a second, faster on what faces up and out
//                (the channels' own facing), the undersides keep it; water takes everything under its line fast.
//
// Pure JS, no THREE: module.exports for the node gates (GATE MUDDEPOSIT), window.GROUND_DEPOSIT in the page.
'use strict';
(function () {
  const BINS = [[0, 0, 1], [0, 1, 0], [-1, 0, 0], [1, 0, 0]];   // the arrival directions: up, aft, to port (-x), to starboard (+x)
  const K = {
    D0: 0.15,         // the deposit (in units of a 1 cm clod's volume x wetness) that reads as 63 % cover: a drawn clod stands for the many a real tyre throws (CALIBRATED, 15 Nov: the stock Cub's 20 s soft-mud taxi + take-off cakes the hit zones as aeroMudStep's law does, m ~0.85)
    vRef: 6,          // m/s: the impact speed past which a clod sticks whole
    kern: [1, 0.55, 0.3, 0.18],   // the 3x3x3 spread by the neighbour's distance class (0 itself, 1 face, 2 edge, 3 corner)
    rain: 1 / 300,    // /s: steady rain (1) on an up-facing channel; the undersides x rainUnder
    rainUnder: 0.15,
    water: 1 / 6,     // /s: under the water's line
    maxMarch: 96,     // cells a segment may cross (a clod moves < 1 m a frame; a teleport is not a path)
  };
  const DEF = { h: 0.08, reach: 2.2, pad: 0.12 };

  // ---- THE GRID ------------------------------------------------------------------------------------------------------
  // tris: Float32Array / Array of 9 numbers a triangle (craft space); part: Uint8Array a triangle (1 airframe, 2 tyre)
  function make(tris, part, opts) {
    const o = Object.assign({}, DEF, opts || {}), h = o.h, nT = Math.floor(tris.length / 9);
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let i = 0; i < nT * 9; i += 3) {
      const x = tris[i], y = tris[i + 1], z = tris[i + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    if (!(nT > 0)) return null;
    const zLow = o.zLow != null ? o.zLow : z0;             // the lowest contact (the tyres' bottom)
    z1 = Math.min(z1, zLow + o.reach);
    x0 -= o.pad; y0 -= o.pad; z0 -= o.pad; x1 += o.pad; y1 += o.pad; z1 += o.pad;
    const nx = Math.max(1, Math.ceil((x1 - x0) / h)), ny = Math.max(1, Math.ceil((y1 - y0) / h)), nz = Math.max(1, Math.ceil((z1 - z0) / h));
    const N = nx * ny * nz;
    const G = { h, nx, ny, nz, N, o: [x0, y0, z0], occ: new Uint8Array(N), dep: new Float32Array(N * 4), hits: 0, mass: 0, dirty: [nx, ny, nz, -1, -1, -1], ver: 0 };
    // rasterise: a barycentric lattice fine enough that no cell the surface crosses is missed (step <= h / 2)
    const ih = 1 / h;
    const mark = (x, y, z, p) => {
      const i = Math.floor((x - x0) * ih), j = Math.floor((y - y0) * ih), k = Math.floor((z - z0) * ih);
      if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return;
      const c = (k * ny + j) * nx + i;
      if (G.occ[c] !== 1) G.occ[c] = p;                    // (the airframe wins a cell it shares with a tyre)
    };
    for (let t = 0; t < nT; t++) {
      const b = t * 9, p = part ? part[t] || 1 : 1;
      const ax = tris[b], ay = tris[b + 1], az = tris[b + 2], ux = tris[b + 3] - ax, uy = tris[b + 4] - ay, uz = tris[b + 5] - az,
            vx = tris[b + 6] - ax, vy = tris[b + 7] - ay, vz = tris[b + 8] - az;
      const lu = Math.hypot(ux, uy, uz), lv = Math.hypot(vx, vy, vz), lw = Math.hypot(vx - ux, vy - uy, vz - uz);
      const n = Math.min(400, Math.ceil(Math.max(lu, lv, lw) * 2 * ih));
      if (n <= 1) { mark(ax, ay, az, p); mark(ax + ux, ay + uy, az + uz, p); mark(ax + vx, ay + vy, az + vz, p); mark(ax + (ux + vx) / 3, ay + (uy + vy) / 3, az + (uz + vz) / 3, p); continue; }
      const s = 1 / n;
      for (let a = 0; a <= n; a++) for (let c = 0; c <= n - a; c++) {
        const fa = a * s, fc = c * s;
        mark(ax + ux * fa + vx * fc, ay + uy * fa + vy * fc, az + uz * fa + vz * fc, p);
      }
    }
    let occ = 0; for (let c = 0; c < N; c++) if (G.occ[c] === 1) occ++;
    G.occupied = occ;
    return G;
  }

  // ---- THE MARCH: the first airframe cell a segment (craft space) crosses, or -1 ----------------------------------------
  function march(G, ax, ay, az, bx, by, bz) {
    const h = G.h, ih = 1 / h, ox = G.o[0], oy = G.o[1], oz = G.o[2];
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    // clip the segment to the grid's box (slabs)
    let t0 = 0, t1 = 1;
    const ext = [G.nx * h, G.ny * h, G.nz * h], P = [ax - ox, ay - oy, az - oz], D = [dx, dy, dz];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(D[a]) < 1e-12) { if (P[a] < 0 || P[a] >= ext[a]) return -1; continue; }
      let ta = (0 - P[a]) / D[a], tb = (ext[a] - P[a]) / D[a];
      if (ta > tb) { const q = ta; ta = tb; tb = q; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
      if (t0 > t1) return -1;
    }
    const sx = P[0] + D[0] * t0, sy = P[1] + D[1] * t0, sz = P[2] + D[2] * t0;
    let i = Math.min(G.nx - 1, Math.max(0, Math.floor(sx * ih))), j = Math.min(G.ny - 1, Math.max(0, Math.floor(sy * ih))), k = Math.min(G.nz - 1, Math.max(0, Math.floor(sz * ih)));
    const stX = dx > 0 ? 1 : -1, stY = dy > 0 ? 1 : -1, stZ = dz > 0 ? 1 : -1;
    const len = t1 - t0;
    const tdX = dx !== 0 ? Math.abs(h / dx) : Infinity, tdY = dy !== 0 ? Math.abs(h / dy) : Infinity, tdZ = dz !== 0 ? Math.abs(h / dz) : Infinity;
    let tmX = dx !== 0 ? ((dx > 0 ? (i + 1) * h - sx : sx - i * h) / Math.abs(dx)) : Infinity;
    let tmY = dy !== 0 ? ((dy > 0 ? (j + 1) * h - sy : sy - j * h) / Math.abs(dy)) : Infinity;
    let tmZ = dz !== 0 ? ((dz > 0 ? (k + 1) * h - sz : sz - k * h) / Math.abs(dz)) : Infinity;
    for (let s = 0; s < K.maxMarch; s++) {
      const c = (k * G.ny + j) * G.nx + i;
      if (G.occ[c] === 1) return c;
      if (tmX < tmY && tmX < tmZ) { if (tmX > len) return -1; i += stX; tmX += tdX; if (i < 0 || i >= G.nx) return -1; }
      else if (tmY < tmZ) { if (tmY > len) return -1; j += stY; tmY += tdY; if (j < 0 || j >= G.ny) return -1; }
      else { if (tmZ > len) return -1; k += stZ; tmZ += tdZ; if (k < 0 || k >= G.nz) return -1; }
    }
    return -1;
  }

  // ---- THE DEPOSIT: mass m arriving along (dx, dy, dz) (craft, any length) into cell c and its 26 neighbours ------------
  const W4 = [0, 0, 0, 0];
  function deposit(G, c, dx, dy, dz, m) {
    const l = Math.hypot(dx, dy, dz) || 1, ux = dx / l, uy = dy / l, uz = dz / l;
    let ws = 0;
    for (let b = 0; b < 4; b++) { const B = BINS[b], d = ux * B[0] + uy * B[1] + uz * B[2]; W4[b] = d > 0 ? d * d : 0; ws += W4[b]; }
    if (ws < 1e-6) return;                                 // (arriving down or forward: no channel holds it - rare, and it would land on tops)
    for (let b = 0; b < 4; b++) W4[b] /= ws;
    const nx = G.nx, ny = G.ny, nz = G.nz, i0 = c % nx, j0 = Math.floor(c / nx) % ny, k0 = Math.floor(c / (nx * ny));
    for (let dk = -1; dk <= 1; dk++) { const k = k0 + dk; if (k < 0 || k >= nz) continue;
      for (let dj = -1; dj <= 1; dj++) { const j = j0 + dj; if (j < 0 || j >= ny) continue;
        for (let di = -1; di <= 1; di++) { const i = i0 + di; if (i < 0 || i >= nx) continue;
          const w = K.kern[(di !== 0) + (dj !== 0) + (dk !== 0)] * m, q = ((k * ny + j) * nx + i) * 4;
          G.dep[q] += w * W4[0]; G.dep[q + 1] += w * W4[1]; G.dep[q + 2] += w * W4[2]; G.dep[q + 3] += w * W4[3];
        } } }
    const D = G.dirty;
    if (i0 - 1 < D[0]) D[0] = Math.max(0, i0 - 1); if (j0 - 1 < D[1]) D[1] = Math.max(0, j0 - 1); if (k0 - 1 < D[2]) D[2] = Math.max(0, k0 - 1);
    if (i0 + 1 > D[3]) D[3] = Math.min(nx - 1, i0 + 1); if (j0 + 1 > D[4]) D[4] = Math.min(ny - 1, j0 + 1); if (k0 + 1 > D[5]) D[5] = Math.min(nz - 1, k0 + 1);
    G.hits++; G.mass += m; G.ver++;
  }

  // ---- THE HITS: the dust pool's clods and drops against the grid -------------------------------------------------------
  // pool: dust.js's sys.G ({ p, v, s, age, life, kind, n }); toCraft: 16 numbers, column-major (THREE's Matrix4.elements),
  // world -> craft space (the axis map folded in, as aeroweather's uCraftInv); vPlane: the aeroplane's world velocity (the
  // particle's speed relative to it is the impact's); wet: the mud's water (0..1); k: a strength. Returns the hits.
  function collide(G, pool, toCraft, vPlane, dt, wet, k) {
    if (!G || !pool || !(dt > 0)) return 0;
    const e = toCraft, P = pool.p, V = pool.v;
    let n = 0;
    for (let q = 0; q < pool.n; q++) {
      if (pool.age[q] >= pool.life[q]) continue;
      const kd = pool.kind[q];
      if (kd !== 2 && kd !== 5 && kd !== 4) continue;     // clods, drops, snow clumps (grit and dust do not stick)
      const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2];
      // the segment this frame, relative to the aeroplane (both moved: the aeroplane's own motion taken out)
      const rvx = V[q * 3] - vPlane[0], rvy = V[q * 3 + 1] - vPlane[1], rvz = V[q * 3 + 2] - vPlane[2];
      const bx = e[0] * x + e[4] * y + e[8] * z + e[12], by = e[1] * x + e[5] * y + e[9] * z + e[13], bz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const dX = e[0] * rvx + e[4] * rvy + e[8] * rvz, dY = e[1] * rvx + e[5] * rvy + e[9] * rvz, dZ = e[2] * rvx + e[6] * rvy + e[10] * rvz;
      const ax = bx - dX * dt, ay = by - dY * dt, az = bz - dZ * dt;
      const c = march(G, ax, ay, az, bx, by, bz);
      if (c < 0) continue;
      const sp = Math.hypot(dX, dY, dZ), s = pool.s[q];
      const m = (s * s * s / 1e-6) * (0.25 + 0.75 * wet) * Math.min(1, sp / K.vRef) * (kd === 5 ? 0.6 : 1) * (k != null ? k : 1);
      deposit(G, c, dX, dY, dZ, m);
      pool.age[q] = pool.life[q];                          // it stuck (or broke up on the skin)
      n++;
    }
    return n;
  }

  // ---- THE LOOK (the shader's arithmetic): cover 0..1 at craft point p with outward normal n ----------------------------
  function sample(G, px, py, pz, nx, ny, nz) {
    const h = G.h, fx = (px - G.o[0]) / h - 0.5, fy = (py - G.o[1]) / h - 0.5, fz = (pz - G.o[2]) / h - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), tx = fx - i, ty = fy - j, tz = fz - k;
    // (the texture holds each channel's COVER, 1 - e^(-D/D0), filtered trilinearly: the same here)
    const cv = d => 1 - Math.exp(-d / K.D0);
    let d0 = 0, d1 = 0, d2 = 0, d3 = 0;
    for (let c = 0; c < 8; c++) {
      const ii = i + (c & 1), jj = j + ((c >> 1) & 1), kk = k + ((c >> 2) & 1);
      if (ii < 0 || jj < 0 || kk < 0 || ii >= G.nx || jj >= G.ny || kk >= G.nz) continue;
      const w = ((c & 1) ? tx : 1 - tx) * (((c >> 1) & 1) ? ty : 1 - ty) * (((c >> 2) & 1) ? tz : 1 - tz), q = ((kk * G.ny + jj) * G.nx + ii) * 4;
      d0 += w * cv(G.dep[q]); d1 += w * cv(G.dep[q + 1]); d2 += w * cv(G.dep[q + 2]); d3 += w * cv(G.dep[q + 3]);
    }
    return look(d0, d1, d2, d3, nx, ny, nz);
  }
  // how squarely a surface of normal n faces an arrival b: (-n . b) eased, 0 when it faces away
  const face = d => (d > 0 ? Math.min(1, d * 1.15) : 0);
  // the four channels' covers (0..1) on a surface of normal n: each arrival covers what faces it, independently
  function look(c0, c1, c2, c3, nx, ny, nz) {
    return 1 - (1 - c0 * face(-nz)) * (1 - c1 * face(-ny)) * (1 - c2 * face(nx)) * (1 - c3 * face(-nx));
  }

  // ---- WASH: rain (0..1) and water under craft z waterZ (null: none) ----------------------------------------------------
  function wash(G, dt, rain, waterZ) {
    if (!G || !(dt > 0)) return;
    const r = rain > 0 ? rain * K.rain * dt : 0;
    const kw = waterZ != null ? Math.min(1, K.water * dt) : 0;
    if (!(r > 0) && !(kw > 0)) return;
    const h = G.h, nx = G.nx, ny = G.ny;
    // rain falls on what faces up and out: the up-arrival (undersides) keeps it best, the sideways ones less, the aft one
    // (fronts of legs, leading edges) between
    const rk = [r * K.rainUnder, r * 0.6, r * 0.8, r * 0.8];
    for (let k = 0; k < G.nz; k++) {
      const under = kw > 0 && G.o[2] + (k + 0.5) * h < waterZ;
      for (let c = k * nx * ny, e = c + nx * ny; c < e; c++) {
        const q = c * 4;
        if (G.dep[q] + G.dep[q + 1] + G.dep[q + 2] + G.dep[q + 3] === 0) continue;
        for (let b = 0; b < 4; b++) G.dep[q + b] *= 1 - (under ? kw : rk[b]);
      }
    }
    G.dirty[0] = 0; G.dirty[1] = 0; G.dirty[2] = 0; G.dirty[3] = nx - 1; G.dirty[4] = ny - 1; G.dirty[5] = G.nz - 1;
    G.ver++;
  }
  function clear(G) { if (!G) return; G.dep.fill(0); G.hits = 0; G.mass = 0; G.ver++; }
  // the coat's one number (aeroMudStep's m, the readers of it): the mean cover over the airframe cells that hold any
  function total(G) {
    if (!G) return 0;
    let s = 0;
    for (let c = 0; c < G.N; c++) if (G.occ[c] === 1) { const q = c * 4, D = G.dep[q] + G.dep[q + 1] + G.dep[q + 2] + G.dep[q + 3]; s += 1 - Math.exp(-D / K.D0); }
    return G.occupied ? s / G.occupied : 0;
  }
  // the texture's bytes (RGBA8 a cell: each channel as 1 - e^(-D/D0) x 255, so the shader's sum stays in range); into out
  function bytes(G, out) {
    const o = out || new Uint8Array(G.N * 4);
    for (let q = 0; q < G.N * 4; q++) o[q] = Math.min(255, Math.round(255 * (1 - Math.exp(-G.dep[q] / K.D0))));
    return o;
  }

  const GROUND_DEPOSIT = { K, BINS, make, march, deposit, collide, sample, look, wash, clear, total, bytes };
  if (typeof window !== 'undefined') window.GROUND_DEPOSIT = GROUND_DEPOSIT;
  if (typeof module !== 'undefined' && module.exports) module.exports = GROUND_DEPOSIT;
})();
