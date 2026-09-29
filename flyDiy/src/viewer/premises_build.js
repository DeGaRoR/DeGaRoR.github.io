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
const PB_V = 1;

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
// `only(k)`: the bags to pack (lod 1: the ones lod1Bags keeps); `keep`: the attributes (lod 1: position + normal)
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

// ---- a frame from its numbers: placeHouse / planOutbuilding's toWorld and ground, re-made on the page --------------
// (the same expressions on the same numbers: the functions do not cross a thread, their inputs do)
function frameFns(h, Th) {
  const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw), c0 = h.x, c1 = h.z, oy = h.y;
  h.toWorld = (lx, lz) => [c0 + lx * cy + lz * sy, c1 - lx * sy + lz * cy];
  h.ground = (lx, lz) => { const w = h.toWorld(lx, lz); return Th(w[0], w[1]) - oy; };
  if (h.P) h.P.ground = h.ground;
  return h;
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

  // ---- a house on its plot ----
  function genHouse(plot) {
    const g = G(), VG = g.VILLAGE_GEN, HG = g.HOUSE_GEN, O = C.O, rec = C.rec;
    if (!VG || !HG) return null;
    const waterY = C.waterY();
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
  const LITE = new Set(['position', 'normal']);
  function pack(R, THREE, x) {
    const tr = [];
    if (!R) return { r: null, tr };
    const packDress = D => (D ? { ok: D.ok, fence: D.fence ? { bags: { post: packBag(D.fence.bags.post, THREE, null, tr), deck: packBag(D.fence.bags.deck, THREE, null, tr) }, props: D.fence.props, n: D.fence.n } : null,
      out: D.out ? { built: packBuilt(D.out.built, THREE, tr), fin: D.out.fin } : null, lot: packLot(D.lot, THREE, tr) } : null);
    const r = { kind: R.kind };
    if (R.kind === 'house') {
      const F = R.F;
      r.house = plain(R.house, SKIP);
      r.built = packBuilt(R.built, THREE, tr);
      r.lod1 = R.lod1 ? packBuilt(R.lod1, THREE, tr, k => { const mt = F.MAT[k]; return !!(mt && mt.isMeshStandardMaterial && !mt.transparent); }, LITE) : null;
      if (r.lod1) r.lod1.tris = R.lod1.stats ? R.lod1.stats.tris : 0;
      r.fin = R.fin;
      r.dress = packDress(R.dress);
      r.plot = plain(x, SKIP);
    } else if (R.kind === 'item') {
      r.built = packBuilt(R.built, THREE, tr);
      r.fin = R.fin;
      r.dress = packDress(R.dress);
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
        out.out = { built: b2, F: null, fin: D.out.fin };
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
      return { kind: 'house', house, built, lod1, F: null, fin: r.fin, dress: unDress(r.dress, plot), Tv, remote: true };
    }
    if (r.kind === 'item') {
      const built = unpackBuilt(THREE, r.built);
      if (target && target.P) built.stats.ground = G().HOUSE_GEN.groundFn(target.P);
      return { kind: 'item', built, F: null, fin: r.fin, plot: r.plot, dress: unDress(r.dress, r.plot), Tv: r.plot ? Tv : null, remote: true };
    }
    if (r.kind === 'fence') {
      return { kind: 'fence', fence: r.fence ? { bags: { post: RemoteBag(THREE, 'post', r.fence.bags.post), deck: RemoteBag(THREE, 'deck', r.fence.bags.deck) }, props: r.fence.props, n: r.fence.n } : null, Tv, remote: true };
    }
    return null;
  }

  return { C, S, genHouse, genItem, genFences, genFence, genDress, find, gen, pack, unpack, mark, delta, applyDelta, getState, setState, stateHash, itemSeed };
}

const API = { V: PB_V, makeBuilder, plain, uniSnap, uniDiff, uniApply, packBag, packBuilt, unpackBuilt, RemoteBag, frameFns, SKIP };
ROOT.PREMISES_BUILD = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
