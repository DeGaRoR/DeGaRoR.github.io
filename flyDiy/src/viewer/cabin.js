// cabin.js — THE TRAM CABIN, DRESSED (G343, the user: "It needs new materials
// from our library, choose wisely amongst all available. Use the same
// technique for the windows as for the houses. Build a smooth joint on the
// window contour, with higher resolution than the base mesh ... 2 images we
// can project on each side as liveries. Keep the normal of the base
// material, replace the metallic, roughness and diffuse").
//
// The baked prop (tools/cabin_table.py -> src/cabin/) keeps the author's
// parts PER MATERIAL, and that name is the handle everything here hangs on:
//
//   Yellow       the BODY     painted steel (steelgrey, harbour red) with
//                             the livery on both flanks
//   Black_Yellow the TRIM     charcoal steel: bumpers, frames, the carriage
//   Yellow_dirt  the FLOOR    decking boards
//   material     the HANGER   bare steel: the neck, the mainstay, the head
//   Red_dark     the DETAIL   galvanised: handles, small fittings
//   Metallic     the RAIL     galvanised: the door rails and the roof rail
//   Windows      the GLASS    the house's glass, through a house Bag so it
//                             carries the attributes the glass shader reads
//
// THE UVS ARE IN METRES, the house library's rule: every part is re-mapped
// here by a planar projection along its dominant normal, so a 2 m steel tile
// is 2 m on the cabin as it is on the station's girder.
//
// THE GASKET (the smooth joint): the window mesh's boundary - every edge one
// triangle owns - is walked into closed loops, each loop is rounded by
// corner-cutting (Chaikin, three passes: four times the resolution the
// author drew the corners at) and resampled at five centimetres, and a
// six-sided rubber bead of 3.5 cm radius is swept round it. The polygonal
// corner the low mesh shows at every window is under the bead.
//
// THE LIVERY: the body's flank triangles (the outer skin, facing +-x) are
// clipped to the banner's rectangle in (z, y) and copied a few millimetres
// proud of the skin with two uv sets - the banner's (0..1 across the
// rectangle, mirrored on the far flank so the words read from either side)
// and the metric one the steel's NORMAL map keeps reading through a small
// shader patch. Diffuse is the banner, metalness and roughness are the
// decal's own.
//
// `plan(parts)` is pure geometry (the node gate runs it on the baked bin);
// `build(THREE, opts)` turns a plan into meshes with the house's materials.
(() => {
const ROLE = { Yellow: 'body', Black_Yellow: 'trim', Yellow_dirt: 'floor', material: 'hanger',
               Red_dark: 'detail', Metallic: 'rail', Windows: 'glass' };
// the banner's rectangle on the flank, metres in the cabin's baked frame
// (the body runs 5.1 m along z, its window band is y 1.61..2.84, the flank
// is the outermost tenth of a metre of the body on each side)
const BANNER = { z0: -1.5, z1: 1.5, y0: 0.42, y1: 1.42, flank: 0.1 };
const HANG = 8.2;      // the carriage's axle above the floor's origin

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// planar metric uv by the dominant axis of the vertex normal
function metricUV(pos, nrmA) {
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let i = 0; i < pos.length; i += 3) {
    const nx = Math.abs(nrmA[i]), ny = Math.abs(nrmA[i + 1]), nz = Math.abs(nrmA[i + 2]);
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
    uv[i / 3 * 2] = u; uv[i / 3 * 2 + 1] = v;
  }
  return uv;
}

// the boundary loops of a triangle soup (positions welded at a tenth of a millimetre)
function boundaryLoops(pos, idx) {
  const key = i => (Math.round(pos[i * 3] * 1e4) + '/' + Math.round(pos[i * 3 + 1] * 1e4) + '/' + Math.round(pos[i * 3 + 2] * 1e4));
  const wid = new Map(), rep = [];
  const w = new Int32Array(pos.length / 3);
  for (let i = 0; i < w.length; i++) { const k = key(i); let j = wid.get(k); if (j === undefined) { j = rep.length; wid.set(k, j); rep.push(i); } w[i] = j; }
  const count = new Map(), dir = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const a = w[idx[t]], b = w[idx[t + 1]], c = w[idx[t + 2]];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? p + '-' + q : q + '-' + p;
      count.set(k, (count.get(k) || 0) + 1);
      dir.set(k, [p, q]);
    }
  }
  const next = new Map();
  for (const [k, n] of count) if (n === 1) { const [p, q] = dir.get(k); next.set(p, q); }
  const loops = [], seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let cur = start, guard = 0;
    while (cur !== undefined && !seen.has(cur) && guard++ < 100000) { seen.add(cur); loop.push(cur); cur = next.get(cur); }
    if (loop.length >= 3 && cur === start) loops.push(loop.map(j => { const i = rep[j]; return [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]; }));
  }
  return loops;
}

