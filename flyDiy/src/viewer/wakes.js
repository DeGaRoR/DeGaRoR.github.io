// wakes.js - THE WAKES: what a body crossing the water's surface leaves on it (ANIMALS-MOTION / SWIMMERS, 15 Nov 2026).
//
// The user, 15 Nov: "there is no interaction with the water, so no wake ... we may want to have animated boats and stuff
// like this, so being able to generate wakes and interactions and something physically correct, so meaning that we
// generate wakes when they are crossing the surface and not when they are further down". WATER's interaction field
// (water.js H7) is a 192 m box that follows the AEROPLANE and runs only near it: a pod 1 km off, or a boat, never had a
// wake. This layer is anchored in the WORLD and belongs to no aeroplane.
//
// A SURFACE LAYER, NOTHING ELSE (A0, 15 Nov): foam and wake on the water. Spray and plumes are particles (spray.js,
// plume.js; GROUND-FX's one system after the perf round) - a breach asks for those through its own host, never here.
//
// THE API - a body tells the layer where it is, every frame it wants a wake:
//   const W = WAKES.make(THREE, { parent, waterH })
//   W.hull(id, { x, z, hd, speed, beam, length, top, bottom })   world metres; hd: heading (rad, atan2(dx, dz));
//       top / bottom: the body's highest / lowest point, world y. THE WATERLINE IS CROSSED or there is no wake: the
//       crossing (the part of the body's height the surface cuts, 0..1, peaking at mid-body) times the speed is the
//       wake's strength. A whale cruising 20 m down leaves nothing; a whale whose back is out leaves a trail.
//   W.ring(x, z, r, k)      a breath, a breach or a fluke slap: the upwelling's swirl (r its radius, k 0..1 its foam)
//   W.step(dt)              ages everything and rebuilds the ONE draw
//   W.stats, W.dispose()
// Boats later are one more caller of hull(): the same record.
//
// WHAT IT DRAWS (one geometry, one material, one draw for every wake in the layer):
//   THE TRAIL   the turbulent wake astern: points dropped every TRAIL_DS metres while the hull crosses the surface,
//               each a cross-section whose half-width grows from the beam as the wake spreads (SPREAD m/s) and whose
//               foam fades over TRAIL_LIFE seconds
//   THE ARMS    the Kelvin wedge: two thin crests leaving each point at +-19.47 deg to the track (the deep-water
//               angle, any speed): their lateral offset grows with the point's age x its speed x tan(19.47 deg)
//   THE RINGS   a breath or a breach: the upwelling's swirl - a soft disc of torn foam (the tile tears it) spreading at
//               RING_V m/s and fading over RING_LIFE seconds, RING_A at most. (The first slot, 15 Nov: a white annulus
//               spreading at 1.6 m/s for 9 s - a bright donut round every orca at every breath. A surfacing whale's
//               water is a turbulent patch the size of its back, gone in a few seconds, never a ring.)
//   THE SLICKS  what the upwelling leaves after the foam (16 Nov; the user: "the water effects are quite rough"): a glassy
//               oval where the wind's ripple is smoothed - the whale's 'footprint' - SLICK_GROW times the ring's radius
//               by the end of SLICK_LIFE seconds, SLICK_K at most. Not drawn here: the water draws it (WATER.setSlicks, the
//               ripple and the sub-pixel roughness drop under it), the strongest SLICK_N handed over every rebuild.
// The foam is a lit standard material (MATLIB's, so the census and the day's light rules hold) with a tiled noise as
// its alpha map at world scale, so the foam tears like foam and not like a ribbon; vertex alpha carries the fade.
'use strict';
(function () {
const WK = {};
const TRAIL_DS = 1.5, TRAIL_LIFE = 30, SPREAD = 0.18, ARM_TAN = Math.tan(19.47 * Math.PI / 180), ARM_W = 0.9;
const RING_V = 0.35, RING_LIFE = 6, RING_A = 0.2, MAXP = 4096, MAXR = 32, MAXV = 24000;
const SLICK_LIFE = 40, SLICK_K = 0.9, SLICK_GROW = 1.8, SLICK_N = 6, SLICK_PX = 3, SLICK_PXRAD = 1094;   // (a slick under SLICK_PX across: not handed)
WK.K = { TRAIL_DS, TRAIL_LIFE, SPREAD, ARM_TAN, RING_V, RING_LIFE, RING_A, SLICK_LIFE, SLICK_K, SLICK_GROW, SLICK_N };

// the crossing: how much of a body from `bottom` to `top` the surface at `lvl` cuts, 0 (clear above or below) to 1
// (the surface at mid-body), a tent - a body just breaking the surface makes a little wake, half out the most
function crossing(top, bottom, lvl) {
  if (!(top > bottom) || lvl <= bottom || lvl >= top) return 0;
  const u = (lvl - bottom) / (top - bottom);
  return 1 - Math.abs(2 * u - 1);
}
WK.crossing = crossing;

function noiseTile(THREE) {
  const N = 64, d = new Uint8Array(N * N * 4);
  let s = 1234567;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const g = new Float32Array(17 * 17); for (let i = 0; i < g.length; i++) g[i] = r();
  const vn = (x, y, k) => { const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y, q = n => ((n % k) + k) % k;
    const a = g[q(X) * 17 + q(Y)], b = g[q(X + 1) * 17 + q(Y)], c = g[q(X) * 17 + q(Y + 1)], e = g[q(X + 1) * 17 + q(Y + 1)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = 0.55 * vn(x / 8, y / 8, 8) + 0.3 * vn(x / 4, y / 4, 16) + 0.15 * vn(x / 2, y / 2, 16);
    const a = Math.max(0, Math.min(1, (v - 0.32) * 2.4));
    const o = 4 * (y * N + x); d[o] = d[o + 1] = d[o + 2] = Math.round(a * 255); d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

WK.make = function (THREE, o) {
  o = o || {};
  const waterH = o.waterH || (() => 0);
  // the points: x z (where), y (the surface there when dropped), t (born, s), w (half-width at birth), k (strength),
  // v (speed), dx dz (the track's direction), id (the hull), prev (the previous point of the same trail, -1 none)
  const PX = new Float32Array(MAXP), PZ = new Float32Array(MAXP), PY = new Float32Array(MAXP), PT = new Float32Array(MAXP);
  const PW = new Float32Array(MAXP), PK = new Float32Array(MAXP), PV = new Float32Array(MAXP), PDX = new Float32Array(MAXP), PDZ = new Float32Array(MAXP);
  const PPREV = new Int32Array(MAXP).fill(-1), PALIVE = new Uint8Array(MAXP);
  let pHead = 0;
  const RX = new Float32Array(MAXR), RZ = new Float32Array(MAXR), RY = new Float32Array(MAXR), RT = new Float32Array(MAXR).fill(-1e9), RR = new Float32Array(MAXR), RK = new Float32Array(MAXR);
  let rHead = 0;
  const HULLS = new Map();          // id -> { last point index, last x z, seen (clock) }
  let T = 0;
  const stats = { hulls: 0, points: 0, rings: 0, verts: 0, slicks: 0, ms: 0 };
  // THE SLICKS' list for the water (o.slicks(list) for a gate, else WATER.setSlicks), reused: nothing allocated a rebuild
  const SLK = 'wakes:' + Math.random().toString(36).slice(2, 8), SLL = [], SLP = [];
  for (let i = 0; i < SLICK_N; i++) SLP.push({ x: 0, z: 0, r: 1, k: 0 });
  let slHad = false;

  // the one draw
  const pos = new Float32Array(MAXV * 3), col = new Float32Array(MAXV * 4), uv = new Float32Array(MAXV * 2), nrm = new Float32Array(MAXV * 3);
  for (let i = 0; i < MAXV; i++) nrm[3 * i + 1] = 1;
  const idx = new Uint32Array(MAXV * 3 / 2 | 0);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aCol = new THREE.BufferAttribute(col, 4), aUv = new THREE.BufferAttribute(uv, 2);
  aPos.setUsage && aPos.setUsage(THREE.DynamicDrawUsage); aCol.setUsage && aCol.setUsage(THREE.DynamicDrawUsage); aUv.setUsage && aUv.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('color', aCol); geo.setAttribute('uv', aUv);
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const aIdx = new THREE.BufferAttribute(idx, 1); aIdx.setUsage && aIdx.setUsage(THREE.DynamicDrawUsage);
  geo.setIndex(aIdx);
  geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);   // a layer over the whole sea: never culled as one
  const params = { color: 0xf3f5f4, roughness: 0.85, metalness: 0, transparent: true, depthWrite: false, vertexColors: true,
                   alphaMap: noiseTile(THREE), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 };
  const mat = typeof MATLIB !== 'undefined' && MATLIB.make ? MATLIB.make(THREE, 'std', params, 'water / wakes / ribbons') : null;
  const mesh = new THREE.Mesh(geo, mat || undefined);
  mesh.name = 'wakes';
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.renderOrder = 11;                                 // after the water (transparent, drawn in order), before the loom
  mesh.raycast = () => {};
  if (o.parent) o.parent.add(mesh);

  function drop(h, x, z, lvl, w, k, v, dx, dz, hx, hz) {
    const i = pHead; pHead = (pHead + 1) % MAXP;
    // a recycled slot: whoever pointed at it no longer does
    if (PALIVE[i]) for (const [, hh] of HULLS) if (hh.last === i) hh.last = -1;
    PX[i] = x; PZ[i] = z; PY[i] = lvl; PT[i] = T; PW[i] = w; PK[i] = k; PV[i] = v; PDX[i] = dx; PDZ[i] = dz;
    PPREV[i] = h.last; PALIVE[i] = 1;
    h.last = i; h.lx = hx; h.lz = hz;                   // (the HULL's place at the drop: the spacing is the hull's travel)
  }
  function hull(id, b) {
    let h = HULLS.get(id);
    if (!h) { h = { last: -1, lx: NaN, lz: NaN, seen: T }; HULLS.set(id, h); }
    h.seen = T;
    const lvl = waterH(b.x, b.z);
    if (!Number.isFinite(lvl)) { h.last = -1; return 0; }
    const c = crossing(b.top, b.bottom, lvl);
    const v = Math.max(0, b.speed || 0);
    // the wake's strength: the crossing, and the speed (a body drifting at the surface makes a slick, not a wake)
    const k = c * Math.min(1, v / 3);
    if (k < 0.02) { h.last = -1; return 0; }          // under, above or still: the trail breaks here
    const dx = Math.sin(b.hd || 0), dz = Math.cos(b.hd || 0);
    // a point every TRAIL_DS metres, or every fifth of the body's length for a long one (a 25 m whale: every 5 m)
    if (h.last < 0 || !PALIVE[h.last] || Math.hypot(b.x - h.lx, b.z - h.lz) >= Math.max(TRAIL_DS, (b.length || 4) * 0.2)) {
      drop(h, b.x - dx * (b.length || 4) * 0.35, b.z - dz * (b.length || 4) * 0.35, lvl, Math.max(0.4, (b.beam || 2) * 0.5), k, v, dx, dz, b.x, b.z);
    }
    return k;
  }
  function ring(x, z, r, k) {
    const lvl = waterH(x, z);
    if (!Number.isFinite(lvl)) return;
    const i = rHead; rHead = (rHead + 1) % MAXR;
    RX[i] = x; RZ[i] = z; RY[i] = lvl; RT[i] = T; RR[i] = r || 2; RK[i] = k == null ? 1 : k;
  }

  // ---- the build ------------------------------------------------------------------------------------------------
  let nv = 0, ni = 0;
  const vert = (x, y, z, a) => {
    if (nv >= MAXV) return -1;
    pos[3 * nv] = x; pos[3 * nv + 1] = y; pos[3 * nv + 2] = z;
    col[4 * nv] = 1; col[4 * nv + 1] = 1; col[4 * nv + 2] = 1; col[4 * nv + 3] = a;
    uv[2 * nv] = x / 7; uv[2 * nv + 1] = z / 7;            // the foam's tile at world scale (7 m)
    return nv++;
  };
  const quad = (a, b, c, d) => { if (a < 0 || b < 0 || c < 0 || d < 0 || ni + 6 > idx.length) return; idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = b; idx[ni++] = d; idx[ni++] = c; };
  // one segment of a band: points i (newer) and j (older); the band's lateral edges from the track, at each point's
  // age: mode 0 the trail (-hw .. +hw, hw = the half-beam + SPREAD x age), 1 / 2 the right / left Kelvin arm (the
  // crest ARM_W wide, at the half-beam + speed x age x tan 19.47 deg). Inline: this runs ~1 000 times a rebuild.
  function band(i, j, mode, aMul) {
    const ai = T - PT[i], aj = T - PT[j];
    const ui = ai / TRAIL_LIFE, uj = aj / TRAIL_LIFE;
    const fi = ui >= 1 ? 0 : (1 - ui) * (1 - ui) * Math.min(1, ai / 0.6 + 0.25) * PK[i] * aMul;
    const fj = uj >= 1 ? 0 : (1 - uj) * (1 - uj) * Math.min(1, aj / 0.6 + 0.25) * PK[j] * aMul;
    if (fi < 0.01 && fj < 0.01) return;
    let i0, i1, j0, j1;
    if (mode === 0) { const hi = PW[i] + SPREAD * ai, hj = PW[j] + SPREAD * aj; i0 = -hi; i1 = hi; j0 = -hj; j1 = hj; }
    else {
      const oi = PW[i] + PV[i] * ai * ARM_TAN, oj = PW[j] + PV[j] * aj * ARM_TAN;
      if (mode === 1) { i0 = oi; i1 = oi + ARM_W; j0 = oj; j1 = oj + ARM_W; } else { i0 = -oi - ARM_W; i1 = -oi; j0 = -oj - ARM_W; j1 = -oj; }
    }
    const lxi = -PDZ[i], lzi = PDX[i], lxj = -PDZ[j], lzj = PDX[j];
    const yi = PY[i] + 0.04, yj = PY[j] + 0.04, xi = PX[i], zi = PZ[i], xj = PX[j], zj = PZ[j];
    const a0 = vert(xi + lxi * i0, yi, zi + lzi * i0, fi), a1 = vert(xi + lxi * i1, yi, zi + lzi * i1, fi);
    const b0 = vert(xj + lxj * j0, yj, zj + lzj * j0, fj), b1 = vert(xj + lxj * j1, yj, zj + lzj * j1, fj);
    quad(a0, a1, b0, b1);
  }
  // THE REBUILD every other frame (REBUILD_DT): the points do not move, only their age does - at 15 Hz the foam's fade
  // and the arms' spread (a few cm a frame) are not seen to step
  const REBUILD_DT = 1 / 15;
  let sinceBuild = 1;
  function step(dt) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    if (!(dt > 0)) dt = 0;
    T += Math.min(0.1, dt);
    sinceBuild += dt;
    if (sinceBuild < REBUILD_DT && dt > 0) { stats.ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0; return; }
    sinceBuild = 0;
    // a hull not heard from in a second has left the layer
    for (const [id, h] of HULLS) if (T - h.seen > 1) HULLS.delete(id);
    nv = 0; ni = 0;
    let np = 0;
    for (let i = 0; i < MAXP; i++) {
      if (!PALIVE[i]) continue;
      if (T - PT[i] > TRAIL_LIFE) { PALIVE[i] = 0; continue; }
      np++;
      const j = PPREV[i];
      if (j < 0 || !PALIVE[j] || T - PT[j] > TRAIL_LIFE) continue;
      // the trail (both sides of the track), then the two Kelvin arms (thin crests)
      band(i, j, 0, 0.85);
      band(i, j, 1, 0.6);
      band(i, j, 2, 0.6);
    }
    // the rings: a soft disc of 24 segments - the centre to 0.55 of the radius at the full foam, then out to nothing
    let nr = 0;
    for (let r = 0; r < MAXR; r++) {
      const age = T - RT[r];
      if (age < 0 || age > RING_LIFE) continue;
      nr++;
      const u = age / RING_LIFE, R = RR[r] + RING_V * age, a = RING_A * RK[r] * Math.min(1, age / 0.4) * (1 - u) * (1 - u), y = RY[r] + 0.05;
      const c = vert(RX[r], y, RZ[r], a);
      let p0 = -1, p1 = -1;
      for (let s = 0; s <= 24; s++) {
        const ang = s / 24 * Math.PI * 2, cx = Math.sin(ang), cz = Math.cos(ang);
        const q0 = vert(RX[r] + cx * R * 0.55, y, RZ[r] + cz * R * 0.55, a), q1 = vert(RX[r] + cx * R, y, RZ[r] + cz * R, 0);
        if (s) { quad(c, p0, c, q0); quad(p0, p1, q0, q1); }
        p0 = q0; p1 = q1;
      }
    }
    // the slicks: every ring younger than SLICK_LIFE, the strongest SLICK_N (fading in over 1.5 s, out as (1 - u)^1.5).
    // THE GUARD (16 Nov, A0 on the slot-3 cost): none while the layer is hidden up its parents, none under SLICK_PX
    // across from the eye (o.eye) - the water's slick loop then costs nothing (uWSlickN 0)
    SLL.length = 0;
    let slShown = true;
    for (let p = mesh; p; p = p.parent) if (p !== mesh && p.visible === false) { slShown = false; break; }
    const se = slShown && o.eye ? o.eye() : null;
    for (let r = 0; r < MAXR && slShown; r++) {
      const age = T - RT[r];
      if (age < 0 || age > SLICK_LIFE) continue;
      if (se) { const d2 = (RX[r] - se.x) ** 2 + (RZ[r] - se.z) ** 2 + ((RY[r] || 0) - (se.y || 0)) ** 2, rr = RR[r] * 2.6 * SLICK_PXRAD;
        if (d2 * SLICK_PX * SLICK_PX > rr * rr) continue; }
      const u = age / SLICK_LIFE, k = SLICK_K * RK[r] * Math.min(1, age / 1.5) * Math.pow(1 - u, 1.5);
      if (k < 0.02) continue;
      let q;
      if (SLL.length < SLICK_N) q = SLP[SLL.length];
      else { let w = 0; for (let i = 1; i < SLL.length; i++) if (SLL[i].k < SLL[w].k) w = i; if (SLL[w].k >= k) continue; q = SLL[w]; SLL[w] = SLL[SLL.length - 1]; SLL.pop(); }
      q.x = RX[r]; q.z = RZ[r]; q.r = RR[r] * 1.3 * (1 + (SLICK_GROW - 1) * u); q.k = k;
      SLL.push(q);
    }
    stats.slicks = SLL.length;
    const WA = typeof window !== 'undefined' && window.WATER && window.WATER.setSlicks ? window.WATER : null;
    if (o.slicks) o.slicks(SLL);
    else if (WA && (SLL.length || slHad)) WA.setSlicks(SLK, SLL.length ? SLL : null);
    slHad = SLL.length > 0;
    geo.setDrawRange(0, ni);
    if (nv) { aPos.needsUpdate = true; aCol.needsUpdate = true; aUv.needsUpdate = true; aIdx.needsUpdate = true;
      if (aPos.updateRanges !== undefined && aPos.clearUpdateRanges) { for (const A of [aPos, aCol, aUv]) { A.clearUpdateRanges(); A.addUpdateRange(0, nv * A.itemSize); } aIdx.clearUpdateRanges(); aIdx.addUpdateRange(0, ni); } }
    mesh.visible = ni > 0;
    stats.hulls = HULLS.size; stats.points = np; stats.rings = nr; stats.verts = nv;
    stats.ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  }
  function dispose() {
    if (slHad && typeof window !== 'undefined' && window.WATER && window.WATER.setSlicks) window.WATER.setSlicks(SLK, null);
    if (mesh.parent) mesh.parent.remove(mesh);
    geo.dispose();
    if (mat && typeof MATLIB !== 'undefined' && MATLIB.release) MATLIB.release(mat);
  }
  return { mesh, hull, ring, step, stats, dispose, clock: () => T,
           // the probe the gate reads: the live points and rings
           probe: () => { const out = []; for (let i = 0; i < MAXP; i++) if (PALIVE[i]) out.push({ x: PX[i], z: PZ[i], k: PK[i], age: T - PT[i] }); return out; } };
};

if (typeof window !== 'undefined') window.WAKES = WK;
if (typeof module !== 'undefined' && module.exports) module.exports = WK;
})();
