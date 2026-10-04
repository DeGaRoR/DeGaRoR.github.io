// premises_build.js - THE PREMISES' GENERATION, ON EITHER THREAD (G830, C2a of QUEUE-C; futureDesigns/ARCH-2026-09-27.md
// §3.2 (b), §3.4 step 1).
//
// render_premises.js built a house as ONE interleaved walk on the main thread: VILLAGE_GEN.placeHouse on the composed
// ground, the finish, HOUSE_GEN.build (the voxel AO bake inside: 100-200 ms a house), its meshes, its lod 1, its
// obstacle, then the plot's dressing (finishPlot, the fence's bags and bake, the outbuilding's build, the lot patch)
// with their meshes in between. This file is the GENERATION half of that walk, cut out and made thread-agnostic: it
// reads the composed record (O), the generators on its globals (the page's window or the worker's self) and nothing
// of the scene. render_premises.js keeps the PLACEMENT half (meshes, props, obstacles, lamps) and runs this either
// inline (the fallback: no Worker, file://, the bench, the editor) or through src/viewer/house_worker.js, where the
// same code runs in a Blob worker and hands back transferable typed arrays.
//
// THE VILLAGE HAS A MEMORY, AND IT IS ORDER-DEPENDENT. Two tallies are shared by every plot a premises dresses:
//   SPREAD   HOUSE_GEN.makeSpread(): the village-wide count per prop key (the yard's boat, the pier's people, the
//            drive's car) - each pick takes the least used; made lazily by the first house (an item dressed before
//            any house dresses with none: a different menu);
//   FENCED   the edges already fenced (VILLAGE_GEN.edgeKey): a side shared with a neighbour is fenced once, and a
//            skipped edge skips a draw of the plot's rnd - so everything finishPlot plans after it moves too.
// A house's output is a pure function of (the record, the plot, the two tallies before it, the dials). Whichever
// thread generates, the tallies travel with the work: a result carries its DELTA (the counts it added, the edges it
// fenced), the page applies it to its own copy in the order it places, and a batch of work carries the page's copy
// when the worker's may differ. The IndexedDB cache keys on a hash of the tallies too (house_worker.js).
'use strict';
(function () {
const ROOT = typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis);
// THE RESULT'S LAYOUT (bump it when a gen or the packed shape changes: it is part of the cache key)
const PB_V = 2;   // 2: lod 1 packed with every attribute (G1395's far town reads uv and the town shader's channels)

// ---- plain data: what crosses a thread (functions, getters and the named keys dropped; typed arrays kept) ----------
function plain(v, skip, seen) {
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (ArrayBuffer.isView(v)) return v;
  seen = seen || new Map();
  if (seen.has(v)) return seen.get(v);
  if (Array.isArray(v)) { const a = []; seen.set(v, a); for (let i = 0; i < v.length; i++) { const c = plain(v[i], skip, seen); a.push(c === undefined ? null : c); } return a; }
  if (v instanceof Set) { const s = new Set(); seen.set(v, s); for (const x of v) { const c = plain(x, skip, seen); if (c !== undefined) s.add(c); } return s; }
  if (v instanceof Map) { const m = new Map(); seen.set(v, m); for (const [k, x] of v) { const c = plain(x, skip, seen); if (c !== undefined) m.set(k, c); } return m; }
  const o = {}; seen.set(v, o);
  for (const k of Object.keys(v)) {
    if (skip && skip.has(k)) continue;
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (!d || d.get || d.set) continue;
    const c = plain(d.value, skip, seen);
    if (c !== undefined) o[k] = c;
  }
  return o;
}
const SKIP = new Set(['spread', 'built', 'ground', 'toWorld']);

// ---- the finish's uniforms a BUILD writes (HOUSE_GEN.build's sag goes to F.SHADE_U) ------------------------------
// The page makes and dresses its own finish (materials, textures - main-thread things); a remote build hands back only
// what the build itself changed on the finish it was given, read as a before/after of every uniform value.
function uniGroups(F) {
  const out = [];
  if (!F) return out;
  for (const k of ['SHADE_U', 'GLASS_U', 'SMOKE_U', 'GROUND_U']) if (F[k]) out.push([k, F[k]]);
  if (F.HF) for (const k of ['SHADE_U', 'GLASS_U', 'SMOKE_U', 'GROUND_U']) if (F.HF[k]) out.push(['HF.' + k, F.HF[k]]);
  if (F.MAT) for (const m of Object.keys(F.MAT)) { const ud = F.MAT[m] && F.MAT[m].userData; if (ud) for (const g of Object.keys(ud)) if (ud[g] && typeof ud[g] === 'object' && !Array.isArray(ud[g]) && !('value' in ud[g])) out.push(['MAT.' + m + '.' + g, ud[g]]); }
  return out;
}
const uniVal = v => (typeof v === 'number' || typeof v === 'boolean') ? v
  : (v && typeof v.toArray === 'function' && (v.isColor || v.isVector2 || v.isVector3 || v.isVector4)) ? v.toArray() : undefined;
function uniSnap(F) {
  const s = {};
  for (const [g, U] of uniGroups(F)) for (const n of Object.keys(U)) { const u = U[n]; if (u && typeof u === 'object' && 'value' in u) { const x = uniVal(u.value); if (x !== undefined) s[g + '|' + n] = x; } }
  return s;
}
const same = (a, b) => (Array.isArray(a) && Array.isArray(b)) ? a.length === b.length && a.every((x, i) => Object.is(x, b[i])) : Object.is(a, b);
function uniDiff(s0, F) {
  const s1 = uniSnap(F); let d = null;
  for (const k of Object.keys(s1)) if (!(k in s0) || !same(s0[k], s1[k])) (d = d || {})[k] = s1[k];
  return d;
}
function uniApply(F, d) {
  if (!F || !d) return;
  const groups = new Map(uniGroups(F));
  for (const k of Object.keys(d)) {
    const i = k.lastIndexOf('|'), U = groups.get(k.slice(0, i)), u = U && U[k.slice(i + 1)];
    if (!u) continue;
    const v = d[k];
    if (Array.isArray(v)) { if (u.value && u.value.fromArray) u.value.fromArray(v); }
    else u.value = v;
  }
}

// ---- a build's bags, packed for a transfer, and their stand-in on the page --------------------------------------
// The worker meshes each bag through HOUSE_KIT's own Bag.mesh on its own three.js (position, uv, aHouseAO, aHouseLit,
// aHouseWin, the index at three's own width, computeVertexNormals then the bag's normal overrides) and ships the
// geometry's arrays. The page's RemoteBag.mesh stands them up as they came: the same arrays, in the same attribute
// order, as the page's own Bag.mesh would have made (GATE HOUSEWORKER hashes both).
function packBag(bag, THREE, keep, tr) {
  if (!bag || typeof bag.mesh !== 'function') return { e: 1 };
  const m = bag.mesh(new THREE.Group(), null);
  if (!m) return { e: 1 };
  const g = m.geometry, a = [];
  for (const n of Object.keys(g.attributes)) {
    if (keep && !keep.has(n)) continue;
    const at = g.attributes[n]; a.push([n, at.itemSize, at.array]); if (tr) tr.push(at.array.buffer);
  }
  const i = g.index ? g.index.array : null;
  if (i && tr) tr.push(i.buffer);
  return { a, i, t: bag.tris, v: bag.verts };
}
// `only(k)`: the bags to pack (lod 1: the ones lod1Bags keeps); `keep`: the attributes (null: every one)
function packBuilt(b, THREE, tr, only, keep) {
  if (!b) return null;
  const bags = {};
  for (const k of Object.keys(b.bags || {})) bags[k] = (!only || only(k)) ? packBag(b.bags[k], THREE, keep, tr) : { e: 1 };
  return { bags, BAGS: b.BAGS || null, stats: plain(b.stats, SKIP) };
}
function RemoteBag(THREE, name, p) {
  const empty = !p || p.e;
  return {
    name, remote: true,
    get tris() { return empty ? 0 : p.t; },
    get verts() { return empty ? 0 : p.v; },
    data() { if (empty) return { pos: [], uv: [], idx: [], ao: [], lit: [], win: [] }; const A = {}; for (const [n, , arr] of p.a) A[n] = arr; return { pos: A.position || [], uv: A.uv || [], idx: p.i || [], ao: A.aHouseAO || [], lit: A.aHouseLit || [], win: A.aHouseWin || [] }; },
    mesh(parent, mat) {
      if (empty || !p.i || !p.i.length) return null;
      const g = new THREE.BufferGeometry();
      for (const [n, s, arr] of p.a) g.setAttribute(n, new THREE.BufferAttribute(arr, s));
      g.setIndex(new THREE.BufferAttribute(p.i, 1));
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    },
  };
}
function unpackBuilt(THREE, pb) {
  if (!pb) return null;
  const bags = {};
  for (const k of Object.keys(pb.bags)) bags[k] = RemoteBag(THREE, k, pb.bags[k]);
  const out = { bags, stats: pb.stats || {} };
  if (pb.BAGS) out.BAGS = pb.BAGS;
  return out;
}
// the lot patch (VILLAGE_GEN.lotGround's plan): its geometry made where it was planned (LOT_GROUND.geometry, the same
// recipe LOT_GROUND.mesh used inline), packed
function packLot(L, THREE, tr) {
  if (!L) return null;
  const LG = ROOT.LOT_GROUND;
  if (!LG || !LG.geometry || !L.idx || !L.idx.length) return plain(L);
  const g = LG.geometry(THREE, L), a = [];
  for (const n of Object.keys(g.attributes)) { const at = g.attributes[n]; a.push([n, at.itemSize, at.array]); tr.push(at.array.buffer); }
  const i = g.index.array; tr.push(i.buffer);
  return { geo: { a, i }, verts: L.verts, idx: { length: i.length } };
}

// ---- THE OBSTACLE OF A BUILD'S OWN BAGS (G844, C2c) -----------------------------------------------------------------
// render_premises hitAdd rasterised every house on the main thread (shapeOf: a vertex walk of the group, then
// OBSTACLES.rasterise - ~2-3 ms a house, the town step's next cost after C2a). The worker holds the bags: it rasterises
// them here, with the page's own arithmetic - the group's matrix as placeBuilt stands it (under an identity chain), the
// inverse of its yaw and position times that matrix per vertex, w divide and all, shapeOf's filters (a ghost material,
// a flat bag) - and the page marks only what it adds (the props) over this base (29_obstacles rasterise opts.base).
// shape0: { cell, ox, oz, nx, nz, lo, hi } in the group's frame, lo / hi transferred.
function frameMatrix(THREE, O, h) {
  const w = O.frame.toWorld(h.x, h.z), g = new THREE.Object3D();
  g.position.set(w[0], h.y, w[1]); g.rotation.y = h.yaw + O.frame.yaw; g.updateMatrixWorld(true);
  return g.matrixWorld;
}
function packedShape(THREE, pb, F, BAGS, Mw, cell) {
  const OB = typeof OBSTACLES !== 'undefined' ? OBSTACLES : (ROOT.OBSTACLES || null);
  if (!OB || !pb || !F || !Mw) return null;
  const e = Mw.elements, yaw = Math.atan2(e[8], e[0]);
  const inv = new THREE.Matrix4().makeRotationY(yaw).setPosition(e[12], e[13], e[14]).invert();
  const M = new THREE.Matrix4().multiplyMatrices(inv, Mw), m = M.elements;
  const pos = [], idx = [];
  const add = (p, mt) => {
    if (!p || p.e || !p.i || !p.i.length || !mt) return;
    if (mt.transparent && (mt.opacity < 0.5 || mt.depthWrite === false)) return;   // smoke, skirts, glows (shapeOf's ghost)
    let A = null; for (const [n, s, arr] of p.a) if (n === 'position' && s === 3) A = arr;
    if (!A) return;
    const base = pos.length / 3, n = A.length / 3; let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2], w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
      const X = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w, Y = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w, Z = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
      pos.push(X, Y, Z); if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    if (y1 - y0 < 0.15) { pos.length = base * 3; return; }                              // a flat thing is the ground's
    for (let i = 0; i < p.i.length; i++) idx.push(base + p.i[i]);
  };
  for (const k of (pb.BAGS || BAGS)) add(pb.bags[k], F.MAT[k]);
  if (pb.bags.smoke) add(pb.bags.smoke, F.MAT.smoke);
  if (!idx.length) return null;
  const S = OB.rasterise(pos, idx, cell);
  return S ? { cell: S.cell, ox: S.ox, oz: S.oz, nx: S.nx, nz: S.nz, lo: S.lo, hi: S.hi } : null;
}

