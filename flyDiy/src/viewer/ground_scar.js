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
  const S = { lift: 0.03, step: 0.3, ring: 7, seg: 22, across: 6 };
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
  // the turf-tinted rim (the torn sod and the spoil); a hard surface's scuff (grey)
  const FLOOR = [0.85, 0.82, 0.8], DEEP = [0.55, 0.5, 0.48], TURF = [0.62, 0.78, 0.42], SCUFF = [0.32, 0.32, 0.33];
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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
    for (const p of P) {
      const hard = p.s === 2, seed = Math.round(p.k === 'c' ? p.x * 7 + p.z * 13 : p.p[0] * 7 + p.p[1] * 13);
      if (p.k === 'c') {
        // a polar grid: the bowl's floor to the torn rim; the rim ragged inward (never past the footprint: r)
        const NR = S.ring, NS = S.seg, base = pos.length / 3;
        const deep = Math.min(1, (p.d || 0) / 0.25);
        vert(p.x, p.z, hard ? SCUFF : mixC(FLOOR, DEEP, deep), hard ? 0.55 : 0.95);
        for (let j = 1; j <= NR; j++) for (let s = 0; s < NS; s++) {
          const th = s / NS * Math.PI * 2, rag = 0.82 + 0.18 * hsh(s, j === NR ? 1 : 0, seed);
          const k = j / NR, rr = p.r * k * (j === NR ? rag : (0.9 + 0.1 * rag));
          const c = hard ? SCUFF : k < 0.55 ? mixC(DEEP, FLOOR, k / 0.55 * (1 - deep * 0.5)) : mixC(FLOOR, TURF, (k - 0.55) / 0.45);
          const a = hard ? 0.55 * (1 - k * k) : (j === NR ? 0 : k > 0.75 ? 0.95 * (1 - (k - 0.75) / 0.25 * 0.6) : 0.95);
          vert(p.x + rr * Math.cos(th), p.z + rr * Math.sin(th), c, a);
        }
        for (let s = 0; s < NS; s++) idx.push(base, base + 1 + (s + 1) % NS, base + 1 + s);
        for (let j = 1; j < NR; j++) for (let s = 0; s < NS; s++) {
          const a = base + 1 + (j - 1) * NS + s, b = base + 1 + (j - 1) * NS + (s + 1) % NS, c = a + NS, d = b + NS;
          idx.push(a, b, d, a, d, c);
        }
      } else {
        // a strip along the furrow: the polyline resampled every S.step, across it S.across+1 vertices over its width
        const Q = p.p, pts = [];
        for (let j = 0; j + 3 < Q.length; j += 2) {
          const ax = Q[j], az = Q[j + 1], bx = Q[j + 2], bz = Q[j + 3], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / S.step));
          for (let q = 0; q < n; q++) pts.push(ax + (bx - ax) * q / n, az + (bz - az) * q / n);
        }
        pts.push(Q[Q.length - 2], Q[Q.length - 1]);
        const N = pts.length / 2, A = S.across, base = pos.length / 3, h = p.w / 2, deep = Math.min(1, (p.d || 0) / 0.2);
        let Ltot = 0; for (let i = 1; i < N; i++) Ltot += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
        let s = 0;
        for (let i = 0; i < N; i++) {
          const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1);
          let tx = pts[i1 * 2] - pts[i0 * 2], tz = pts[i1 * 2 + 1] - pts[i0 * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          if (i) s += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
          // the ends rounded off over half a width (an alpha taper: the strip stays inside its footprint)
          const end = Math.min(1, Math.min(s, Ltot - s) / Math.max(0.05, Math.min(h, Ltot / 3)));
          for (let q = 0; q <= A; q++) {
            const u = q / A * 2 - 1, rag = q === 0 || q === A ? 0.8 + 0.2 * hsh(i, q, seed) : 1, o = u * h * rag;
            const k = Math.abs(u);
            const c = hard ? SCUFF : k < 0.4 ? mixC(DEEP, FLOOR, (k / 0.4) * (1 - deep * 0.6)) : mixC(FLOOR, TURF, (k - 0.4) / 0.6);
            const a = (hard ? 0.5 : 0.95) * (q === 0 || q === A ? 0 : k > 0.7 ? 1 - (k - 0.7) / 0.3 * 0.6 : 1) * end;
            vert(pts[i * 2] - tz * o, pts[i * 2 + 1] + tx * o, c, a);
          }
        }
        for (let i = 0; i + 1 < N; i++) for (let q = 0; q < A; q++) {
          const a = base + i * (A + 1) + q, b = a + 1, c = a + A + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
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
