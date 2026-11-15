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
    // THE DUST FILM (the user, 15 Nov: "when you have dry dirt and it makes huge clouds, then really up to the fin you have
    // everything more or less in a linear shape from the wheels, but also of the engine"): rays from the live puffs, carried by
    // the air relative to the aeroplane, a turbulent jitter so they graze the belly and the flanks
    D0d: 0.15,        // the film's deposit that reads as 63 % (CALIBRATED 15 Nov: the stock Cub's 20 s dry-dirt taxi + take-off films the gear ~0.9, the belly and the stab ~0.3-0.4, the fin ~0.15 - "up to the fin ... more or less in a linear shape")
    kDust: 1.0, rays: 128, rayL: 1.5, jitter: 0.18,
    // WET AND DRY (the PBR's roughness): fresh mud is the throw's water; it dries over tDry s in the open, rain re-wets it
    tDry: 300, kRewet: 1 / 40, rainDust: 1 / 60,
  };
  const DEF = { h: 0.08, reach: 4.0, pad: 0.12 };   // (reach: the whole tail - heavy mud and the dust reach the fin, the user 15 Nov)

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
    const G = { h, nx, ny, nz, N, o: [x0, y0, z0], occ: new Uint8Array(N), dep: new Float32Array(N * 4), dust: new Float32Array(N), wet: new Float32Array(N), hits: 0, mass: 0, rayHits: 0, dustMass: 0, dirty: [nx, ny, nz, -1, -1, -1], ver: 0 };
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
  function deposit(G, c, dx, dy, dz, m, wet) {
    const wh = wet != null ? wet : 1;
    const l = Math.hypot(dx, dy, dz) || 1, ux = dx / l, uy = dy / l, uz = dz / l;
    let ws = 0;
    for (let b = 0; b < 4; b++) { const B = BINS[b], d = ux * B[0] + uy * B[1] + uz * B[2]; W4[b] = d > 0 ? d * d : 0; ws += W4[b]; }
    if (ws < 1e-6) return;                                 // (arriving down or forward: no channel holds it - rare, and it would land on tops)
    for (let b = 0; b < 4; b++) W4[b] /= ws;
    const nx = G.nx, ny = G.ny, nz = G.nz, i0 = c % nx, j0 = Math.floor(c / nx) % ny, k0 = Math.floor(c / (nx * ny));
    for (let dk = -1; dk <= 1; dk++) { const k = k0 + dk; if (k < 0 || k >= nz) continue;
      for (let dj = -1; dj <= 1; dj++) { const j = j0 + dj; if (j < 0 || j >= ny) continue;
        for (let di = -1; di <= 1; di++) { const i = i0 + di; if (i < 0 || i >= nx) continue;
          const w = K.kern[(di !== 0) + (dj !== 0) + (dk !== 0)] * m, cc = (k * ny + j) * nx + i, q = cc * 4;
          const D = G.dep[q] + G.dep[q + 1] + G.dep[q + 2] + G.dep[q + 3];
          G.wet[cc] = (G.wet[cc] * D + wh * w) / (D + w);       // (the fresh mud's water, by its share of the cell's mud)
          G.dep[q] += w * W4[0]; G.dep[q + 1] += w * W4[1]; G.dep[q + 2] += w * W4[2]; G.dep[q + 3] += w * W4[3];
        } } }
    const D = G.dirty;
    if (i0 - 1 < D[0]) D[0] = Math.max(0, i0 - 1); if (j0 - 1 < D[1]) D[1] = Math.max(0, j0 - 1); if (k0 - 1 < D[2]) D[2] = Math.max(0, k0 - 1);
    if (i0 + 1 > D[3]) D[3] = Math.min(nx - 1, i0 + 1); if (j0 + 1 > D[4]) D[4] = Math.min(ny - 1, j0 + 1); if (k0 + 1 > D[5]) D[5] = Math.min(nz - 1, k0 + 1);
    G.hits++; G.mass += m; G.ver++;
  }

  function dirtyAt(G, c) {
    const nx = G.nx, ny = G.ny, i0 = c % nx, j0 = Math.floor(c / nx) % ny, k0 = Math.floor(c / (nx * ny)), D = G.dirty;
    if (i0 - 1 < D[0]) D[0] = Math.max(0, i0 - 1); if (j0 - 1 < D[1]) D[1] = Math.max(0, j0 - 1); if (k0 - 1 < D[2]) D[2] = Math.max(0, k0 - 1);
    if (i0 + 1 > D[3]) D[3] = Math.min(nx - 1, i0 + 1); if (j0 + 1 > D[4]) D[4] = Math.min(ny - 1, j0 + 1); if (k0 + 1 > D[5]) D[5] = Math.min(G.nz - 1, k0 + 1);
  }
  // ---- THE DUST FILM: rays from the live puffs near the aeroplane, carried by the air (air(x, y, z) -> the air's world
  // velocity: the slipstream, the wind; null = still) relative to the aeroplane, marched through the grid; a hit films its cell
  // and its neighbours by the puff's concentration there x the air's swept share. P: dust.js's sys.P; rng: 0..1
  const RV = [0, 0, 0];
  function dustRays(G, P, toCraft, vPlane, air, dt, k, rng) {
    if (!G || !P || !(dt > 0)) return 0;
    const e = toCraft, h = G.h, bx0 = G.o[0], by0 = G.o[1], bz0 = G.o[2], bx1 = bx0 + G.nx * h, by1 = by0 + G.ny * h, bz1 = bz0 + G.nz * h;
    const R = rng || Math.random;
    // the puffs that overlap the grid's box (their centre in craft space, the box grown by their size)
    let n = 0; const cand = dustRays.cand || (dustRays.cand = []); cand.length = 0;
    for (let i = 0; i < P.n; i++) {
      if (P.age[i] < 0 || !(P.tau[i] > 1e-4)) continue;
      const x = P.p[i * 3], y = P.p[i * 3 + 1], z = P.p[i * 3 + 2], r = Math.max(P.r[i], 0.3), rv = Math.max(P.rv[i], 0.3);
      const cx = e[0] * x + e[4] * y + e[8] * z + e[12], cy = e[1] * x + e[5] * y + e[9] * z + e[13], cz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const g = Math.max(r, rv) + K.rayL;
      if (cx < bx0 - g || cx > bx1 + g || cy < by0 - g || cy > by1 + g || cz < bz0 - g || cz > bz1 + g) continue;
      cand.push(i); n++;
    }
    if (!n) return 0;
    const per = Math.max(1, Math.floor(K.rays / n));
    let hits = 0;
    for (const i of cand) {
      const x0 = P.p[i * 3], y0 = P.p[i * 3 + 1], z0 = P.p[i * 3 + 2], r = Math.max(P.r[i], 0.3), rv = Math.max(P.rv[i], 0.3), tau = P.tau[i];
      const vol = 4.18879 * r * r * rv;                        // the ellipsoid's volume (4/3 pi r r rv)
      for (let j = 0; j < per; j++) {
        // a point in the ellipsoid (a cube's, rejected outside the ball)
        let u1, u2, u3, d2; do { u1 = 2 * R() - 1; u2 = 2 * R() - 1; u3 = 2 * R() - 1; d2 = u1 * u1 + u2 * u2 + u3 * u3; } while (d2 > 1);
        const x = x0 + u1 * r, y = y0 + u2 * rv, z = z0 + u3 * r;
        if (y < 0.02 + (y0 - rv * 0.32)) continue;              // (under the dome's foot: in the ground)
        const conc = tau / r * Math.exp(-2 * d2);              // the dust a metre of air there (the puff's Gaussian, its centre's depth over its size)
        const a = air ? air(x, y, z) : null;
        let ux = (a ? a[0] : 0) - vPlane[0], uy = (a ? a[1] : 0) - vPlane[1], uz = (a ? a[2] : 0) - vPlane[2];
        const sp = Math.hypot(ux, uy, uz); if (sp < 0.3) continue;
        const jt = K.jitter * sp; ux += (2 * R() - 1) * jt; uy += (2 * R() - 1) * jt * 0.6; uz += (2 * R() - 1) * jt;
        // into craft space; a ray of length L along the flow, its weight the share of L the air sweeps this frame
        const sx = e[0] * x + e[4] * y + e[8] * z + e[12], sy = e[1] * x + e[5] * y + e[9] * z + e[13], sz = e[2] * x + e[6] * y + e[10] * z + e[14];
        const dX = e[0] * ux + e[4] * uy + e[8] * uz, dY = e[1] * ux + e[5] * uy + e[9] * uz, dZ = e[2] * ux + e[6] * uy + e[10] * uz, dl = Math.hypot(dX, dY, dZ) || 1;
        const L = Math.max(sp * dt, K.rayL), f = sp * dt / L;
        const c = march(G, sx, sy, sz, sx + dX / dl * L, sy + dY / dl * L, sz + dZ / dl * L);
        if (c < 0) continue;
        // (a ray born inside the airframe's own cell is no hit)
        const ci = Math.floor((sx - bx0) / h), cj = Math.floor((sy - by0) / h), ck = Math.floor((sz - bz0) / h);
        if (c === (ck * G.ny + cj) * G.nx + ci) continue;
        const m = K.kDust * (k != null ? k : 1) * conc * f * vol / per;
        filmAt(G, c, m); hits++;
      }
    }
    G.rayHits += hits;
    return hits;
  }
  function filmAt(G, c, m) {
    const nx = G.nx, ny = G.ny, nz = G.nz, i0 = c % nx, j0 = Math.floor(c / nx) % ny, k0 = Math.floor(c / (nx * ny));
    for (let dk = -1; dk <= 1; dk++) { const k = k0 + dk; if (k < 0 || k >= nz) continue;
      for (let dj = -1; dj <= 1; dj++) { const j = j0 + dj; if (j < 0 || j >= ny) continue;
        for (let di = -1; di <= 1; di++) { const i = i0 + di; if (i < 0 || i >= nx) continue;
          G.dust[(k * ny + j) * nx + i] += K.kern[(di !== 0) + (dj !== 0) + (dk !== 0)] * m; } } }
    dirtyAt(G, c); G.dustMass += m; G.ver++;
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
      const m = (s * s * s / 1e-6) * (0.25 + 0.75 * wet) * Math.min(1, sp / K.vRef) * (kd === 5 ? 0.6 : 1) * (k != null ? k : 1) * (pool.w ? pool.w[q] : 1);   // (w: the real throw a drawn one stands for)
      deposit(G, c, dX, dY, dZ, m, wet);
      pool.age[q] = pool.life[q];                          // it stuck (or broke up on the skin)
      n++;
    }
    return n;
  }

  // ---- THE SMOOTHED COVER (what the texture holds): each channel's cover 1 - e^(-D/D0), blurred so a hit never draws as its
  // voxel (A0, 15 Nov: the first pictures' belly "hard voxel squares"). A NORMALISED blur over the AIRFRAME's cells only
  // (sum of w c / sum of w, w = 1 on an airframe cell): the mud spreads along the skin, never into the air round it - a plain
  // blur thinned a 4 cm leg's mud by a third. [1 2 1] / 4 twice an axis = [1 4 6 4 1] / 16 (one pass left a full-to-empty
  // step at 0.5 a cell). An empty cell next to the skin takes its neighbours' value, so the trilinear read at a fragment on
  // the skin sees the skin's. box: [i0, j0, k0, i1, j1, k1], the dirty cells (all when absent) -> G.cov (Float32, N x 4)
  function smooth(G, box) {
    const nx = G.nx, ny = G.ny, nz = G.nz, N4 = G.N * 4, F = 7;   // (a cell: the 4 mud covers, the dust film's, the wetness, the weight)
    if (!G.cov) { G.cov = new Float32Array(N4); G.cov2 = new Float32Array(G.N * 2); G._t = new Float32Array(G.N * F); G._u = new Float32Array(G.N * F); box = null; }
    // a hit changes its kernel (the dirty box) and the blur reaches 2 cells further; the reads 2 more (stale beyond: unused)
    const B = box ? [Math.max(0, box[0] - 2), Math.max(0, box[1] - 2), Math.max(0, box[2] - 2), Math.min(nx - 1, box[3] + 2), Math.min(ny - 1, box[4] + 2), Math.min(nz - 1, box[5] + 2)]
                  : [0, 0, 0, nx - 1, ny - 1, nz - 1];
    if (B[3] < B[0]) return G.cov;
    const A = G.cov, A2 = G.cov2, T = G._t, U = G._u, D0 = K.D0;
    const lo = [Math.max(0, B[0] - 2), Math.max(0, B[1] - 2), Math.max(0, B[2] - 2)], hi = [Math.min(nx - 1, B[3] + 2), Math.min(ny - 1, B[4] + 2), Math.min(nz - 1, B[5] + 2)];
    for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) {
      const c = (k * ny + j) * nx + i, q = c * 4, t = c * F, w = G.occ[c] === 1 ? 1 : 0;
      for (let b = 0; b < 4; b++) T[t + b] = w ? 1 - Math.exp(-G.dep[q + b] / D0) : 0;
      T[t + 4] = w ? 1 - Math.exp(-G.dust[c] / K.D0d) : 0; T[t + 5] = w ? G.wet[c] : 0;
      T[t + 6] = w;
    }
    const pass = (src, dst, ax) => {
      const st = ax === 0 ? F : ax === 1 ? nx * F : nx * ny * F, n = ax === 0 ? nx : ax === 1 ? ny : nz;
      for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) {
        const t = ((k * ny + j) * nx + i) * F, at = ax === 0 ? i : ax === 1 ? j : k;
        const tm = at > (ax === 0 ? lo[0] : ax === 1 ? lo[1] : lo[2]) ? t - st : t, tp = at < (ax === 0 ? hi[0] : ax === 1 ? hi[1] : hi[2]) ? t + st : t;
        for (let b = 0; b < F; b++) dst[t + b] = 0.25 * src[tm + b] + 0.5 * src[t + b] + 0.25 * src[tp + b];
      }
    };
    pass(T, U, 0); pass(U, T, 1); pass(T, U, 2); pass(U, T, 0); pass(T, U, 1); pass(U, T, 2);
    for (let k = B[2]; k <= B[5]; k++) for (let j = B[1]; j <= B[4]; j++) for (let i = B[0]; i <= B[3]; i++) {
      const c = (k * ny + j) * nx + i, q = c * 4, t = c * F, w = T[t + 6];
      if (w > 0.02) { for (let b = 0; b < 4; b++) A[q + b] = Math.min(1, T[t + b] / w); A2[c * 2] = Math.min(1, T[t + 4] / w); A2[c * 2 + 1] = Math.min(1, T[t + 5] / w); }
      else { A[q] = A[q + 1] = A[q + 2] = A[q + 3] = 0; A2[c * 2] = A2[c * 2 + 1] = 0; }
    }
    G.covVer = G.ver;
    return A;
  }

  // ---- THE LOOK (the shader's arithmetic): cover 0..1 at craft point p with outward normal n ----------------------------
  // smooth: the texture's cover (G.cov, trilinear) when it is up to date, else the raw deposit's
  function sample(G, px, py, pz, nx, ny, nz) {
    const h = G.h, fx = (px - G.o[0]) / h - 0.5, fy = (py - G.o[1]) / h - 0.5, fz = (pz - G.o[2]) / h - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), tx = fx - i, ty = fy - j, tz = fz - k;
    const C = G.cov && G.covVer === G.ver ? G.cov : null, D0 = K.D0;
    let d0 = 0, d1 = 0, d2 = 0, d3 = 0;
    for (let c = 0; c < 8; c++) {
      const ii = i + (c & 1), jj = j + ((c >> 1) & 1), kk = k + ((c >> 2) & 1);
      if (ii < 0 || jj < 0 || kk < 0 || ii >= G.nx || jj >= G.ny || kk >= G.nz) continue;
      const w = ((c & 1) ? tx : 1 - tx) * (((c >> 1) & 1) ? ty : 1 - ty) * (((c >> 2) & 1) ? tz : 1 - tz), q = ((kk * G.ny + jj) * G.nx + ii) * 4;
      if (C) { d0 += w * C[q]; d1 += w * C[q + 1]; d2 += w * C[q + 2]; d3 += w * C[q + 3]; }
      else { d0 += w * (1 - Math.exp(-G.dep[q] / D0)); d1 += w * (1 - Math.exp(-G.dep[q + 1] / D0)); d2 += w * (1 - Math.exp(-G.dep[q + 2] / D0)); d3 += w * (1 - Math.exp(-G.dep[q + 3] / D0)); }
    }
    return look(d0, d1, d2, d3, nx, ny, nz);
  }
  // the second texture's two channels at p (dust film's cover, mud's wetness), trilinear; out: [dust, wet]
  const S2 = [0, 0];
  function sample2(G, px, py, pz) {
    S2[0] = S2[1] = 0;
    const C = G.cov2 && G.covVer === G.ver ? G.cov2 : null;
    const h = G.h, fx = (px - G.o[0]) / h - 0.5, fy = (py - G.o[1]) / h - 0.5, fz = (pz - G.o[2]) / h - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), tx = fx - i, ty = fy - j, tz = fz - k;
    for (let c = 0; c < 8; c++) {
      const ii = i + (c & 1), jj = j + ((c >> 1) & 1), kk = k + ((c >> 2) & 1);
      if (ii < 0 || jj < 0 || kk < 0 || ii >= G.nx || jj >= G.ny || kk >= G.nz) continue;
      const w = ((c & 1) ? tx : 1 - tx) * (((c >> 1) & 1) ? ty : 1 - ty) * (((c >> 2) & 1) ? tz : 1 - tz), cc = (kk * G.ny + jj) * G.nx + ii;
      if (C) { S2[0] += w * C[cc * 2]; S2[1] += w * C[cc * 2 + 1]; } else { S2[0] += w * (1 - Math.exp(-G.dust[cc] / K.D0d)); S2[1] += w * G.wet[cc]; }
    }
    return S2;
  }

  // ---- THE SPATTER: the cover broken into streaks along the airflow and flecks (A0, 15 Nov: "mud reads as spatter streaks
  // along the airflow, not cubes"). A value noise in craft space, STRETCHED along y (aft: the airflow over a moving
  // aeroplane, and the throw's own direction), ~4 cm across and ~20 cm along, with a fleck octave; the cover ERODES it
  // (alpha erosion): full cover is solid, a thin one is a few streaks, a trace is flecks - never a fade of a whole cell.
  // GLSL mirrors this (the hash, the octaves, the smoothstep) in aeroweather.
  const fr = x => x - Math.floor(x);
  const hs = (x, y, z) => fr(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
  function vn(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let fx = x - ix, fy = y - iy, fz = z - iz; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hs(ix, iy, iz), hs(ix + 1, iy, iz), fx), l(hs(ix, iy + 1, iz), hs(ix + 1, iy + 1, iz), fx), fy),
             l(l(hs(ix, iy, iz + 1), hs(ix + 1, iy, iz + 1), fx), l(hs(ix, iy + 1, iz + 1), hs(ix + 1, iy + 1, iz + 1), fx), fy), fz);
  }
  // (the lattice SHEARED - x and z lean with y - so the stretched noise's cells never line up with the body's axes: an
  // axis-aligned stretch drew stair-steps, 15 Nov)
  const SP = { fx: 22, fy: 7, ff: 70, ffy: 20, sh: 0.9, w: 0.55, edge: 0.12, spread: 2.08 };
  function spatter(x, y, z) {
    const X = x * SP.fx + y * SP.sh, Z = z * SP.fx - y * SP.sh * 0.7, Y = y * SP.fy + (x + z) * 1.3;
    const n = SP.w * vn(X, Y, Z) + (1 - SP.w) * vn(x * SP.ff + y * 2.1 + 31.7, y * SP.ffy + (x - z) * 3.1 - 7.3, z * SP.ff - y * 1.7 + 11.1);
    // spread to ~uniform on 0..1 (the two octaves' sum bunches round 0.5: 5-95 % in 0.28-0.72, measured): so the eroded
    // cover's MEAN is the cover itself (a thin coat stays a thin coat of flecks, not nothing; GATE MUDDEPOSIT F3)
    const u = 0.5 + (n - 0.5) * SP.spread;
    return u < 0 ? 0 : u > 1 ? 1 : u;
  }
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function erode(c, n) { return c <= 0 ? 0 : sstep(n - SP.edge, n + SP.edge, c); }
  // the drawn mud at a point: the smoothed cover, eroded by the spatter
  function mudAt(G, px, py, pz, nx, ny, nz) { const c = sample(G, px, py, pz, nx, ny, nz); return c > 0.003 ? erode(c, spatter(px, py, pz)) : 0; }
  // ---- THE PBR (the user, 15 Nov: "Let's not forget to work diffuse, but also roughness and normals to have full PBR"): what
  // the shader draws at a point, from the two textures and the spatter -
  //   mud    the eroded mud cover (albedo toward the ground's mud colour, darker wet: x (0.55 + 0.45 dry))
  //   dust   the film (albedo toward the ground's dust colour, a light veil; a top face takes a third of it - the film rides
  //          the flow under and along, a cloud above is the rare case)
  //   rough  mud: 0.25 wet (glossy) -> 0.9 dry (matte, cracked); dust 0.95; mixed over the base's by their covers
  //   h      the BUMP's height (m-ish, 0..1 x PBR.bump): the mud's thickness - its cover, eroded, swollen where it is caked -
  //          the shader bends the normal by its screen derivatives; dry mud a little rougher in relief (the flecks' octave)
  const PBR = { roughWet: 0.25, roughDry: 0.9, roughDust: 0.95, dustTop: 0.35, bump: 1.0 };
  const OUTP = { mud: 0, dust: 0, wet: 0, rough: 0, h: 0 };
  function pbrAt(G, px, py, pz, nx, ny, nz, baseRough, out) {
    const o = out || OUTP, c = sample(G, px, py, pz, nx, ny, nz), sp = spatter(px, py, pz), m = c > 0.003 ? erode(c, sp) : 0;
    const t2 = sample2(G, px, py, pz), d = t2[0] * (nz > 0.3 ? PBR.dustTop : 1) * (1 - 0.5 * m), wet = t2[1];
    const br = baseRough != null ? baseRough : 0.5, rm = PBR.roughWet + (PBR.roughDry - PBR.roughWet) * (1 - wet);
    o.mud = m; o.dust = d; o.wet = wet;
    o.rough = br + (PBR.roughDust - br) * d; o.rough += (rm - o.rough) * m;
    o.h = PBR.bump * m * (0.35 + 0.65 * c) * (0.75 + 0.25 * (1 - wet) * sp);
    return o;
  }
  // how squarely a surface of normal n faces an arrival b: (-n . b) eased, 0 when it faces away
  const face = d => (d > 0 ? Math.min(1, d * 1.15) : 0);
  // the four channels' covers (0..1) on a surface of normal n: each arrival covers what faces it, independently
  function look(c0, c1, c2, c3, nx, ny, nz) {
    return 1 - (1 - c0 * face(-nz)) * (1 - c1 * face(-ny)) * (1 - c2 * face(nx)) * (1 - c3 * face(-nx));
  }

  // ---- THE WEATHER ON THE COAT, once in a while (the page: every second): rain (0..1) washes and RE-WETS, water under craft z
  // waterZ (null: none) washes fast; in the open the mud DRIES (its wetness e-folds over tDry s: the gloss goes, the roughness
  // and the relief come up) and the dust film rain takes off fast (a veil, not a crust)
  function wash(G, dt, rain, waterZ) {
    if (!G || !(dt > 0)) return;
    const r = rain > 0 ? rain * K.rain * dt : 0;
    const kw = waterZ != null ? Math.min(1, K.water * dt) : 0;
    const dry = Math.exp(-dt / K.tDry), rw = rain > 0 ? Math.min(1, rain * K.kRewet * dt) : 0, rd = rain > 0 ? Math.min(1, rain * K.rainDust * dt) : 0;
    const h = G.h, nx = G.nx, ny = G.ny;
    // rain falls on what faces up and out: the up-arrival (undersides) keeps it best, the sideways ones less, the aft one
    // (fronts of legs, leading edges) between
    const rk = [r * K.rainUnder, r * 0.6, r * 0.8, r * 0.8];
    for (let k = 0; k < G.nz; k++) {
      const under = kw > 0 && G.o[2] + (k + 0.5) * h < waterZ;
      for (let c = k * nx * ny, e = c + nx * ny; c < e; c++) {
        const q = c * 4;
        if (G.dust[c] > 0) G.dust[c] *= 1 - (under ? kw : rd);
        if (G.dep[q] + G.dep[q + 1] + G.dep[q + 2] + G.dep[q + 3] === 0) continue;
        if (r > 0 || under) for (let b = 0; b < 4; b++) G.dep[q + b] *= 1 - (under ? kw : rk[b]);
        G.wet[c] = under ? 1 : rw > 0 ? G.wet[c] + (1 - G.wet[c]) * rw : G.wet[c] * dry;
      }
    }
    G.dirty[0] = 0; G.dirty[1] = 0; G.dirty[2] = 0; G.dirty[3] = nx - 1; G.dirty[4] = ny - 1; G.dirty[5] = G.nz - 1;
    G.ver++;
  }
  function clear(G) { if (!G) return; G.dep.fill(0); G.dust.fill(0); G.wet.fill(0); G.hits = 0; G.mass = 0; G.rayHits = 0; G.dustMass = 0; G.ver++; }
  // the coat's one number (aeroMudStep's m, the readers of it): the mean cover over the airframe cells that hold any
  function total(G) {
    if (!G) return 0;
    let s = 0;
    for (let c = 0; c < G.N; c++) if (G.occ[c] === 1) { const q = c * 4, D = G.dep[q] + G.dep[q + 1] + G.dep[q + 2] + G.dep[q + 3]; s += 1 - Math.exp(-D / K.D0); }
    return G.occupied ? s / G.occupied : 0;
  }
  // the texture's bytes (RGBA8 a cell: each channel as 1 - e^(-D/D0) x 255, so the shader's sum stays in range); into out
  function bytes(G, out) {
    const o = out || new Uint8Array(G.N * 4), C = G.cov && G.covVer === G.ver ? G.cov : null;
    for (let q = 0; q < G.N * 4; q++) o[q] = Math.min(255, Math.round(255 * (C ? C[q] : 1 - Math.exp(-G.dep[q] / K.D0))));
    return o;
  }

  const GROUND_DEPOSIT = { K, SP, PBR, BINS, make, march, deposit, collide, dustRays, filmAt, smooth, sample, sample2, look, spatter, erode, mudAt, pbrAt, wash, clear, total, bytes };
  if (typeof window !== 'undefined') window.GROUND_DEPOSIT = GROUND_DEPOSIT;
  if (typeof module !== 'undefined' && module.exports) module.exports = GROUND_DEPOSIT;
})();