// ---- a frame from its numbers: placeHouse / planOutbuilding's toWorld and ground, re-made on the page --------------
// (the same expressions on the same numbers: the functions do not cross a thread, their inputs do)
function frameFns(h, Th) {
  const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw), c0 = h.x, c1 = h.z, oy = h.y;
  h.toWorld = (lx, lz) => [c0 + lx * cy + lz * sy, c1 - lx * sy + lz * cy];
  h.ground = (lx, lz) => { const w = h.toWorld(lx, lz); return Th(w[0], w[1]) - oy; };
  if (h.P) h.P.ground = h.ground;
  return h;
}

// ---- THE COOK'S TALLIES (G841, C2c of QUEUE-C) ------------------------------------------------------------------
// The tallies above are order-dependent, and the page built by distance from the aircraft: the same house dressed
// differently from another stand (another boat, the neighbour's fence), and the house cache (house_worker.js) keyed each
// entry on whatever had been built before it - a second visit from another stand, or a reload after an edit, missed.
// tools/premises_cook.js builds the queue in the RECORD's order (syncHouses') and ships each entry's delta; with them
// an entry's tallies are the ones the cook gave it - the deltas of every entry before it in that order - whatever
// order the page or the worker builds in, and the page dresses exactly as the cook placed. A live entry the cook did
// not know (the editor's) takes the rank after the cooked entry the live record lists before it (render_premises
// ranks its queue); an edited entry keeps its own rank; its new delta moves nobody else's tallies (the town round an
// edit stays as it was, down to its boats).
//   list: [[id, seed, delta | 0], ...] in the cook's order -> { n, rank(id) -> index | -1, at(rank) -> getState()'s shape }
function makeTallies(list) {
  const rank = new Map(); list.forEach((e, i) => { if (!rank.has(String(e[0]))) rank.set(String(e[0]), i); });
  const K = 32, snaps = [], edges = [], cnt = [];   // the spread's counts every K entries; the fenced edges in order, and how many precede each entry
  let made = false; const used = {};
  const add = (d, u) => { if (d.made) made = true; if (d.used) for (const k of Object.keys(d.used)) u[k] = (u[k] || 0) + d.used[k]; };
  for (let i = 0; i <= list.length; i++) {
    if (i % K === 0) snaps.push({ made, used: Object.assign({}, used) });
    cnt.push(edges.length);
    if (i === list.length) break;
    const d = list[i][2]; if (!d) continue;
    add(d, used); if (d.fenced) for (const e of d.fenced) edges.push(e);
  }
  function at(r) {
    r = Math.max(0, Math.min(list.length, r | 0));
    const b = Math.floor(r / K), s = snaps[b], u = Object.assign({}, s.used); let m = s.made;
    for (let i = b * K; i < r; i++) { const d = list[i][2]; if (d) { if (d.made) m = true; if (d.used) for (const k of Object.keys(d.used)) u[k] = (u[k] || 0) + d.used[k]; } }
    return { made: m, used: m ? u : null, fenced: edges.slice(0, cnt[r]) };
  }
  return { n: list.length, rank: id => (rank.has(String(id)) ? rank.get(String(id)) : -1), at };
}
// the ranks of a live queue (the want order of render_premises syncHouses - the cook's own order): each entry's rank in
// the cook, or the rank after the last cooked entry listed before it; null when the cook knows too little of this record
// (another premises on the same island: under half its entries) - then the tallies are the live ones, as before G841
function rankQueue(T, ids) {
  if (!T) return null;
  const out = new Array(ids.length); let last = -1, hit = 0;
  for (let i = 0; i < ids.length; i++) { const r = T.rank(ids[i]); if (r >= 0) { out[i] = r; last = r; hit++; } else out[i] = last + 1; }
  return hit * 2 >= ids.length ? out : null;
}