function chaikin(pts, passes) {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push(add(mul(a, 0.75), mul(b, 0.25)), add(mul(a, 0.25), mul(b, 0.75)));
    }
    p = q;
  }
  return p;
}
function resample(pts, step) {
  const out = []; let total = 0;
  const segs = pts.map((p, i) => { const l = len(sub(pts[(i + 1) % pts.length], p)); total += l; return l; });
  const n = Math.max(8, Math.round(total / step)), ds = total / n;
  let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const s = k * ds;
    while (acc + segs[i] < s && i < pts.length - 1) { acc += segs[i]; i++; }
    const t = segs[i] > 1e-9 ? (s - acc) / segs[i] : 0;
    out.push(add(pts[i], mul(sub(pts[(i + 1) % pts.length], pts[i]), t)));
  }
  return out;
}

// a closed tube round a loop: rings of `sides` about the tangent, the loop
// pushed `lift` along `outN` first (a pane sits behind the skin's edge; the
// bead has to stand proud of the skin to be seen)
function tube(loop0, r, sides, out, outN, lift) {
  const loop = outN ? loop0.map(p => add(p, mul(outN, lift || 0))) : loop0;
  const n = loop.length, base = out.pos.length / 3;
  let c = [0, 0, 0];
  for (const p of loop) c = add(c, p);
  c = mul(c, 1 / n);
  for (let i = 0; i < n; i++) {
    const p = loop[i], t = nrm(sub(loop[(i + 1) % n], loop[(i - 1 + n) % n]));
    let u = nrm(sub(p, c)); u = nrm(sub(u, mul(t, dot(u, t))));
    if (len(u) < 1e-6) u = nrm(crs(t, [1, 0, 0]));
    const v = nrm(crs(t, u));
    for (let s = 0; s < sides; s++) {
      const a = 2 * Math.PI * s / sides, d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      out.pos.push(p[0] + d[0] * r, p[1] + d[1] * r, p[2] + d[2] * r);
      out.nrm.push(d[0], d[1], d[2]);
      out.uv.push(i * 0.05, s / sides * 0.2);
    }
  }
  for (let i = 0; i < n; i++) for (let s = 0; s < sides; s++) {
    const a = base + i * sides + s, b = base + i * sides + (s + 1) % sides;
    const c2 = base + ((i + 1) % n) * sides + (s + 1) % sides, d = base + ((i + 1) % n) * sides + s;
    out.idx.push(a, d, c2, a, c2, b);
  }
}

// Sutherland-Hodgman against the banner rectangle in (z, y)
function clipRect(poly, R) {
  const edges = [p => p[2] - R.z0, p => R.z1 - p[2], p => p[1] - R.y0, p => R.y1 - p[1]];
  let out = poly;
  for (const f of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push(add(a, mul(sub(b, a), t))); }
    }
    if (!out.length) return out;
  }
  return out;
}

