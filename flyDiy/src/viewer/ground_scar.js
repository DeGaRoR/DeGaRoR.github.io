// ============================================================================
// ground_scar.js — THE SCAR'S DECAL (G2359, DMG-SCAR; the user, 2026-10-07: "the ground should also be impacted ...
// at minimum remove the grass at impact, and possibly put an impact decal on the ground").
//
// A crash's scar (34_scar.js: the craters, the gouges and the sweep its ground contacts left, sealed once an event and
// carried to the page on the damage hop - sim_host.js simDmgHop -> sim_view.js dmgS.scar; inline app.js dmgNow) is
// drawn here as ONE mesh laid on the terrain: torn turf and dark soil in each crater (a disc, its rim ragged and turf-
// tinted, its bowl darker by its depth), a strip of the same along each gouge (the furrow's floor dark down its middle,
// the spoil turf-tinted at its edges), a scuff where the ground is hard (paved, rock: grey, half-strength, no bowl).
// Nothing for the sweep (its shrubs are the cover ring's: cover_ring.js scar) and nothing over the water (a ripple is
// WATER-LOOK's). Every vertex stands on terrainH + `lift` (the ground under it: a vertex every ~0.3 m), drawn after the
// pavement with a polygon offset, as the tyres' contact blobs (contact_shadow.js).
// G2379-G2381 (DMG-SCAR2): the rims and the edges RAGGED by a smooth wobble seeded from the primitive (a crater's rim in
// 3-5-9 lobes, a furrow's two edges each their own along its length); a crater's spoil thrown DOWN-RANGE (its heading u);
// a furrow drawn in the order it was ploughed - faded in at its entry, the spoil pushed up in a ragged lip ahead of where
// it stopped; on HARD ground a scuff of dark streaks along the slide (rubber and metal), a blow there a streaked patch
// along its heading - no bowl, no furrow. The same mesh, material and texture: only the vertices and their colours.
//
// NO PROGRAM LINKS IN A CRASH (SHADER-GUARD / COLD-LINKS: a link in flight is a freeze). The mesh is made ONCE, when the
// world is built for a flight (app.js worldSettle, before the roll-out's compile), PARKED - in the world scene, hidden,
// on an empty geometry with the very attribute set a scar's has (position, normal, uv, colour RGBA, an index) - so the
// roll-out's compile (compileAsync over the scene: it traverses hidden objects) and the lamps' prelink key and link its
// program with the world's. A scar swaps the geometry and shows the mesh: the same material object, the same object
// state, the same key (GATE DMGSCAR counts the links and the program keys before and after, on the real three).
// Its material is the library's transparent PBR (MATLIB 'glass': MeshStandardMaterial, vertex colours with alpha, the
// map below): lit, shadowed and fogged as the ground round it is.
// THE TEXTURE is made here, procedurally (no file, nothing to credit): 128 x 128 RGBA of value-noise soil - dark loam,
// lighter clods, root threads and a few torn green blades - tiled every TEX_M metres in world space (64 KB, mipmapped).
//
//   GROUND_SCAR.make(THREE)                  -> the parked mesh (the caller adds it to the world scene, once)
//   GROUND_SCAR.build(THREE, mesh, prims, world) -> { tris, verts, bytes, ms }: the scar laid (prims [] / null: cleared)
//   GROUND_SCAR.clear(mesh)                  the scar's buffers freed, the mesh parked again (the shed, a reset)
//   GROUND_SCAR.S                            the dials: lift, step, rimK
// Loads in node (module.exports) for GATE DMGSCAR.
// ============================================================================
'use strict';
var GROUND_SCAR = (() => {
  // (G2379-G2381: seg 22 -> 28 round a rim for its lobes; rag the edges' wobble; acrossHard the scuff's streak columns,
  // scuffA its strength - GAME, read in GATE DMGSCAR against the runway's own albedo from the chase camera)
  const S = { lift: 0.03, step: 0.3, ring: 7, seg: 28, across: 6, rag: 0.25, acrossHard: 12, scuffA: 0.85 };
  const TEX_M = 1.6;                              // metres a tile of the soil
  const hsh = (x, z, s) => { let h = (x * 374761393 + z * 668265263 + s * 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // tileable value noise on a period-P lattice
  const vn = (x, y, P, s) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hsh(((a % P) + P) % P, ((b % P) + P) % P, s);
    return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy;
  };
  let TEX = null;
  function soil(THREE) {
    if (TEX) return TEX;
    const N = 128, px = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      let n = 0, a = 0.5, w = 0; for (let o = 0; o < 4; o++) { const P = 4 << o; n += a * vn(u * P, v * P, P, 7 + o); w += a; a *= 0.5; } n /= w;
      const clod = vn(u * 16, v * 16, 16, 31), cl = clod > 0.72 ? (clod - 0.72) / 0.28 : 0;
      // dark loam, clods lighter and drier, a fleck of grit
      let r = 52 + 46 * n + 40 * cl, g = 38 + 34 * n + 30 * cl, b = 26 + 22 * n + 18 * cl;
      if (hsh(x, y, 3) > 0.985) { r += 40; g += 36; b += 30; }
      // root threads and torn blades: thin streaks along a hashed direction per 8-px cell, green where the cell says turf
      const cx = x >> 3, cy = y >> 3, ang = hsh(cx, cy, 11) * Math.PI, dx = (x & 7) - 3.5, dy = (y & 7) - 3.5;
      const d = Math.abs(dx * Math.sin(ang) - dy * Math.cos(ang));
      if (d < 0.6 && hsh(cx, cy, 13) > 0.55) {
        if (hsh(cx, cy, 17) > 0.6) { r = 70 + 30 * n; g = 92 + 40 * n; b = 34; }          // a torn blade
        else { r = 120 + 30 * n; g = 96 + 24 * n; b = 66; }                                   // a root
      }
      const k = (y * N + x) * 4;
      px[k] = Math.min(255, r); px[k + 1] = Math.min(255, g); px[k + 2] = Math.min(255, b); px[k + 3] = 255;
    }
    const t = new THREE.DataTexture(px, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 4; if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; t.name = 'scar:soil';
    t.needsUpdate = true;
    return (TEX = t);
  }
  // the geometry a scar has, empty: the parked mesh's and the cleared one's (the same attributes, so the same program)
  function empty(THREE) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([], 2)); g.setAttribute('color', new THREE.Float32BufferAttribute([], 4));
    g.setIndex([]); g.name = 'scar:parked';
    return g;
  }
  function make(THREE) {
    const ML = typeof MATLIB !== 'undefined' ? MATLIB : require('./matlib.js');
    const m = ML.make(THREE, 'glass', { map: soil(THREE), vertexColors: true, roughness: 1, metalness: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.name = 'scar:decal';
    const mesh = new THREE.Mesh(empty(THREE), m);
    mesh.name = 'scar:decal'; mesh.visible = false; mesh.renderOrder = 4; mesh.matrixAutoUpdate = false;
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.parked = mesh.geometry; mesh.userData.stat = { tris: 0, verts: 0, bytes: 0, ms: 0, prims: 0 };
    return mesh;
  }
  // ---- the scar's mesh ------------------------------------------------------------------------------------------
  // colours (a multiply on the soil map; alpha the decal's strength): the floor, the bowl's or the furrow's darker floor,
  // the turf-tinted rim (the torn sod and the spoil). G2381: a hard surface's scuff - rubber and metal, dark, in streaks
  // along the slide (SCUFF x the soil map: ~0.016 linear, over the runway's asphalt 0.045 / its concrete 0.05-0.23)
  const FLOOR = [0.85, 0.82, 0.8], DEEP = [0.55, 0.5, 0.48], TURF = [0.62, 0.78, 0.42], SCUFF = [0.18, 0.18, 0.19];
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // G2379: a smooth deterministic wobble in [-1, 1], seeded from the primitive - three sines of hashed phase: round a rim
  // (`per`: 3, 5 and 9 lobes, periodic in the angle) or along an edge (wavelengths 1.9, 1.1 and 0.75 m of the strip)
  const WA = [0.55, 0.3, 0.15], WP = [3, 5, 9], WL = [1.9, 1.1, 0.75];
  const wob = (a, seed, per) => { let v = 0; for (let k = 0; k < 3; k++) v += WA[k] * Math.sin(a * (per ? WP[k] : 2 * Math.PI / WL[k]) + 2 * Math.PI * hsh(k, 7, seed)); return v; };
  const seedOf = (x, z, k) => ((Math.round(x * 100) * 73856093) ^ (Math.round(z * 100) * 19349663) ^ (k * 83492791)) | 0;
  // a polyline resampled every S.step
  const resample = Q => {
    const pts = [];
    for (let j = 0; j + 3 < Q.length; j += 2) {
      const ax = Q[j], az = Q[j + 1], bx = Q[j + 2], bz = Q[j + 3], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / S.step));
      for (let q = 0; q < n; q++) pts.push(ax + (bx - ax) * q / n, az + (bz - az) * q / n);
    }
    pts.push(Q[Q.length - 2], Q[Q.length - 1]);
    return pts;
  };
  function build(THREE, mesh, prims, world) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    clear(mesh);
    const P = (prims || []).filter(p => p.k === 'c' || p.k === 'g');
    if (!P.length || !world || typeof world.terrainH !== 'function') return mesh.userData.stat;
    const pos = [], nrm = [], uv = [], col = [], idx = [];
    const gH = world.terrainH;
    const wet = (x, z) => typeof scarSurf === 'function' ? scarSurf(world, x, z) < 0 : false;
    const vert = (x, z, c, a) => {
      const y = gH(x, z), e = 0.25;
      const nx = gH(x - e, z) - gH(x + e, z), nz = gH(x, z - e) - gH(x, z + e), ny = 2 * e, l = Math.hypot(nx, ny, nz);
      pos.push(x, y + S.lift, z); nrm.push(nx / l, ny / l, nz / l); uv.push(x / TEX_M, z / TEX_M);
      col.push(c[0], c[1], c[2], wet(x, z) ? 0 : a);
      return pos.length / 3 - 1;
    };
    // A STRIP along pts (resampled) of half-width h: the furrow (soft) or the scuff (hard). Every vertex within h of the
    // path (inside the footprint: the gouge's capsule). Soft: the two edges ragged apart (G2379: each side its own
    // wobble, 0.75-1 x h), the floor dark down the middle by the depth, the spoil turf-tinted at the edges, the entry
    // faded in; `cap` - the end where it stopped: the spoil pushed ahead of it (a ragged lip of turf, inside the capsule's
    // end); without it the end fades. Hard: S.acrossHard columns, each a streak of its own strength (rubber and metal
    // drawn along the slide), dark, both ends faded.
    const strip = (pts, h, hard, deep, seed, cap) => {
      const N = pts.length / 2, A = hard ? S.acrossHard : S.across, base = pos.length / 3;
      let Ltot = 0; for (let i = 1; i < N; i++) Ltot += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
      const fadeL = Math.max(0.05, Math.min(h, Ltot / 3));
      const sw = []; for (let q = 0; q <= A; q++) sw.push(hsh(q, 5, seed) > 0.45 ? 1 : 0.3);   // the streaks' strengths
      let s = 0, tx = 1, tz = 0, hl = h, hr = h;
      for (let i = 0; i < N; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1);
        tx = pts[i1 * 2] - pts[i0 * 2]; tz = pts[i1 * 2 + 1] - pts[i0 * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        if (i) s += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
        const fin = Math.min(1, s / fadeL), fout = cap ? 1 : Math.min(1, (Ltot - s) / fadeL), end = Math.min(fin, fout);
        hl = hard ? h : h * (1 - S.rag * (0.5 + 0.5 * wob(s, seed + 11, false)));
        hr = hard ? h : h * (1 - S.rag * (0.5 + 0.5 * wob(s, seed + 23, false)));
        for (let q = 0; q <= A; q++) {
          const u = q / A * 2 - 1, k = Math.abs(u), o = u * (u < 0 ? hl : hr), edge = q === 0 || q === A;
          let c, a;
          if (hard) {
            c = SCUFF; a = edge ? 0 : S.scuffA * sw[q] * (0.75 + 0.25 * wob(s, seed + 37 * q, false)) * end;
          } else {
            c = k < 0.4 ? mixC(DEEP, FLOOR, (k / 0.4) * (1 - deep * 0.6)) : mixC(FLOOR, TURF, (k - 0.4) / 0.6);
            a = 0.95 * (edge ? 0 : k > 0.7 ? (1 - (k - 0.7) / 0.3 * 0.6) * (0.85 + 0.15 * wob(s, seed + 31, false)) : 1) * end;
          }
          vert(pts[i * 2] - tz * o, pts[i * 2 + 1] + tx * o, c, a);
        }
      }
      for (let i = 0; i + 1 < N; i++) for (let q = 0; q < A; q++) {
        const a = base + i * (A + 1) + q, b = a + 1, c = a + A + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      if (!cap || hard) return;
      // the spoil's lip ahead of the end: two rows - the heap (turf, strong) and its ragged front (alpha 0) - each column
      // pushed forward by h sqrt(1 - u^2) x (0.55-1): inside the end's disc of radius h
      const ex = pts[N * 2 - 2], ez = pts[N * 2 - 1], last = base + (N - 1) * (A + 1);
      for (const f of [0.5, 1]) for (let q = 0; q <= A; q++) {
        const u = q / A * 2 - 1, o = u * (u < 0 ? hl : hr), fw = h * Math.sqrt(Math.max(0, 1 - u * u)) * (0.55 + 0.45 * (0.5 + 0.5 * wob(u * 2.2, seed + 41, true))) * f;
        const a = f === 1 || q === 0 || q === A ? 0 : 0.9 * (1 - 0.4 * Math.abs(u));
        vert(ex - tz * o + tx * fw, ez + tx * o + tz * fw, mixC(TURF, FLOOR, 0.25 * (0.5 + 0.5 * wob(u * 3.1, seed + 43, true))), a);
      }
      for (let r = 0; r < 2; r++) for (let q = 0; q < A; q++) {
        const a = last + r * (A + 1) + q, b = a + 1, c = a + A + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    };
    const THROW = typeof SCAR !== 'undefined' && SCAR.throw != null ? SCAR.throw : 0.3;
    for (const p of P) {
      const hard = p.s === 2;
      if (p.k === 'c' && hard) {
        // a blow on hard ground: a scuff patch along its heading (no bowl), 1.5 r long and 1.2 r wide (inside its disc)
        const ux = p.u ? p.u[0] : 1, uz = p.u ? p.u[1] : 0, a = 0.75 * p.r;
        strip(resample([p.x - ux * a, p.z - uz * a, p.x + ux * a, p.z + uz * a]), 0.6 * p.r, true, 0, seedOf(p.x, p.z, 1), false);
      } else if (p.k === 'c') {
        // a polar grid: the bowl's floor out to its rim. G2379: the rim's outline r0 (0.84 + 0.16 wobble) round the bowl, and
        // down-range (u, the heading it struck on) the spoil thrown up to r0 x throw beyond it - never past the footprint r
        const NR = S.ring, NS = S.seg, base = pos.length / 3, seed = seedOf(p.x, p.z, 0);
        const deep = Math.min(1, (p.d || 0) / 0.25), thu = p.u ? Math.atan2(p.u[1], p.u[0]) : 0, r0 = p.u ? p.r / (1 + THROW) : p.r;
        vert(p.x, p.z, mixC(FLOOR, DEEP, deep), 0.95);
        for (let j = 1; j <= NR; j++) for (let s = 0; s < NS; s++) {
          const th = s / NS * Math.PI * 2, k = j / NR;
          const fwd = p.u ? Math.max(0, Math.cos(th - thu)) : 0;
          const rho = r0 * (0.84 + 0.16 * wob(th, seed, true)) + r0 * THROW * fwd * fwd * (0.75 + 0.25 * wob(th, seed + 1, true));
          const rr = rho * k, q = rr / r0;
          const c = q < 0.55 ? mixC(DEEP, FLOOR, q / 0.55 * (1 - deep * 0.5)) : q <= 1 ? mixC(FLOOR, TURF, (q - 0.55) / 0.45) : mixC(TURF, FLOOR, 0.3 * (0.5 + 0.5 * wob(th * 2, seed + 2, true)));
          const a = j === NR ? 0 : k > 0.75 ? 0.95 * (1 - (k - 0.75) / 0.25 * 0.6) : 0.95;
          vert(p.x + rr * Math.cos(th), p.z + rr * Math.sin(th), c, a);
        }
        for (let s = 0; s < NS; s++) idx.push(base, base + 1 + (s + 1) % NS, base + 1 + s);
        for (let j = 1; j < NR; j++) for (let s = 0; s < NS; s++) {
          const a = base + 1 + (j - 1) * NS + s, b = base + 1 + (j - 1) * NS + (s + 1) % NS, c = a + NS, d = b + NS;
          idx.push(a, b, d, a, d, c);
        }
      } else {
        // a furrow (its path in the order it was ploughed: the spoil at its end) or a slot (both ends faded); a scuff on hard
        strip(resample(p.p), p.w / 2, hard, Math.min(1, (p.d || 0) / 0.2), seedOf(p.p[0], p.p[1], 2), !p.ps);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx); g.computeBoundingSphere(); g.name = 'scar:decal';
    mesh.geometry = g; mesh.visible = true;
    const st = mesh.userData.stat;
    st.tris = idx.length / 3; st.verts = pos.length / 3; st.bytes = pos.length / 3 * (12 + 12 + 8 + 16) + idx.length * (pos.length / 3 > 65535 ? 4 : 2);
    st.prims = P.length; st.ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    return st;
  }
  function clear(mesh) {
    if (!mesh) return;
    const P = mesh.userData.parked;
    if (mesh.geometry !== P) { mesh.geometry.dispose(); mesh.geometry = P; }
    mesh.visible = false;
    const st = mesh.userData.stat; st.tris = 0; st.verts = 0; st.bytes = 0; st.prims = 0;
  }
  const api = { S, make, build, clear, soil };
  if (typeof window !== 'undefined') window.GROUND_SCAR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