// ---- THE BUILDER -----------------------------------------------------------------------------------------------
// C (read at call time, so the page's recompose is seen): { G: the globals, PG, O, rec, waterY(), size(), game,
// lod1, outLod, props: the prop keys the page's registry holds (a Set, or null), pp: the page places props,
// lotGround: the page draws lot patches, warn }
function makeBuilder(C) {
  const PG = C.PG;
  const S = { spread: null, fenced: new Set() };
  const FENCE_HAND = 0.6;
  const warn = C.warn || ((...a) => { try { console.warn(...a); } catch (e) {} });
  const G = () => C.G;
  const hasProp = k => !!(C.pp && C.props && C.props.has(k));

  // ---- the tallies ----
  function mark() { return { made: !!S.spread, used: S.spread ? Object.assign({}, S.spread.used) : null, n: S.fenced.size }; }
  function delta(m0) {
    let d = null;
    if (!m0.made && S.spread) (d = d || {}).made = 1;
    if (S.spread) { let u = null; for (const k of Object.keys(S.spread.used)) { const v = S.spread.used[k] - ((m0.used && m0.used[k]) || 0); if (v) (u = u || {})[k] = v; } if (u) (d = d || {}).used = u; }
    if (S.fenced.size > m0.n) (d = d || {}).fenced = Array.from(S.fenced).slice(m0.n);
    return d;
  }
  function applyDelta(d) {
    if (!d) return;
    if (d.made && !S.spread && G().HOUSE_GEN && G().HOUSE_GEN.makeSpread) S.spread = G().HOUSE_GEN.makeSpread();
    if (d.used && S.spread) for (const k of Object.keys(d.used)) S.spread.used[k] = (S.spread.used[k] || 0) + d.used[k];
    if (d.fenced) for (const k of d.fenced) S.fenced.add(k);
  }
  function getState() { return { made: !!S.spread, used: S.spread ? Object.assign({}, S.spread.used) : null, fenced: Array.from(S.fenced) }; }
  function setState(st) {
    S.spread = st && st.made && G().HOUSE_GEN && G().HOUSE_GEN.makeSpread ? G().HOUSE_GEN.makeSpread() : null;
    if (S.spread && st.used) Object.assign(S.spread.used, st.used);
    S.fenced.clear(); if (st && st.fenced) for (const k of st.fenced) S.fenced.add(k);
  }
  // a hash of the tallies (the cache's key): a zero count is no count, the edges as a set
  function stateHash() {
    let s = S.spread ? '1' : '0';
    if (S.spread) { const u = S.spread.used; for (const k of Object.keys(u).sort()) if (u[k]) s += '|' + k + '=' + u[k]; }
    s += '#'; for (const k of Array.from(S.fenced).sort()) s += k + ';';
    return PG.fnv(s);
  }

  // ---- THE COOK'S TALLIES, applied (G841): an entry of rank r generates on the tallies the cook gave it ----
  let TL = null;
  function useTallies(T) { TL = T || null; }
  function atRank(r) { if (TL && r !== undefined && r !== null && r >= 0) { setState(TL.at(r)); return true; } return false; }

  // ---- THE ENTRY'S INPUTS (G841): what its generation reads besides the tallies and the dials - the house cache's key
  // (house_worker.js) in place of the whole record's hash, so an edit re-generates the entries it touched and no others:
  // the entry as COMPOSED (taken at the composition, before a dressing writes into it: sownAll), the record's seed, the
  // premises' size and the water; a house's zone rules and road; and the GROUND under its reach - the raster cells'
  // signatures (27_premises rasterCellSig: every modifier that reaches the cell, what each answers, and the island
  // under it), so a ground edit next door re-keys it too. A cell signature is cached per composition.
  const SOWN = new Map(), CSIG = new Map();
  const DRESSED = new Set(['cat', 'path', 'fences', 'out', 'outPath', 'car', 'boat', 'drive', 'lot', 'house', 'built', 'plot', 'entry', 'grp']);
  const sownJSON = x => JSON.stringify(plain(x, new Set([...SKIP, ...DRESSED])), (k, v) => (k && k[0] === '_' ? undefined : v));
  function sownAll() {
    const O = C.O, rec = C.rec; SOWN.clear(); CSIG.clear(); ZW.clear();
    for (const p of O.records.plots) SOWN.set('house:' + p.id, sownJSON(p));
    for (const it of O.records.items) SOWN.set('item:' + it.id, sownJSON(it));
    for (const st of rec.layers.sites || []) if (st.fences && st.fences.length) SOWN.set('fence:sf:' + st.id, JSON.stringify(st.fences));
  }
  const h64 = t => { let a = 0x811c9dc5, b = 0x6c62272e; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x5bd1e995); b ^= b >>> 15; } return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'); };
  function groundSig(pts, margin) {
    const O = C.O; if (!O || !O.rasterCellSig || !pts || !pts.length) return 'g?';
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const q of pts) { const x = Array.isArray(q) ? q[0] : q.x, z = Array.isArray(q) ? q[1] : q.z; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (!isFinite(x0)) return 'g?';
    const S = O.rasterCell || 256, out = [];
    for (let i = Math.floor((x0 - margin) / S); i <= Math.floor((x1 + margin) / S); i++)
      for (let j = Math.floor((z0 - margin) / S); j <= Math.floor((z1 + margin) / S); j++) {
        const k = i + ',' + j; let s = CSIG.get(k); if (s === undefined) CSIG.set(k, s = O.rasterCellSig(i, j)); out.push(k + '=' + s);
      }
    return out.join(';');
  }
  function inputSig(j, x) {
    const O = C.O, rec = C.rec, parts = [PB_V, j.kind, rec.seed, C.size(), C.waterY(), SOWN.get(j.kind + ':' + j.id) || '?'];
    if (j.kind === 'house') {
      parts.push(zoneWaterY(x));   // G843
      const z = (rec.layers.zones || []).find(q => q.id === x.zone), rd = O.roads.find(r => r.id === x.road) || O.roads[0];
      parts.push(JSON.stringify(z ? z.rules || null : null), JSON.stringify(rd ? [rd.id, rd.pts, rd.w] : null), groundSig(x.poly, 40));
    } else if (j.kind === 'item') parts.push(groundSig(x.foot && x.foot.length ? x.foot : [[x.x, x.z]], 40));
    else if (j.kind === 'fence') { const pts = []; for (const s of x.fences || []) { if (s.a) pts.push(s.a); if (s.b) pts.push(s.b); } parts.push(groundSig(pts, 10)); }
    return h64(parts.join('\u0001'));
  }

  // ---- the fence: the village's own rails and pickets into two bags, the scanned stretches as prop placements ----
  function genFence(segs, T, seed, posts) {
    const g = G(), VG = g.VILLAGE_GEN, HG = g.HOUSE_GEN, HK = g.HOUSE_KIT;
    if (!VG || !HK || !segs || !segs.length || C.fences === false) return null;   // (the data cook keeps no fence geometry)
    const bags = { post: HK.Bag('post'), deck: HK.Bag('deck') };
    const props = [];
    let n = 0;
    for (const seg0 of segs) {
      const seg = VG.clipToLand(T, seg0);
      if (!seg) continue;
      if (seg.style === 'old' && hasProp('fence_old') && HG.YARD_KIT && HG.YARD_KIT.fence_old) {
        // the scanned stretch, one prop width at a time along the edge, on the ground under its own middle, the gate's bay left out
        const L = Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]), tg = [(seg.b[0] - seg.a[0]) / L, (seg.b[1] - seg.a[1]) / L];
        const Wd = HG.YARD_KIT.fence_old.W, ry = Math.atan2(tg[0], tg[1]) - Math.PI / 2;
        const parts = seg.gap ? [[0, Math.max(0, seg.gap[0])], [Math.min(L, seg.gap[1]), L]] : [[0, L]];
        for (const [u0, u1] of parts) {
          if (u1 - u0 < 0.8) continue;
          const ns = Math.max(1, Math.round((u1 - u0) / Wd)), pw = (u1 - u0) / ns;
          for (let i = 0; i < ns; i++) { const tm = u0 + pw * (i + 0.5), x = seg.a[0] + tg[0] * tm, z = seg.a[1] + tg[1] * tm; props.push({ x, z, ry, y: T.h(x, z) - 0.03, sx: pw / Wd }); n++; }
        }
        if (seg.gap) n += VG.gateLeaf(bags, T, seg.a, tg, Math.max(0.3, seg.gap[0]), Math.min(L - 0.3, seg.gap[1]), 1.15, FENCE_HAND, () => 0.3, 'old');
      } else { seg.feet = posts || []; n += VG.buildFence(bags, T, seg, FENCE_HAND, seed); }
    }
    if (!n) return null;
    HK.bakeAO([bags.post, bags.deck], { strength: 0.85, range: 0.5, ground: T.h });
    return { bags, props, n };
  }

  // ---- the dressing (v5): the village's own plan functions on the BUILT house ----
  function genDress(plot, house, built, V, Tv, roadOverride) {
    const g = G(), VG = g.VILLAGE_GEN, HG = g.HOUSE_GEN, O = C.O;
    const D = { ok: false, fence: null, out: null, lot: null };
    if (!VG || !VG.finishPlot) return D;
    const rd = roadOverride || O.roads.find(r => r.id === plot.road) || O.roads[0];
    if (!rd) return D;
    const T = { h: Tv.h, size: Tv.size, waterY: Tv.waterY };
    const vil = { rnd: PG.mulberry32(plot.seed ^ 0x5eed), V, road: { pts: rd.pts, w: rd.w }, fenced: S.fenced, T, spread: S.spread, plots: O.records.plots, houses: [] };
    try { VG.finishPlot(vil, plot, house, built); } catch (e) { warn('premises dress', plot.id, e && e.message); return D; }
    D.ok = true;
    const posts = [];
    D.fence = genFence(plot.fences, T, (PG.fnv(String(plot.id)) % 1000) * 7 + 1, posts);
    // the outbuilding: the same generator, its own finish, at lod 1 in the game (G800); the bench keeps lod 0
    if (plot.out) {
      try {
        const F2 = HG.makeFinish(); HG.applyFinish(plot.out.P, F2);
        const u2 = uniSnap(F2);
        const b2 = HG.build(plot.out.P, (C.outLod && C.game) ? 1 : 0, F2); b2.BAGS = HG.BAGS; plot.out.built = b2;
        D.out = { built: b2, F: F2, fin: uniDiff(u2, F2) };
      } catch (e) { warn('premises outbuilding', plot.id, e && e.message); plot.out = null; }
    }
    // the occluders the lot patch reads: the builds' own ground AO, the car and the boat, the fence's feet
    const occ = [];
    const toW = (hh, o) => { const w = hh.toWorld(o.x, o.z); return Object.assign({}, o, { x: w[0], z: w[1], ry: (o.ry || 0) + hh.yaw }); };
    for (const o of built.stats.groundAO || []) occ.push(toW(house, o));
    if (plot.out && plot.out.built) for (const o of plot.out.built.stats.groundAO || []) occ.push(toW(plot.out, o));
    const lotCars = plot.lot && plot.lot.cars ? plot.lot.cars : [];
    for (const c of [plot.car, plot.boat].concat(lotCars)) if (c && hasProp(c.key)) {
      const K = plot.boat === c ? (HG.PIER_KIT || {})[c.key] : (HG.YARD_KIT || {})[c.key];
      if (K) occ.push({ x: c.x, z: c.z, hx: K.W / 2, hz: K.L / 2, ry: c.ry, k: plot.boat === c ? 0.6 : 0.65, soft: plot.boat === c ? 0.9 : 1.0 });
    }
    for (const f of posts) if (Math.abs(f[0] - house.x) < 40 && Math.abs(f[1] - house.z) < 40) occ.push({ x: f[0], z: f[1], r: 0.07, k: 0.45, soft: 0.35 });
    if (C.lotGround && VG.lotGround) {
      try { D.lot = VG.lotGround(vil, plot, house, built, occ); }
      catch (e) { warn('premises lot', plot.id, e && e.message); }
    }
    return D;
  }

  // ---- THE WATER A HOUSE SEES (G843, C2c): its ZONE's, as the sower read it (27_premises.js zoneWaterY, G434: the lowest
  // finite water over the zone's box +-60 m). It was the water at the premises' ANCHOR (C.waterY) - on an island an
  // inland field, -Infinity - so a water plot's house never reached the waterline and no pier was ever built on Jolene:
  // the harbour zones sowed their water plots (G434) and stood houses with no piers and no boats at them. On the
  // analytic world (water 0 everywhere) the two are the same number. C.pierWater false: the anchor's (?pierwater=0).
  const ZW = new Map();
  function zoneWaterY(plot) {
    const O = C.O, rec = C.rec, w0 = C.waterY();
    if (C.pierWater === false || !C.waterH || !plot || !plot.zone) return w0;
    const z = (rec.layers.zones || []).find(q => q.id === plot.zone);
    if (!z || !z.poly || z.poly.length < 3) return w0;
    const key = z.id + '|' + JSON.stringify(z.poly);
    if (ZW.has(key)) return ZW.get(key);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const q of z.poly) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
    let best = Infinity;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) { const w = O.frame.toWorld(x0 - 60 + (x1 - x0 + 120) * i / 12, z0 - 60 + (z1 - z0 + 120) * j / 12); const v = C.waterH(w[0], w[1]); if (isFinite(v) && v < best) best = v; }
    const out = isFinite(best) ? best : w0;
    ZW.set(key, out);
    return out;
  }

  // ---- a house on its plot ----
  function genHouse(plot) {
    const g = G(), VG = g.VILLAGE_GEN, HG = g.HOUSE_GEN, O = C.O, rec = C.rec;
    if (!VG || !HG) return null;
    const waterY = zoneWaterY(plot);
    const Tv = { h: (lx, lz) => O.localH(lx, lz), waterY, size: C.size() };
    const rules = Object.assign({}, PG.ZONE_RULES, (rec.layers.zones.find(z => z.id === plot.zone) || {}).rules || {});
    const V = Object.assign({}, VG.VDEF, { plotDepth: rules.plotDepth, riparian: rules.riparian, seed: rec.seed });
    const rnd = PG.mulberry32(plot.seed);
    // the pick: a preset of the house generator when the zone's tag found one; the sampler else
    let preset;
    if (plot.pick && plot.pick !== 'sampler') { const e = PG.collect(g).entries.get(plot.pick); if (e && e.gen === 'HOUSE_GEN') preset = e.preset; }
    const house = VG.placeHouse(Tv, V, plot, plot.seed % 100000, rnd, preset);   // the village's own, exported at its landing (G369.1)
    if (!S.spread && HG.makeSpread) S.spread = HG.makeSpread();
    if (S.spread) house.P.spread = S.spread;
    const F = HG.makeFinish();
    HG.applyFinish(house.P, F);
    const u0 = uniSnap(F);
    const built = HG.build(house.P, 0, F);
    built.BAGS = HG.BAGS;
    // G800: its lod 1 in the same build, for the far town (the page keeps it only where it wants it: not in the
    // in-flight stream, not on the bench)
    let lod1 = null;
    if (C.lod1 && C.game) { try { lod1 = HG.build(house.P, 1, F); lod1.BAGS = lod1.BAGS || HG.BAGS; } catch (e) { warn('premises lod 1', plot.id, e && e.message); } }
    const fin = uniDiff(u0, F);
    const dress = genDress(plot, house, built, V, Tv);
    return { kind: 'house', house, built, lod1, F, fin, dress, Tv, V };
  }

  // ---- a site's item, and the synthetic plot it dresses (G401) ----
  function genItem(it) {
    const g = G(), GEN = g[it.gen], O = C.O, rec = C.rec;
    if (!GEN) return null;
    const F = GEN.makeFinish();
    GEN.applyFinish(it.P, F);
    const u0 = uniSnap(F);
    const built = GEN.build(it.P, 0, F);
    built.BAGS = built.BAGS || GEN.BAGS;          // a build may carry bags of its own (the hangar shell's, G405.1)
    const fin = uniDiff(u0, F);
    let plot = null, dress = null, Tv = null;
    try {
      const cat = (it.entry && it.entry.cat) || (g.VILLAGE_GEN && g.VILLAGE_GEN.lotCat ? g.VILLAGE_GEN.lotCat({}, { P: it.P, gen: it.gen, preset: it.P.preset }) : null);
      // ...unless the entry refuses one (contract v1.29 `lot: false`), the ITEM says no (G527 `P.lot: false`), or it
      // stands on a DECK (its lot would be laid on the seabed)
      const wantsLot = !(it.entry && it.entry.lot === false) && it.P.lot !== false && !isFinite(it.P.floorOverWater);
      if (wantsLot && cat && cat !== 'sports' && cat !== 'landmark' && !it.P.mill && !it.P.station && g.VILLAGE_GEN && g.VILLAGE_GEN.finishPlot) {
        const P = it.P, L = P.L || 10, w = P.w || 8, porch = P.porch ? (P.porchD || 2.4) : (P.dock ? (P.dockD || 2.4) + 2 : 0);
        const mx = (cat === 'industrial' ? 6 : (cat === 'residential' ? 7 : 5)) + (P.wing ? 7 : 0), front = cat === 'commercial' ? 14 : (cat === 'industrial' ? 16 : 10), back = cat === 'residential' ? 8 : 4;
        const c = Math.cos(it.yaw), sn = Math.sin(it.yaw);
        const W2 = (lx, lz) => [lx * c + lz * sn + it.x, -lx * sn + lz * c + it.z];        // the item's frame -> premises (house law)
        const zF = w / 2 + porch + front, zB = -w / 2 - back;
        const poly = [W2(-L / 2 - mx, zF), W2(L / 2 + mx, zF), W2(L / 2 + mx, zB), W2(-L / 2 - mx, zB)];   // frontage first, along +x
        const tg = [c, -sn], n = [-sn, -c];                                                                 // along the frontage; away from the road (-z)
        const roadPts = [W2(-L / 2 - mx - 30, zF + 6), W2(L / 2 + mx + 30, zF + 6)];
        plot = { id: 'site:' + it.id, side: 'land', poly, depth: zF - zB, n, tg, w: L + 2 * mx, front: W2(0, zF), cat, road: null, seed: it.seed | 0, synthetic: true };
        const house = { x: it.x, z: it.z, yaw: it.yaw, P, gen: it.gen, preset: it.P.preset, cat, toWorld: W2, ground: it.ground, built };
        const Vv = Object.assign({}, g.VILLAGE_GEN.VDEF, { seed: rec.seed });
        Tv = { h: (lx, lz) => O.localH(lx, lz), waterY: C.waterY(), size: C.size() };
        dress = genDress(plot, house, built, Vv, Tv, { pts: roadPts, w: 6 });
      }
    } catch (e) { warn('premises site lot', it.id, e && e.message); }
    return { kind: 'item', built, F, fin, plot, dress, Tv };
  }

  // ---- a site's own fences (G393.3), a park's ----
  function genFences(segs, seed) {
    const O = C.O;
    const Tp = { h: (lx, lz) => O.localH(lx, lz), size: C.size(), waterY: C.waterY() };
    return { kind: 'fence', fence: genFence(segs, Tp, seed, []), Tv: Tp };
  }

  // ---- ONE ENTRY OF THE QUEUE, generated: what it is, found in THIS thread's composition by id ----
  // j: { kind: 'house' | 'item' | 'fence', id, seed }. The seed is re-derived here: a record that is not the page's
  // (a stale composition) answers null and the page builds the entry itself.
  const itemSeed = it => PG.hash32(it.seed, PG.fnv(JSON.stringify([it.x, it.z, it.yaw, it.key, it.P.tramTo || null, it.P.floorY])));
  function find(j) {
    const O = C.O, rec = C.rec;
    if (j.kind === 'house') { const p = O.records.plots.find(q => q.id === j.id); return p && p.seed === j.seed ? p : null; }
    if (j.kind === 'item') { const it = O.records.items.find(q => q.id === j.id); return it && itemSeed(it) === j.seed ? it : null; }
    if (j.kind === 'fence') { const st = (rec.layers.sites || []).find(q => 'sf:' + q.id === j.id); return st && st.fences && PG.fnv(JSON.stringify(st.fences)) === j.seed ? st : null; }
    return null;
  }
  function gen(j, x) {
    if (j.kind === 'house') return genHouse(x);
    if (j.kind === 'item') return genItem(x);
    if (j.kind === 'fence') return genFences(x.fences, (PG.fnv(String(x.id)) % 1000) * 7 + 3);
    return null;
  }

  // ---- a result packed for the page (the worker's side): plain data + transferable arrays ----
  // lod1Keep(k, F): the bags lod1Bags keeps (opaque standard materials) - read off THIS thread's finish
  function pack(R, THREE, x) {
    const tr = [];
    if (!R) return { r: null, tr };
    const HG = G().HOUSE_GEN, O = C.O;
    // G844: the obstacle of a build's own bags, rasterised here (the page adds its props over it)
    const shaped = (pb, F, BAGS, h) => { let s = null; try { s = h && isFinite(h.x) && isFinite(h.y) ? packedShape(THREE, pb, F, BAGS, frameMatrix(THREE, O, h), 1.0) : null; } catch (e) { s = null; } if (s) tr.push(s.lo.buffer, s.hi.buffer); return s; };
    const packDress = (D, plot) => (D ? { ok: D.ok, fence: D.fence ? { bags: { post: packBag(D.fence.bags.post, THREE, null, tr), deck: packBag(D.fence.bags.deck, THREE, null, tr) }, props: D.fence.props, n: D.fence.n } : null,
      out: D.out ? (pb => ({ built: pb, fin: D.out.fin, shape0: shaped(pb, D.out.F, HG.BAGS, plot && plot.out) }))(packBuilt(D.out.built, THREE, tr)) : null, lot: packLot(D.lot, THREE, tr) } : null);
    const r = { kind: R.kind };
    if (R.kind === 'house') {
      const F = R.F;
      r.house = plain(R.house, SKIP);
      r.built = packBuilt(R.built, THREE, tr);
      // lod 1 with EVERY attribute (train 28, G1395's follow-up): the page's lod1Bags keeps the town shader's channels (uv,
      // aHouseAO, aHouseLit, aHouseWin - the far town rides house_tarr), so a worker lod 1 packed with position + normal
      // alone drew another far house than the page's own build (GATE HOUSEWORKER: 84 of 137 entries differed)
      r.lod1 = R.lod1 ? packBuilt(R.lod1, THREE, tr, k => { const mt = F.MAT[k]; return !!(mt && mt.isMeshStandardMaterial && !mt.transparent); }) : null;
      if (r.lod1) r.lod1.tris = R.lod1.stats ? R.lod1.stats.tris : 0;
      r.fin = R.fin;
      r.shape0 = shaped(r.built, F, HG.BAGS, R.house);
      r.dress = packDress(R.dress, x);
      r.plot = plain(x, SKIP);
    } else if (R.kind === 'item') {
      r.built = packBuilt(R.built, THREE, tr);
      r.fin = R.fin;
      r.shape0 = shaped(r.built, R.F, (G()[x.gen] || {}).BAGS || [], x);
      r.dress = packDress(R.dress, R.plot);
      r.plot = R.plot ? plain(R.plot, SKIP) : null;
    } else if (R.kind === 'fence') {
      r.fence = R.fence ? { bags: { post: packBag(R.fence.bags.post, THREE, null, tr), deck: packBag(R.fence.bags.deck, THREE, null, tr) }, props: R.fence.props, n: R.fence.n } : null;
    }
    return { r, tr };
  }

  // ---- ...and stood up on the page: the same shape a local gen returns, the functions re-made off their numbers ----
  function unpack(r, THREE, target) {
    if (!r) return null;
    const O = C.O, Th = (lx, lz) => O.localH(lx, lz);
    const unDress = (D, plot) => {
      if (!D) return null;
      const out = { ok: D.ok, fence: D.fence ? { bags: { post: RemoteBag(THREE, 'post', D.fence.bags.post), deck: RemoteBag(THREE, 'deck', D.fence.bags.deck) }, props: D.fence.props, n: D.fence.n } : null, out: null, lot: D.lot };
      if (D.out && plot && plot.out) {
        const b2 = unpackBuilt(THREE, D.out.built);
        frameFns(plot.out, Th);
        b2.stats.ground = G().HOUSE_GEN.groundFn(plot.out.P);
        out.out = { built: b2, F: null, fin: D.out.fin, shape0: D.out.shape0 || null };
      }
      return out;
    };
    const Tv = { h: Th, waterY: C.waterY(), size: C.size() };
    if (r.kind === 'house') {
      // the plot as the gen dressed it (finishPlot's plan: cat, path, fences, out, car, boat, drive, lot)
      if (target && r.plot) { for (const k of Object.keys(r.plot)) if (k !== 'id' && k !== 'seed') target[k] = r.plot[k]; }
      const plot = target || r.plot;
      const house = frameFns(r.house, Th);
      if (S.spread) house.P.spread = S.spread;
      const built = unpackBuilt(THREE, r.built);
      built.stats.ground = G().HOUSE_GEN.groundFn(house.P);
      const lod1 = r.lod1 ? unpackBuilt(THREE, r.lod1) : null;
      if (lod1) { lod1.stats = { tris: r.lod1.tris }; }
      return { kind: 'house', house, built, lod1, F: null, fin: r.fin, dress: unDress(r.dress, plot), Tv, remote: true, shape0: r.shape0 || null };
    }
    if (r.kind === 'item') {
      const built = unpackBuilt(THREE, r.built);
      if (target && target.P) built.stats.ground = G().HOUSE_GEN.groundFn(target.P);
      return { kind: 'item', built, F: null, fin: r.fin, plot: r.plot, dress: unDress(r.dress, r.plot), Tv: r.plot ? Tv : null, remote: true, shape0: r.shape0 || null };
    }
    if (r.kind === 'fence') {
      return { kind: 'fence', fence: r.fence ? { bags: { post: RemoteBag(THREE, 'post', r.fence.bags.post), deck: RemoteBag(THREE, 'deck', r.fence.bags.deck) }, props: r.fence.props, n: r.fence.n } : null, Tv, remote: true };
    }
    return null;
  }

  return { C, S, genHouse, genItem, genFences, genFence, genDress, find, gen, pack, unpack, mark, delta, applyDelta, getState, setState, stateHash, itemSeed,
           useTallies, atRank, get tallies() { return TL; }, sownAll, inputSig };
}

const API = { V: PB_V, makeBuilder, makeTallies, rankQueue, packedShape, frameMatrix, plain, uniSnap, uniDiff, uniApply, packBag, packBuilt, unpackBuilt, RemoteBag, frameFns, SKIP };
ROOT.PREMISES_BUILD = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