function plan(parts, opts) {
  const o = opts || {}, R = Object.assign({}, BANNER, o.banner || {});
  const roles = [], decals = { pos: [], nrm: [], uv: [], uvN: [], idx: [] };
  let glass = null, gaskets = { pos: [], nrm: [], uv: [], idx: [], loops: 0 };
  for (const part of parts) {
    const role = ROLE[part.mat] || 'trim';
    if (role === 'glass') {
      glass = { pos: part.pos, idx: part.idx, uv: metricUV(part.pos, part.nrm), nrm: part.nrm };
      const loops = boundaryLoops(part.pos, part.idx);
      // each pane's outward normal: the author's, averaged over the pane's vertices nearest the loop
      const nearN = q => { let best = 1e9, nn = [0, 0, 1]; for (let i = 0; i < part.pos.length; i += 3) { const d = Math.hypot(part.pos[i] - q[0], part.pos[i + 1] - q[1], part.pos[i + 2] - q[2]); if (d < best) { best = d; nn = [part.nrm[i], part.nrm[i + 1], part.nrm[i + 2]]; } } return nn; };
      for (const lp of loops) {
        let outN = [0, 0, 0];
        for (const q of lp) outN = add(outN, nearN(q));
        outN = nrm(outN);
        const smooth = resample(chaikin(lp, 3), 0.05);
        tube(smooth, 0.045, 6, gaskets, outN, 0.04);
        gaskets.loops++;
      }
      continue;
    }
    roles.push({ mat: part.mat, role, uv: metricUV(part.pos, part.nrm) });
    if (role !== 'body') continue;
    // the livery on the flanks: the body's outermost skin either side
    const p = part.pos, ix = part.idx;
    let xL = 1e9, xR = -1e9;
    for (let i = 0; i < p.length; i += 3) { xL = Math.min(xL, p[i]); xR = Math.max(xR, p[i]); }
    R.xL = xL; R.xR = xR;
    for (let t = 0; t < ix.length; t += 3) {
      const A = [p[ix[t] * 3], p[ix[t] * 3 + 1], p[ix[t] * 3 + 2]], B = [p[ix[t + 1] * 3], p[ix[t + 1] * 3 + 1], p[ix[t + 1] * 3 + 2]], C = [p[ix[t + 2] * 3], p[ix[t + 2] * 3 + 1], p[ix[t + 2] * 3 + 2]];
      const fn = nrm(crs(sub(B, A), sub(C, A)));
      if (Math.abs(fn[0]) < 0.6) continue;
      const sx = fn[0] > 0 ? 1 : -1;
      if (sx > 0 ? Math.min(A[0], B[0], C[0]) < xR - R.flank : Math.max(A[0], B[0], C[0]) > xL + R.flank) continue;
      const poly = clipRect([A, B, C], R);
      if (poly.length < 3) continue;
      const base = decals.pos.length / 3;
      for (const q of poly) {
        decals.pos.push(q[0] + sx * 0.006, q[1], q[2]);
        decals.nrm.push(sx, 0, 0);
        // a viewer at +x looks along -x and their right hand is -z (right =
        // forward x up), so on the +x flank u grows toward -z; the far flank the other way
        const u = sx > 0 ? (R.z1 - q[2]) / (R.z1 - R.z0) : (q[2] - R.z0) / (R.z1 - R.z0);
        decals.uv.push(u, (q[1] - R.y0) / (R.y1 - R.y0));
        decals.uvN.push(q[2], q[1]);
      }
      for (let k = 1; k < poly.length - 1; k++) decals.idx.push(base, base + k, base + k + 1);
    }
  }
  return { roles, glass, gaskets, decals, banner: R };
}

// ---- the meshes ------------------------------------------------------------
let MATS = null;
function mats(THREE, HG) {
  if (MATS) return MATS;
  const mk = (key, col, o) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.3 }); HG.dressMat(m, key, col, o || {}); return m; };
  const body = mk('steelgrey', 1, { nrm: 1.1, rough: 0.75 }); body.metalness = 0.35;
  const trim = mk('steelgrey', 8, { nrm: 1.1, rough: 0.85 }); trim.metalness = 0.5;
  const floor = mk('deckwood', 0, { nrm: 1.4, rough: 1.0 });
  const hanger = mk('steelgrey', 0, { nrm: 1.2, rough: 0.7 }); hanger.metalness = 0.85;
  const detail = mk('galv', 8, { nrm: 1.0, rough: 0.6 }); detail.metalness = 0.7;
  const rail = mk('galv', 0, { nrm: 1.0, rough: 0.55 }); rail.metalness = 0.85;
  const gasket = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92, metalness: 0.05 });
  MATS = { body, trim, floor, hanger, detail, rail, gasket, decal: {} };
  return MATS;
}
// the decal: the banner as diffuse, the steel's normal through the metric uv
function decalMat(THREE, HG, livery) {
  const M = mats(THREE, HG);
  if (M.decal[livery]) return M.decal[livery];
  const L = (typeof CABIN_LIVERY !== 'undefined' && CABIN_LIVERY) ? CABIN_LIVERY[livery] : null;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.12, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  HG.dressMat(m, 'steelgrey', 0, { nrm: 0.9 });
  m.color.setHex(0xffffff); m.roughnessMap = null; m.metalness = 0.12; m.roughness = 0.55;
  if (L) {
    const t = new THREE.Texture(L.img);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.encoding = THREE.sRGBEncoding;
    const ok = () => { t.needsUpdate = true; };
    if (L.img.complete && L.img.naturalWidth) ok(); else L.img.addEventListener('load', ok);
    m.map = t;
  }
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec2 aUvN; varying vec2 vUvN;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vUvN = aUvN;');
    sh.fragmentShader = 'varying vec2 vUvN;\n' + sh.fragmentShader
      .replace('#include <normal_fragment_maps>',
        '#ifdef USE_NORMALMAP\n  { vec3 mapN = texture2D(normalMap, vUvN * 0.5).xyz * 2.0 - 1.0; mapN.xy *= normalScale; normal = perturbNormal2Arb(-vViewPosition, normal, mapN, faceDirection); }\n#endif');
  };
  m.needsUpdate = true;
  M.decal[livery] = m;
  return m;
}

const geo = (THREE, pos, nrmA, uv, idx, extra) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos instanceof Float32Array ? pos : new Float32Array(pos), 3));
  if (nrmA) g.setAttribute('normal', new THREE.BufferAttribute(nrmA instanceof Float32Array ? nrmA : new Float32Array(nrmA), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv instanceof Float32Array ? uv : new Float32Array(uv), 2));
  if (extra) for (const k in extra) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(extra[k].a), extra[k].n));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  if (!nrmA) g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
};

// opts: { livery: 'admiralty' | 'chatham' }
function build(THREE, opts) {
  const o = opts || {}, HG = window.HOUSE_GEN, K = window.HOUSE_KIT;
  const grp = new THREE.Group();
  grp.name = 'cabin:' + (o.livery || 'admiralty');
  const place = () => {
    const b = propBuild(THREE, 'tram_cabin');
    const parts = b.geos.map((g, i) => ({ mat: b.prop.parts[i].mat, pos: g.attributes.position.array, nrm: g.attributes.normal.array, idx: g.index.array }));
    const P = plan(parts, o);
    const M = mats(THREE, HG);
    for (let i = 0; i < P.roles.length; i++) {
      const r = P.roles[i], src = parts.find(p => p.mat === r.mat);
      const m = new THREE.Mesh(geo(THREE, src.pos, src.nrm, r.uv, src.idx), M[r.role] || M.trim);
      m.castShadow = true; m.receiveShadow = true; grp.add(m);
    }
    if (P.glass) {
      const bag = K.Bag('glass');
      bag.setWin(1.2, 1.0, 0);
      const p = P.glass.pos, u = P.glass.uv, ix = P.glass.idx, vs = [];
      for (let i = 0; i < p.length / 3; i++) vs.push(bag.v([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]], [u[i * 2], u[i * 2 + 1]]));
      for (let t = 0; t < ix.length; t += 3) bag.tri(vs[ix[t]], vs[ix[t + 1]], vs[ix[t + 2]]);
      bag.setWin(0);
      const gm = bag.mesh(grp, HG.MAT.glass);
      if (gm) gm.castShadow = false;
    }
    if (P.gaskets.idx.length) {
      const m = new THREE.Mesh(geo(THREE, P.gaskets.pos, P.gaskets.nrm, P.gaskets.uv, P.gaskets.idx), M.gasket);
      m.castShadow = false; grp.add(m);
    }
    if (P.decals.idx.length) {
      const m = new THREE.Mesh(geo(THREE, P.decals.pos, P.decals.nrm, P.decals.uv, P.decals.idx, { aUvN: { a: P.decals.uvN, n: 2 } }), decalMat(THREE, HG, o.livery || 'admiralty'));
      m.castShadow = false; grp.add(m);
    }
    grp.userData.plan = { gasketLoops: P.gaskets.loops, decalTris: P.decals.idx.length / 3 };
  };
  if (propReady('tram_cabin')) place();
  else propWarm('tram_cabin').then(place).catch(e => console.warn('cabin failed to load:', e && e.message));
  grp.userData.hang = HANG;
  return grp;
}

const API = { plan, build, ROLE, BANNER, HANG, LIVERIES: ['admiralty', 'chatham'], boundaryLoops, chaikin, resample, clipRect };
if (typeof window !== 'undefined') window.CABIN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
