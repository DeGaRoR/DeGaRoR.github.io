#!/usr/bin/env node
// THE TOWN KIT (G850, QUEUE-C C3a, ARCH-2026-09-27 §4): the archetypes and the pack.
//
//   node tools/town_kit.js                 -> the report (the sowing, the archetypes, the pack size), nothing written
//   node tools/town_kit.js --out DIR       -> the pack + the instance table + the contact sheet written to DIR
//   node tools/town_kit.js --media         -> the pack + the instance table into media/townkit/ and their manifest
//                                             src/core/townkit_pack.json (ASK FIRST: git history keeps media/ forever)
//   node tools/town_kit.js --sheet FILE    -> the contact sheet alone (PNG)
//   --k N  archetypes for the houses (default 30; the outbuildings add their three)
//
// WHY. Every house in the game today is unique: its own P off the zone's sampler, its own ~10 000 triangles,
// 70 ms of build (ARCH §1.2) - Metlakatla at ~0.6 GB of vertex buffers is why the town is off (G590). The kit is
// the MSFS answer: 20-40 shapes generated OFFLINE by the same generator, each instanced many times, dressed per
// instance (finish set, paint, wear, yaw, a mirror, a stretch) and stood on its ground by a vertex-shader stretch.
// This file makes the shapes and the tables; nothing in the game reads them yet (C3b is the renderer).
//
// THE FIVE STEPS, one function each:
//   1 SOW       the zones exactly as the game sows them: PG.compose over Jolene's record, then per plot the
//               renderer's own buildHouse recipe (render_premises.js buildHouse) up to the P - VILLAGE_GEN.placeHouse
//               with the same seeds, rules and picks. The outbuildings from VILLAGE_GEN.finishPlot on a lod-1 build.
//   2 CLUSTER   the sampled houses split by what can never be faked (a house on the water, a storefront) and
//               clustered inside each split by k-medoids on a distance that weighs what reads from the street
//               (roof family, storeys, stance, footprint, pitch). A MEDOID IS A REAL SAMPLED HOUSE: every archetype
//               is a P the sampler actually drew, never an average nobody would build.
//   3 BUILD     each medoid's P made canonical (flat ground, the cluster's median floor clearance, no per-lot
//               dressing - pier, yard, people, woodpile, barrel, lamps, smoke, ground skirt: those stay per lot or
//               instanced props) and built by HOUSE_GEN at lod 0 and lod 1 (the generator's own two meshes - BUILD,
//               DON'T RECONSTRUCT) and the G594 box. Every vertex carries its ROLE (its bag, _house_gen.js BAGS -
//               the TARR slot becomes role x the instance's finish set) instead of a baked finish, and a STANCE
//               weight: 1 at the ground, 0 from the floor structure up, linear between - so posts, cripple walls,
//               piles, stairs and downpipes stretch down to the instance's own ground in the vertex shader.
//   4 PACK      quantized (16 B a vertex: u16 position in the archetype's box, oct-encoded normal, u16 metre UVs
//               in the LOD's range, AO, role, stance, glow), u16 indices where they fit, one gzip stream,
//               content-hashed. The instance table: 32 B a house (below, INST_*), one per plot and outbuilding.
//   5 SHEET     a contact sheet for the user's first look: a flat-shaded axonometric of every archetype, drawn
//               here by a small software rasteriser into a PNG (node only, no GPU, no dependency).
//
// GATE TOWNKIT (tools/_townkit_check.js) holds it: every archetype passes GATE HOUSE's own battery, the pack
// round-trips, and every plot of Metlakatla has a fitting archetype.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const crypto = require('crypto');

const TOOLS = __dirname;
const ROOT = path.join(TOOLS, '..');

// ---------------------------------------------------------------------------
// the generators, headless: GATE HOUSE's stub THREE (the same slice house_probe.js and met_measure.js take)
// ---------------------------------------------------------------------------
function stubTHREE() {
  const src = fs.readFileSync(path.join(TOOLS, '_house_check.js'), 'utf8');
  return new Function(src.slice(src.indexOf('function makeTHREE()'), src.indexOf('const win = {};')) + '; return makeTHREE;')()();
}
// THE LIBRARY'S NUMBERS, NOT ITS IMAGES. Two things a house BUILDS depend on the scanned set it wears: the ridge cap
// is drawn only on a metal roof (setMetal) and the standing seams only on galv / rust (SET_SEAM). With no payload
// the generator says "not metal" and a headless build loses every ridge cap the game draws - so the manifest's own
// numbers (src/viewer/house_tex.js, read the way GATE HOUSE reads it) go on the context, without a single image.
function readLibrary() {
  const f = path.join(ROOT, 'src', 'viewer', 'house_tex.js');
  if (!fs.existsSync(f)) return null;
  const src = fs.readFileSync(f, 'utf8'), out = {};
  const re = /(\w+): \{ kind: '(\w+)', name: '([^']*)', tile: ([\d.]+), px: (\d+), metal: ([\d.]+), ribbed: (true|false)/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = { kind: m[2], name: m[3], tile: +m[4], px: +m[5], metal: +m[6], ribbed: m[7] === 'true' };
  return Object.keys(out).length ? out : null;
}
let GENS_CACHE = null;
function loadGens() {
  if (GENS_CACHE) return GENS_CACHE;
  const PG = require(path.join(ROOT, 'src', 'core', '27_premises.js'));
  const win = {};
  const ctx = { window: win, THREE: stubTHREE(), console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_sport_gen.js', '_marine_gen.js', '_shed_gen.js', '_hangar_gen.js', '_tower_gen.js', '_tram_gen.js', '_totem_gen.js', '_village_gen.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
  const LIB = readLibrary();
  if (LIB) ctx.HOUSE_TEX_SETS = LIB;
  GENS_CACHE = { PG, win, ctx, LIB, HG: win.HOUSE_GEN, HK: win.HOUSE_KIT, VG: win.VILLAGE_GEN, CAT: PG.collect(win) };
  return GENS_CACHE;
}

// ---------------------------------------------------------------------------
// 1 SOW - the zones as the game sows them
// ---------------------------------------------------------------------------
const FIXTURE = path.join(TOOLS, 'fixtures', 'island_jolene.json');
// the tree pool the composer wants (met_measure.js's two stand-ins: the forest zones are not this file's business)
const POOL = [{ key: 'a|tall', size: 1, sink: 0, proportion: 1, h: 16 }, { key: 'b|small', size: 1, sink: 0, proportion: 1, h: 8 }];
// THE TIDE A HOUSE STANDS AGAINST IS ITS ZONE'S WATER (C3b, 2026-09-29: the harbour's kit matches the procedural
// harbour side by side). render_premises.js buildHouse asked world.waterH(0, 0) - on Jolene the WORLD ORIGIN, dry land,
// -Infinity (G850 found it) - and C2c's G843 makes the house read its zone's water exactly as the sower does
// (27_premises compose's zoneWaterY, G434/G434.1: the LOWEST finite water over the zone's box +-60 m, 13 x 13 samples,
// the anchor's water where none is found). zoneWater() here is that rule, line for line; PG.zoneWaterY is taken
// instead once 27_premises exports it. SEA (0, Jolene's sea: GATE PREMISES 14) is the answer where a zone touches no
// water at all.
const SEA = 0;
function zoneWater(PG, world, F, z) {
  if (typeof PG.zoneWaterY === 'function') { try { const v = PG.zoneWaterY(world, F, z); if (Number.isFinite(v)) return v; } catch (e) { /* the page's rule below */ } }
  const at = world.waterH ? world.waterH(F.anchor.x, F.anchor.z) : -Infinity, anchor = Number.isFinite(at) ? at : SEA;
  if (!world.waterH || !z || !z.poly || z.poly.length < 3) return anchor;
  const bb = PG.polyBBox(z.poly); let best = Infinity;
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
    const w = F.toWorld(bb.x0 - 60 + (bb.x1 - bb.x0 + 120) * i / 12, bb.z0 - 60 + (bb.z1 - bb.z0 + 120) * j / 12);
    const v = world.waterH(w[0], w[1]); if (Number.isFinite(v) && v < best) best = v;
  }
  return Number.isFinite(best) ? best : anchor;
}
const townOf = zone => (/^mk_/.test(String(zone)) ? 'metlakatla' : 'village');
function sow(opts) {
  const o = opts || {};
  const G = loadGens(), { PG, VG, HG, CAT } = G;
  const rec = PG.unwrap(fs.readFileSync(FIXTURE, 'utf8')).rec;
  const IW = require(path.join(TOOLS, 'island_node.js')).islandWorld('jolene', {});
  const O = PG.compose(rec, IW, { catalogue: CAT, globals: G.win, pool: POOL });
  const Tv = { h: (lx, lz) => O.localH(lx, lz), waterY: SEA, size: 20000 };
  const ZW = new Map();   // zone id -> its water (the tide its houses stand against)
  const TvOf = zid => { if (!ZW.has(zid)) ZW.set(zid, zoneWater(PG, IW, O.frame, rec.layers.zones.find(z => z.id === zid))); return Object.assign({}, Tv, { waterY: ZW.get(zid) }); };
  const houses = [], outs = [];
  const FENCED = new Set();
  for (const plot of O.records.plots) {
    // render_premises.js buildHouse, line for line up to the P
    const rules = Object.assign({}, PG.ZONE_RULES, (rec.layers.zones.find(z => z.id === plot.zone) || {}).rules || {});
    const V = Object.assign({}, VG.VDEF, { plotDepth: rules.plotDepth, riparian: rules.riparian, seed: rec.seed });
    const rnd = PG.mulberry32(plot.seed);
    let preset;
    if (plot.pick && plot.pick !== 'sampler') { const e = CAT.entries.get(plot.pick); if (e && e.gen === 'HOUSE_GEN') preset = e.preset; }
    const Tz = TvOf(plot.zone);
    const house = VG.placeHouse(Tz, V, plot, plot.seed % 100000, rnd, preset);
    const s = { i: houses.length, plot, town: townOf(plot.zone), zone: plot.zone, preset: preset || null, house, P: house.P, V, Tv: Tz };
    houses.push(s);
    if (o.outbuildings === false) continue;
    // THE OUTBUILDING: VILLAGE_GEN.finishPlot on a LOD-1 build of the house (what it reads of the build - the stair
    // and the stoop - is planned before the lod decides anything). The game plans it in streaming order with one
    // fence set for the premises, so which edges a lot fences (and so the rnd the outbuilding draws after) can
    // differ from the game's: plot order here. C2b's cook fixes one order for both.
    try {
      const built = HG.build(house.P, 1);
      const rd = O.roads.find(r => r.id === plot.road) || O.roads[0];
      const T = { h: Tz.h, size: Tz.size, waterY: Tz.waterY };
      const pl = Object.assign({}, plot);
      const vil = { rnd: PG.mulberry32(plot.seed ^ 0x5eed), V, road: { pts: rd.pts, w: rd.w }, fenced: FENCED, T, spread: null, plots: O.records.plots, houses: [] };
      VG.finishPlot(vil, pl, house, built);
      if (pl.out) outs.push({ i: outs.length, plot, town: s.town, zone: plot.zone, kind: pl.out.kind, house: pl.out, P: pl.out.P, of: s.i });
    } catch (e) { /* a plot the dressing refuses keeps no outbuilding, as in the game (render_premises dressPlot) */ }
  }
  return { rec, O, IW, houses, outs, Tv, zoneWater: ZW };
}

// ---------------------------------------------------------------------------
// 2 CLUSTER - what reads from the street
// ---------------------------------------------------------------------------
// the ground under a placed house: its four corners, relative to its own origin (placeHouse's hiC / loC)
function cornersOf(P) {
  const g = typeof P.ground === 'function' ? P.ground : () => 0;
  let hi = -1e9, lo = 1e9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const y = g(sx * P.L / 2, sz * P.w / 2); if (y > hi) hi = y; if (y < lo) lo = y; }
  return { hi, lo };
}
function feat(P) {
  return {
    fam: Math.round(P.roofFam) + (Math.round(P.hip) ? 10 : 0),    // a hip reads as its own family from the street
    st: Math.round(P.storeys), stance: Math.round(P.stance), water: P.water ? 1 : 0,
    shop: (P.shopWin || P.falseFront || P.awning) ? 1 : 0,
    porch: P.porch ? 1 : 0, lean: P.lean ? 1 : 0, dorm: P.dormers > 0 ? 1 : 0, bay: P.bay ? 1 : 0, log: Math.round(P.corner) === 1 ? 1 : 0,
    L: P.L, w: P.w, pitch: P.pitch, floorH: P.floorH, clear: P.floorY - cornersOf(P).hi,
  };
}
// the split nothing can fake: a house over the water stands on piles in the tide with a back door to the street,
// and a storefront's window, awning and false front are its whole face
const splitOf = f => (f.water ? 'water' : 'land') + (f.shop ? '+shop' : '');
// the distance, in "how different it looks": a roof family is the biggest thing a street sees, then the storeys,
// then the stance and the footprint; the fittings last
function dist(a, b) {
  let d = 0;
  if (a.fam !== b.fam) d += 3.0;
  if (a.st !== b.st) d += 2.0;
  if (a.stance !== b.stance) d += (a.stance === 0 || b.stance === 0) ? 1.2 : 0.6;   // slab vs anything is a look; posts vs piles less
  if (a.water !== b.water) d += 8;
  if (a.shop !== b.shop) d += 4;
  d += 0.5 * (a.porch !== b.porch) + 0.6 * (a.lean !== b.lean) + 0.7 * (a.dorm !== b.dorm) + 0.3 * (a.bay !== b.bay) + 0.4 * (a.log !== b.log);
  d += Math.abs(a.L - b.L) / 2.0 + Math.abs(a.w - b.w) / 1.5 + Math.abs(a.pitch - b.pitch) / 12 + Math.abs(a.floorH - b.floorH) / 0.5;
  return d;
}
// k-medoids, deterministic: PAM's BUILD (add the medoid that lowers the total most), then alternate until nothing
// moves (assign to the nearest; each cluster's medoid is the member with the least summed distance)
function kMedoids(F, k) {
  const n = F.length;
  if (n <= k) return { med: F.map((_, i) => i), of: F.map((_, i) => i) };
  const D = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i * n + j] = D[j * n + i] = dist(F[i], F[j]);
  const near = new Float64Array(n).fill(Infinity);
  const med = [];
  while (med.length < k) {
    let best = -1, bestGain = -Infinity;
    for (let c = 0; c < n; c++) {
      if (med.indexOf(c) >= 0) continue;
      let gain = 0;
      for (let i = 0; i < n; i++) { const d = D[c * n + i]; if (d < near[i]) gain += (near[i] === Infinity ? 1e6 : near[i]) - d; }
      if (gain > bestGain) { bestGain = gain; best = c; }
    }
    med.push(best);
    for (let i = 0; i < n; i++) near[i] = Math.min(near[i], D[best * n + i]);
  }
  const of = new Int32Array(n);
  for (let it = 0; it < 50; it++) {
    for (let i = 0; i < n; i++) { let b = 0; for (let m = 1; m < k; m++) if (D[med[m] * n + i] < D[med[b] * n + i]) b = m; of[i] = b; }
    let moved = false;
    for (let m = 0; m < k; m++) {
      const mem = []; for (let i = 0; i < n; i++) if (of[i] === m) mem.push(i);
      let bi = med[m], bs = Infinity;
      for (const c of mem) { let s = 0; for (const i of mem) s += D[c * n + i]; if (s < bs - 1e-9) { bs = s; bi = c; } }
      if (bi !== med[m]) { med[m] = bi; moved = true; }
    }
    if (!moved) break;
  }
  return { med, of: Array.from(of) };
}
// K split over the splits by their share of the houses (largest remainder, at least one each, at least FLOOR[split])
// THE HARBOUR GETS THREE (the user, 2026-09-29, TOWNKIT decision 2): one water archetype stood for all 22 waterfront
// plots, the most repeated shape of the kit where it shows most - three, the count still 30 (decision 3): what the
// floor adds is taken from the largest split
const FLOOR = { water: 3 };
function allot(counts, K, floor) {
  const fl = floor || FLOOR;
  const keys = Object.keys(counts).sort(), N = keys.reduce((a, k) => a + counts[k], 0);
  const out = {}; let used = 0;
  for (const k of keys) { out[k] = Math.min(counts[k], Math.max(1, fl[k] || 0, Math.floor(K * counts[k] / N))); used += out[k]; }
  const rem = keys.map(k => [k, K * counts[k] / N - Math.floor(K * counts[k] / N)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (let i = 0; used < K && i < rem.length; i++, used++) out[rem[i][0]]++;
  while (used > K) { const big = keys.slice().sort((a, b) => out[b] - out[a] || (a < b ? -1 : 1))[0]; out[big]--; used--; }
  return out;
}
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
function pickArchetypes(S, K) {
  const F = S.houses.map(s => feat(s.P));
  const bySplit = {};
  F.forEach((f, i) => { const k = splitOf(f); (bySplit[k] = bySplit[k] || []).push(i); });
  const counts = {}; for (const k in bySplit) counts[k] = bySplit[k].length;
  const alloc = allot(counts, K);
  const arch = [];
  for (const k of Object.keys(bySplit).sort()) {
    const idx = bySplit[k];
    const r = kMedoids(idx.map(i => F[i]), alloc[k]);
    r.med.forEach((m, c) => {
      const members = idx.filter((_, j) => r.of[j] === c);
      arch.push({ split: k, src: S.houses[idx[m]], members, clear: median(members.map(i => F[i].clear)) });
    });
  }
  // the outbuildings are three presets (VILLAGE_GEN.planOutbuilding): one archetype each, nothing to cluster
  const kinds = [...new Set(S.outs.map(o => o.kind))].sort();
  for (const kind of kinds) {
    const mem = S.outs.filter(o => o.kind === kind);
    arch.push({ split: 'out', kind, src: mem[0], members: mem.map(o => o.i), clear: median(mem.map(o => o.P.floorY - cornersOf(o.P).hi)) });
  }
  // a stable order: the houses by split and then by how many they stand for, the outbuildings last
  arch.sort((a, b) => (a.split === 'out') - (b.split === 'out') || (a.split < b.split ? -1 : a.split > b.split ? 1 : 0) || b.members.length - a.members.length || a.src.i - b.src.i);
  arch.forEach((a, i) => { a.id = i; });
  return arch;
}

// ---------------------------------------------------------------------------
// 3 BUILD - the canonical archetype, its two meshes and its box
// ---------------------------------------------------------------------------
// the per-lot dressing the kit leaves out: each stays with the lot (fences, paths, the yard, the car, the boat, the
// pier - instanced props already) or is a per-instance field (the lights, the door leaf)
const DRESSING = { pier: 0, yard: 0, people: 0, woodpile: 0, firewood: 0, barrel: 0, smoke: 0, aoGround: 0,
  porchLamp: 0, stairLights: 0, doorAjar: 0, flagpole: 0,
  // every pane CAN glow: the lit channel marks the glass, the instance's lights byte says how much of it does
  lights: 1, winLit: 1, winLink: 1 };
const KIT_TIDE = -5;            // the flat kit ground is dry: the tide is the instance's, not the archetype's
function canonP(a) {
  const G = loadGens();
  const P = Object.assign({}, G.HG.DEF, a.src.P);
  delete P.ground; delete P.spread;
  P.slopeX = 0; P.slopeZ = 0;
  Object.assign(P, DRESSING);
  P.waterY = KIT_TIDE;
  // the floor at the cluster's median clearance over its HIGH corner (placeHouse's rule: the floor clears the high
  // corner; the stretch carries the rest down to the low ones), never under a slab's 0.25
  P.floorY = Math.max(Math.round(P.stance) === 0 ? 0.25 : 0.45, +a.clear.toFixed(3));
  return P;
}
// where the stretch stops: the underside of the floor structure (buildStance: the rim beam under floorY - 0.10,
// beamH = 0.28 floorY clamped to 0.14-0.30). Everything from there up is rigid.
const stanceTop = floorY => Math.max(0.02, floorY - 0.10 - Math.min(0.30, Math.max(0.14, floorY * 0.28)) - 0.005);
// three's computeVertexNormals (area-weighted, per vertex - the generator's faces own their vertices, so flat),
// then the bag's own overrides where a surface is curved
function normalsOf(raw) {
  const p = raw.pos, n = new Float32Array(p.length);
  for (let t = 0; t < raw.idx.length; t += 3) {
    const a = raw.idx[t] * 3, b = raw.idx[t + 1] * 3, c = raw.idx[t + 2] * 3;
    const cbx = p[c] - p[b], cby = p[c + 1] - p[b + 1], cbz = p[c + 2] - p[b + 2];
    const abx = p[a] - p[b], aby = p[a + 1] - p[b + 1], abz = p[a + 2] - p[b + 2];
    const x = cby * abz - cbz * aby, y = cbz * abx - cbx * abz, z = cbx * aby - cby * abx;
    for (const v of [a, b, c]) { n[v] += x; n[v + 1] += y; n[v + 2] += z; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  raw.nOv.forEach((v, i) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; n[i * 3] = v[0] / l; n[i * 3 + 1] = v[1] / l; n[i * 3 + 2] = v[2] / l; });
  return n;
}
// one LOD as flat arrays: the bags in BAGS order, role = the bag's index
function takeLod(built, yS) {
  const G = loadGens(), BAGS = G.HG.BAGS;
  const L = { pos: [], nrm: [], uv: [], ao: [], role: [], stance: [], lit: [], win: [], idx: [] };
  for (let r = 0; r < BAGS.length; r++) {
    const raw = built.bags[BAGS[r]].raw();
    if (!raw.idx.length) continue;
    const base = L.pos.length / 3, nr = normalsOf(raw);
    for (let i = 0, nv = raw.pos.length / 3; i < nv; i++) {
      const y = raw.pos[i * 3 + 1];
      L.pos.push(raw.pos[i * 3], y, raw.pos[i * 3 + 2]);
      L.nrm.push(nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]);
      L.uv.push(raw.uv[i * 2], raw.uv[i * 2 + 1]);
      L.ao.push(raw.ao[i]); L.role.push(r); L.lit.push(raw.lit[i] | 0);
      L.win.push(raw.win[i * 3], raw.win[i * 3 + 1], raw.win[i * 3 + 2]);
      L.stance.push(y < yS ? Math.min(1, Math.max(0, 1 - y / yS)) : 0);
    }
    for (const t of raw.idx) L.idx.push(t + base);
  }
  return L;
}
// THE BOX (G594's coarsest rung, render_premises.js hlodBoxes): the shell's extent - the walls, the roof and its
// finish - five faces and no floor, the top at 85 % of the height; the walls wear the siding role and the top the
// roof role, so the finish set dresses it too. Its foot is on the ground and stretches with it.
const BOX_ROLES = ['siding', 'roof', 'rib', 'trim', 'stone'];
function boxLod(L1) {
  const BAGS = loadGens().HG.BAGS, keep = new Set(BOX_ROLES.map(k => BAGS.indexOf(k)));
  const lo = [1e9, 0, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < L1.role.length; i++) {
    if (!keep.has(L1.role[i])) continue;
    for (let a = 0; a < 3; a++) { const v = L1.pos[i * 3 + a]; if (a !== 1 && v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  }
  const top = lo[1] + 0.85 * (hi[1] - lo[1]);
  const B = { pos: [], nrm: [], uv: [], ao: [], role: [], stance: [], lit: [], win: [], idx: [] };
  const sid = BAGS.indexOf('siding'), rf = BAGS.indexOf('roof');
  const quad = (pts, n, role) => {
    const b = B.pos.length / 3;
    for (const p of pts) {
      B.pos.push(p[0], p[1], p[2]); B.nrm.push(n[0], n[1], n[2]);
      // metres in the face (the kit's rule): along the face's horizontal edge, and up (or along z on the top)
      B.uv.push(n[1] ? p[0] : (n[0] ? p[2] : p[0]), n[1] ? p[2] : p[1]);
      B.ao.push(1); B.role.push(role); B.lit.push(0); B.win.push(0, 0, 0); B.stance.push(p[1] <= 0 ? 1 : 0);
    }
    B.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const [x0, , z0] = lo, [x1, , z1] = hi;
  quad([[x0, 0, z1], [x1, 0, z1], [x1, top, z1], [x0, top, z1]], [0, 0, 1], sid);
  quad([[x1, 0, z0], [x0, 0, z0], [x0, top, z0], [x1, top, z0]], [0, 0, -1], sid);
  quad([[x1, 0, z1], [x1, 0, z0], [x1, top, z0], [x1, top, z1]], [1, 0, 0], sid);
  quad([[x0, 0, z0], [x0, 0, z1], [x0, top, z1], [x0, top, z0]], [-1, 0, 0], sid);
  quad([[x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0]], [0, 1, 0], rf);
  return B;
}
const bboxOf = L => {
  const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (let i = 0; i < L.pos.length; i += 3) for (let a = 0; a < 3; a++) { const v = L.pos[i + a]; if (v < b[a]) b[a] = v; if (v > b[3 + a]) b[3 + a] = v; }
  return b;
};
// the roof's GEOMETRY-bearing kind: seams (SET_SEAM: galv, rust) and a ridge cap (a metal set). An instance may
// only wear a finish set whose roof is of the archetype's kind - the ribs and the cap are built, not painted.
function roofKind(P) {
  const G = loadGens(), HG = G.HG;
  const list = HG.ROLE_SETS.roof, key = list[Math.max(0, Math.min(list.length - 1, Math.round(P.roofSet || 0)))];
  const seam = key === 'galv' || key === 'rust' ? 1 : 0;
  const metal = G.LIB && G.LIB[key] && G.LIB[key].metal > 0.2 ? 1 : 0;
  return seam * 2 + metal;
}
const FAMS5 = ['gable', 'shed', 'saltbox', 'gambrel'];
const STANCE5 = ['slab', 'cripple', 'posts', 'piles', 'skids'];
function klassOf(P) {
  const area = P.L * P.w;
  const size = area < 40 ? 'S' : area < 75 ? 'M' : 'L';
  const fam = Math.round(P.hip) && Math.round(P.roofFam) === 0 ? 'hip' : FAMS5[Math.round(P.roofFam)] || 'gable';
  return { size, fam, storeys: Math.round(P.storeys), stance: STANCE5[Math.round(P.stance)] || String(P.stance) };
}
function buildArchetype(a) {
  const G = loadGens(), HG = G.HG;
  const P = canonP(a);
  const yS = stanceTop(P.floorY);
  const hi = HG.build(P, 0), lo = HG.build(P, 1);
  const L0 = takeLod(hi, yS), L1 = takeLod(lo, yS), B = boxLod(L1);
  const src = a.src;
  return Object.assign(a, {
    P, yS, floorY: P.floorY, lods: [L0, L1, B], roofKind: roofKind(P), klass: klassOf(P),
    name: a.split === 'out' ? a.kind : (src.preset || 'sampler #' + src.plot.id),
    foot: { L: P.L, w: P.w }, bbox: bboxOf(L0),
    tris: [L0.idx.length / 3, L1.idx.length / 3, B.idx.length / 3], verts: [L0.role.length, L1.role.length, B.role.length],
  });
}
function buildKit(S, K) {
  const arch = pickArchetypes(S, K);
  for (const a of arch) buildArchetype(a);
  return arch;
}

// ---------------------------------------------------------------------------
// 4 PACK - quantized, gzip, content-hashed
// ---------------------------------------------------------------------------
// THE VERTEX, 16 B:  0 u16 x3  position in the LOD's own box (1/65535 of it: under a millimetre for a 40 m hall)
//                    6 i8 x2   the normal, octahedral (a degree or so)
//                    8 u16 x2  the UV in METRES, in the LOD's own UV range (the kit's rule: UVs are metres)
//                   12 u8      the baked AO        13 u8 the ROLE (the bag's index in HOUSE_GEN.BAGS)
//                   14 u8      the STANCE weight   15 u8 the glow (a lit window's palette index, _house_kit.js)
// and, for the glass and the far panes only, 4 B of what hangs behind the pane (_house_kit.js setWin: its width and
// height in 2 cm, its dressing code) in a side stream, in vertex order.
const VSTRIDE = 16;
const PACK_MAGIC = 0x544b4954;      // 'TKIT'
const PACK_V = 1;
const LOD_DIST = [150, 1200];       // ARCH §4.2: lod 0 < 150 m < lod 1 < 1.2 km < box (G594's far2)
function octEnc(x, y, z) {
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  let u = x / s, v = z / s;
  if (y < 0) { const ou = u; u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1); v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1); }
  const q = t => Math.max(-127, Math.min(127, Math.round(t * 127)));
  return [q(u), q(v)];
}
function octDec(a, b) {
  let u = a / 127, v = b / 127;
  const y = 1 - Math.abs(u) - Math.abs(v);
  if (y < 0) { const ou = u; u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1); v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1); }
  const l = Math.hypot(u, y, v) || 1;
  return [u / l, y / l, v / l];
}
const WIN_ROLES = ['glass', 'pane'];
function encodeLod(L) {
  const BAGS = loadGens().HG.BAGS, winRole = new Set(WIN_ROLES.map(k => BAGS.indexOf(k)));
  const n = L.role.length;
  const pmin = [1e9, 1e9, 1e9], pmax = [-1e9, -1e9, -1e9], umin = [1e9, 1e9], umax = [-1e9, -1e9];
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) { const v = L.pos[i * 3 + a]; if (v < pmin[a]) pmin[a] = v; if (v > pmax[a]) pmax[a] = v; }
    for (let a = 0; a < 2; a++) { const v = L.uv[i * 2 + a]; if (v < umin[a]) umin[a] = v; if (v > umax[a]) umax[a] = v; }
  }
  const r4 = v => +v.toFixed(4);
  const qp = { min: pmin.map(r4), max: pmax.map((v, a) => r4(Math.max(v, pmin[a] + 1e-3))) };
  const qu = { min: umin.map(r4), max: umax.map((v, a) => r4(Math.max(v, umin[a] + 1e-3))) };
  const q16 = (v, a, b) => Math.max(0, Math.min(65535, Math.round((v - a) / (b - a) * 65535)));
  const vb = Buffer.alloc(n * VSTRIDE), wins = [];
  for (let i = 0; i < n; i++) {
    const o = i * VSTRIDE;
    for (let a = 0; a < 3; a++) vb.writeUInt16LE(q16(L.pos[i * 3 + a], qp.min[a], qp.max[a]), o + a * 2);
    const e = octEnc(L.nrm[i * 3], L.nrm[i * 3 + 1], L.nrm[i * 3 + 2]);
    vb.writeInt8(e[0], o + 6); vb.writeInt8(e[1], o + 7);
    vb.writeUInt16LE(q16(L.uv[i * 2], qu.min[0], qu.max[0]), o + 8);
    vb.writeUInt16LE(q16(L.uv[i * 2 + 1], qu.min[1], qu.max[1]), o + 10);
    vb.writeUInt8(Math.round(Math.max(0, Math.min(1, L.ao[i])) * 255), o + 12);
    vb.writeUInt8(L.role[i], o + 13);
    vb.writeUInt8(Math.round(L.stance[i] * 255), o + 14);
    vb.writeUInt8(L.lit[i] & 255, o + 15);
    if (winRole.has(L.role[i])) {
      const c = t => Math.max(0, Math.min(255, Math.round(t / 0.02)));
      wins.push(c(L.win[i * 3]), c(L.win[i * 3 + 1]), Math.max(0, Math.min(255, Math.round(L.win[i * 3 + 2]))), 0);
    }
  }
  const wide = n > 65535;
  const ib = Buffer.alloc(L.idx.length * (wide ? 4 : 2));
  for (let i = 0; i < L.idx.length; i++) wide ? ib.writeUInt32LE(L.idx[i], i * 4) : ib.writeUInt16LE(L.idx[i], i * 2);
  return { meta: { verts: n, tris: L.idx.length / 3, index: wide ? 32 : 16, pos: qp, uv: qu, win: wins.length / 4 }, blobs: [vb, ib, Buffer.from(wins)] };
}
function decodeLod(meta, vb, ib, wb, BAGS) {
  const n = meta.verts, winRole = new Set(WIN_ROLES.map(k => BAGS.indexOf(k)));
  const L = { pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), uv: new Float32Array(n * 2), ao: new Float32Array(n), role: new Uint8Array(n), stance: new Float32Array(n), lit: new Uint8Array(n), win: new Float32Array(n * 3), idx: meta.index === 32 ? new Uint32Array(meta.tris * 3) : new Uint16Array(meta.tris * 3) };
  const dq = (q, a, b) => a + q / 65535 * (b - a);
  let w = 0;
  for (let i = 0; i < n; i++) {
    const o = i * VSTRIDE;
    for (let a = 0; a < 3; a++) L.pos[i * 3 + a] = dq(vb.readUInt16LE(o + a * 2), meta.pos.min[a], meta.pos.max[a]);
    const d = octDec(vb.readInt8(o + 6), vb.readInt8(o + 7));
    L.nrm[i * 3] = d[0]; L.nrm[i * 3 + 1] = d[1]; L.nrm[i * 3 + 2] = d[2];
    L.uv[i * 2] = dq(vb.readUInt16LE(o + 8), meta.uv.min[0], meta.uv.max[0]);
    L.uv[i * 2 + 1] = dq(vb.readUInt16LE(o + 10), meta.uv.min[1], meta.uv.max[1]);
    L.ao[i] = vb.readUInt8(o + 12) / 255; L.role[i] = vb.readUInt8(o + 13); L.stance[i] = vb.readUInt8(o + 14) / 255; L.lit[i] = vb.readUInt8(o + 15);
    if (winRole.has(L.role[i])) { L.win[i * 3] = wb[w] * 0.02; L.win[i * 3 + 1] = wb[w + 1] * 0.02; L.win[i * 3 + 2] = wb[w + 2]; w += 4; }
  }
  for (let i = 0; i < L.idx.length; i++) L.idx[i] = meta.index === 32 ? ib.readUInt32LE(i * 4) : ib.readUInt16LE(i * 2);
  return L;
}
// the P keys that describe the shape (the archetype table carries them so C3b's review can name what it sees)
const SHAPE_KEYS = ['L', 'w', 'storeys', 'floorH', 'floorY', 'stance', 'roofFam', 'hip', 'pitch', 'pitch2', 'porch', 'porchD', 'lean', 'dormers', 'bay', 'corner', 'water', 'skirt', 'shopWin', 'falseFront', 'awning', 'roofSet'];
function encodePack(arch, finishSets, extra) {
  const HG = loadGens().HG;
  const blobs = [], table = [];
  let off = 0;
  const put = b => { const pad = (4 - (b.length & 3)) & 3; const at = off; blobs.push(b); if (pad) blobs.push(Buffer.alloc(pad)); off += b.length + pad; return [at, b.length]; };
  for (const a of arch) {
    const lods = a.lods.map(L => {
      const e = encodeLod(L);
      return Object.assign(e.meta, { vb: put(e.blobs[0]), ib: put(e.blobs[1]), wb: put(e.blobs[2]) });
    });
    table.push({ id: a.id, name: a.name, split: a.split, klass: a.klass, serves: a.members.length,
      src: a.split === 'out' ? { kind: a.kind } : { plot: a.src.plot.id, zone: a.src.zone, preset: a.src.preset || 'sampler', seed: a.src.plot.seed },
      P: Object.fromEntries(SHAPE_KEYS.map(k => [k, typeof a.P[k] === 'number' ? +a.P[k].toFixed(4) : a.P[k]])),
      floorY: +a.floorY.toFixed(4), stanceTop: +a.yS.toFixed(4), foot: { L: +a.foot.L.toFixed(4), w: +a.foot.w.toFixed(4) }, roofKind: a.roofKind, lods });
  }
  const header = Buffer.from(JSON.stringify({ magic: 'TKIT', v: PACK_V, bags: HG.BAGS, lodDist: LOD_DIST, vstride: VSTRIDE,
    winRoles: WIN_ROLES, cols: HG.COL_NAMES, roleSets: HG.ROLE_SETS, finishSets, archetypes: table, extra: extra || null }));
  const pre = Buffer.alloc(12);
  pre.writeUInt32LE(PACK_MAGIC, 0); pre.writeUInt32LE(PACK_V, 4); pre.writeUInt32LE(header.length, 8);
  const hpad = Buffer.alloc((4 - ((12 + header.length) & 3)) & 3);
  const raw = Buffer.concat([pre, header, hpad].concat(blobs));
  const gz = zlib.gzipSync(raw, { level: 9, mtime: 0 });   // mtime 0: the same kit is the same bytes
  return { raw, gz, hash: crypto.createHash('sha256').update(gz).digest('hex') };
}
function decodePack(buf) {
  const raw = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf;
  if (raw.readUInt32LE(0) !== PACK_MAGIC) throw new Error('not a town kit pack');
  const hl = raw.readUInt32LE(8), H = JSON.parse(raw.slice(12, 12 + hl).toString('utf8'));
  const base = 12 + hl + ((4 - ((12 + hl) & 3)) & 3);
  const at = r => raw.slice(base + r[0], base + r[0] + r[1]);
  const arch = H.archetypes.map(a => Object.assign({}, a, { lods: a.lods.map(m => decodeLod(m, at(m.vb), at(m.ib), at(m.wb), H.bags)) }));
  return { header: H, arch };
}

// ---------------------------------------------------------------------------
// the finish sets: what the sampled houses actually wear, as tuples of the scanned library's sets
// ---------------------------------------------------------------------------
const FINISH_KEYS = ['wallSet', 'trimSet', 'roofSet', 'deckSet', 'floorSet', 'postSet', 'stoneSet', 'metalSet'];
const FINISH_MAX = 48;
function finishTable(S) {
  const cnt = new Map();
  for (const s of S.houses.concat(S.outs)) {
    const t = FINISH_KEYS.map(k => Math.round(s.P[k] || 0)).join(',');
    cnt.set(t, (cnt.get(t) || 0) + 1);
  }
  const all = [...cnt.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  // the commonest of each roof kind first (so every archetype has a set it may wear), then the commonest overall
  const kindOf = t => roofKind({ roofSet: +t.split(',')[2] });
  const pick = [], seen = new Set();
  for (const e of all) if (!seen.has(kindOf(e[0]))) { seen.add(kindOf(e[0])); pick.push(e[0]); }
  for (const e of all) { if (pick.length >= FINISH_MAX) break; if (pick.indexOf(e[0]) < 0) pick.push(e[0]); }
  return pick.map(t => { const v = t.split(',').map(Number); return Object.assign(Object.fromEntries(FINISH_KEYS.map((k, i) => [k, v[i]])), { roofKind: kindOf(t) }); });
}
function finishOf(P, table, kind) {
  let best = -1, bd = Infinity;
  table.forEach((f, i) => {
    if (f.roofKind !== kind) return;
    let d = 0; FINISH_KEYS.forEach((k, j) => { if (Math.round(P[k] || 0) !== f[k]) d += j === 0 ? 3 : j === 2 ? 2 : 1; });
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// ---------------------------------------------------------------------------
// the instance table: 32 B a house
// ---------------------------------------------------------------------------
//  0 f32 x   4 f32 z   (the premises frame of the record: O.frame; the house's centre)
//  8 f32 y   the kit's ground plane under it: the HIGH corner's ground (the archetype's floor clears it by its own
//            floorY, as placeHouse's floor clears the high corner)
// 12 u16 yaw (2 pi / 65536)    14 u8 archetype (bit 7: mirrored along its ridge)    15 u8 finish set
// 16 u8 wall paint  17 u8 trim paint  18 u8 roof paint (HOUSE_GEN.COLS indices)
// 19 u8 weather  20 u8 dirt  21 u8 lights (the lit share of the panes; 0 dark)  (each / 255)
// 22 i8 the stretch along the ridge ((s - 1) * 500: +-25 %, the kit holds it to +-10 %)
// 23 u8 flags: 1 outbuilding, 2 a water plot, 4 a named preset stood here
// 24 i16 x4 the ground at the footprint's corners under the plane, cm (-L/2,-w/2) (+L/2,-w/2) (+L/2,+w/2) (-L/2,+w/2)
//           in the archetype's frame, after the stretch and the mirror: what the stance weight stretches down to
const INST = 32;
const STRETCH = [0.9, 1.1];
// THE MOST GROUND A STANCE STRETCHES OVER, high corner to low. A land house on posts past 6 m of fall is no longer
// the house the archetype drew (a two-storey stilt house is its own shape); a house over the water stands at the
// waterline with its front piles in the sea, and on Jolene's steep shores the unique houses carry 6-15 m of pile
// (the stretch is the same straight line down the pile the generator draws)
const RISE_MAX = { land: 6, water: 20, out: 12 };
function groundCorners(h, L, w) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => h.ground(q[0] * L / 2, q[1] * w / 2));
}
// does the archetype stand on this plot as the unique house did: its whole plan (porch, stairs, lean-to) inside
// the plot, a slab only where the ground is near flat (placeHouse: a rise past 0.55 m puts a slab on posts), the
// water on the water
function fits(a, s, plot, h, scale, mirror) {
  const PG = loadGens().PG;
  const bb = a.bbox, sx = scale * (mirror ? -1 : 1);
  const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
  const toW = (lx, lz) => [h.x + lx * cy + lz * sy, h.z - lx * sy + lz * cy];
  const xs = [bb[0] * sx, bb[3] * sx];
  for (const lx of xs) for (const lz of [bb[2], bb[5]]) { const p = toW(lx, lz); if (!PG.inPoly(plot.poly, p[0], p[1])) return false; }
  const water = plot.side === 'water';
  if (!!a.P.water !== water && a.split !== 'out') return false;
  const g = groundCorners(h, a.foot.L * scale, a.foot.w);
  const rise = Math.max(...g) - Math.min(...g);
  // placeHouse's own rule for a HOUSE (an outbuilding keeps its slab and raises its floor: planOutbuilding)
  if (a.split !== 'out' && Math.round(a.P.stance) === 0 && rise > 0.55) return false;
  return rise <= RISE_MAX[a.split === 'out' ? 'out' : water ? 'water' : 'land'];
}
function assign(S, arch, finishSets) {
  const houses = arch.filter(a => a.split !== 'out');
  const outA = new Map(arch.filter(a => a.split === 'out').map(a => [a.kind, a]));
  const rows = [];
  const hash = k => { let x = (k * 2654435761) >>> 0; x ^= x >>> 15; return x; };
  // where it may stand: the unique house's own spot first, then NUDGED - along its own axes, half a metre at a time up
  // to two (placeHouse steps a house that will not fit back toward the road the same way); a nudge costs in the pick
  const NUDGE = [[0, 0]];
  for (let r = 0.5; r <= 2.001; r += 0.5) NUDGE.push([0, -r], [0, r], [-r, 0], [r, 0]);
  const moved = (h, dx, dz) => {
    if (!dx && !dz) return h;
    const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw), x = h.x + dx * cy + dz * sy, z = h.z - dx * sy + dz * cy;
    return Object.assign({}, h, { x, z, ground: (lx, lz) => h.ground(lx + dx, lz + dz) });
  };
  const place = (s, list, flags) => {
    const f = feat(s.P), sp = splitOf(f);
    let best = null;
    for (const nd of NUDGE) {
      const h = moved(s.house, nd[0], nd[1]);
      for (const a of list) {
        if (a.split !== 'out' && a.split !== sp) continue;
        const scale = Math.max(STRETCH[0], Math.min(STRETCH[1], s.P.L / a.foot.L));
        const pref = hash(s.plot.seed + (flags & 1 ? 7 : 0)) & 1;
        for (const mirror of [pref, 1 - pref]) {
          if (!fits(a, s, s.plot, h, scale, !!mirror)) continue;
          const d = (a.split === 'out' ? 0 : dist(f, Object.assign(feat(a.P), { L: a.foot.L * scale, clear: f.clear })) + Math.abs(scale - 1)) + 0.5 * Math.hypot(nd[0], nd[1]);
          if (!best || d < best.d - 1e-9) best = { a, scale, mirror, d, h, nudge: nd };
          break;
        }
      }
      if (best) break;                  // the least nudge that fits anything
    }
    if (!best) { rows.push({ s, a: null, flags }); return; }
    const L = best.a.foot.L * best.scale, h = best.h;
    const g = groundCorners(h, L, best.a.foot.w).map(v => v + h.y);
    const y = Math.max(...g);
    // the corners in the ARCHETYPE's frame: a mirror swaps -x and +x
    const gc = best.mirror ? [g[1], g[0], g[3], g[2]] : g;
    rows.push({ s, a: best.a, flags, x: h.x, z: h.z, y, yaw: h.yaw, mirror: best.mirror, scale: best.scale, nudge: best.nudge, h,
      finish: finishOf(s.P, finishSets, best.a.roofKind), ground: gc.map(v => v - y), d: best.d });
  };
  for (const s of S.houses) place(s, houses, (s.plot.side === 'water' ? 2 : 0) | (s.preset ? 4 : 0));
  for (const o of S.outs) place(o, [outA.get(o.kind)].filter(Boolean), 1);
  return rows;
}
function encodeInstances(rows) {
  const ok = rows.filter(r => r.a);
  const b = Buffer.alloc(ok.length * INST);
  const u8 = v => Math.max(0, Math.min(255, Math.round(v)));
  ok.forEach((r, i) => {
    const o = i * INST, P = r.s.P;
    b.writeFloatLE(r.x, o); b.writeFloatLE(r.z, o + 4); b.writeFloatLE(r.y, o + 8);
    const yaw = ((r.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    b.writeUInt16LE(Math.round(yaw / (2 * Math.PI) * 65536) & 65535, o + 12);
    b.writeUInt8(r.a.id | (r.mirror ? 128 : 0), o + 14);
    b.writeUInt8(Math.max(0, r.finish), o + 15);
    b.writeUInt8(u8(P.wallCol || 0), o + 16); b.writeUInt8(u8(P.trimCol || 0), o + 17); b.writeUInt8(u8(P.roofCol || 0), o + 18);
    b.writeUInt8(u8((P.weather || 0) * 255), o + 19); b.writeUInt8(u8((P.dirt || 0) * 255), o + 20);
    b.writeUInt8(u8(P.lights ? (P.winLit || 0) * 255 : 0), o + 21);
    b.writeInt8(Math.max(-127, Math.min(127, Math.round((r.scale - 1) * 500))), o + 22);
    b.writeUInt8(r.flags & 255, o + 23);
    for (let k = 0; k < 4; k++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r.ground[k] * 100))), o + 24 + k * 2);
  });
  return { buf: b, plots: ok.map(r => [r.s.plot.id, r.flags & 1 ? 1 : 0]) };
}
function decodeInstances(b) {
  const out = [];
  for (let o = 0; o + INST <= b.length; o += INST) {
    const ai = b.readUInt8(o + 14);
    out.push({ x: b.readFloatLE(o), z: b.readFloatLE(o + 4), y: b.readFloatLE(o + 8), yaw: b.readUInt16LE(o + 12) / 65536 * 2 * Math.PI,
      arch: ai & 127, mirror: !!(ai & 128), finish: b.readUInt8(o + 15), wallCol: b.readUInt8(o + 16), trimCol: b.readUInt8(o + 17), roofCol: b.readUInt8(o + 18),
      weather: b.readUInt8(o + 19) / 255, dirt: b.readUInt8(o + 20) / 255, lights: b.readUInt8(o + 21) / 255,
      scale: 1 + b.readInt8(o + 22) / 500, flags: b.readUInt8(o + 23), ground: [0, 1, 2, 3].map(k => b.readInt16LE(o + 24 + k * 2) / 100) });
  }
  return out;
}
// the instance file: a small JSON header (the record, the frame, the plot of each row) and the rows
function instanceFile(rows, S, packHash) {
  const e = encodeInstances(rows);
  const head = Buffer.from(JSON.stringify({ magic: 'TKIN', v: 1, stride: INST, pack: packHash, record: 'tools/fixtures/island_jolene.json', frame: S.O.frame || null, count: e.plots.length, plots: e.plots }));
  const pre = Buffer.alloc(8); pre.writeUInt32LE(head.length, 0); pre.writeUInt32LE(INST, 4);
  const pad = Buffer.alloc((4 - ((8 + head.length) & 3)) & 3);
  const raw = Buffer.concat([pre, head, pad, e.buf]);
  return { raw, gz: zlib.gzipSync(raw, { level: 9, mtime: 0 }), count: e.plots.length };
}

// ---------------------------------------------------------------------------
// 5 SHEET - a flat-shaded axonometric of every archetype, rasterised here
// ---------------------------------------------------------------------------
// the colour each role reads as on the sheet: the generator's own flat stand-ins (HOUSE_GEN.MAT, what a page with
// no payload draws), the siding in the archetype's own sampled paint so the sheet is not thirty red houses
function roleColours(a) {
  const HG = loadGens().HG, out = [];
  for (const k of HG.BAGS) { const m = HG.MAT[k]; out.push(m && m.color ? m.color.hex : 0x888888); }
  const wc = Math.round(a.src.P.wallCol || 0);
  const sid = HG.BAGS.indexOf('siding');
  out[sid] = wc > 0 ? HG.COLS[wc][1] : 0x8a7560;       // natural wood where unpainted
  const rc = Math.round(a.src.P.roofCol || 0);
  if (rc > 0) out[HG.BAGS.indexOf('roof')] = out[HG.BAGS.indexOf('rib')] = HG.COLS[rc][1];
  return out;
}
// A 5x7 FONT for the labels (the sheet is a PNG so it opens anywhere; no font file, no dependency)
const FONT = (() => {
  const g = {
    A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
    D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
    G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
    J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
    M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
    P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
    S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
    V: '10001100011000110001100010101000100', W: '10001100011000110101101011101110001', X: '10001100010101000100010101000110001',
    Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
    0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
    3: '11111000100010000010000011000101110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
    6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
    9: '01110100011000101111000010001001100', ' ': '00000000000000000000000000000000000', '.': '00000000000000000000000000110001100',
    '-': '00000000000000011111000000000000000', '/': '00001000010001000100010001000010000', '=': '00000000001111100000111110000000000',
    '#': '01010010101111101010111110101001010', ':': '00000011000110000000011000110000000', '+': '00000001000010011111001000010000000',
    '(': '00010001000100001000010000010000010', ')': '01000001000001000010000100010001000', ',': '00000000000000000000001100010001000',
    '%': '11000110010001000100010001001100011', '_': '00000000000000000000000000000011111',
  };
  return g;
})();
function rasterSheet(arch, opts) {
  const o = opts || {};
  const cols = o.cols || 6, TW = o.tw || 320, TH = o.th || 210, LABEL = 32, PAD = 10;
  const rows = Math.ceil(arch.length / cols);
  const W = cols * TW, H = rows * (TH + LABEL) + 26;
  const img = new Uint8Array(W * H * 3).fill(0), zb = new Float32Array(W * H);
  const bg = [236, 233, 226];
  for (let i = 0; i < W * H; i++) { img[i * 3] = bg[0]; img[i * 3 + 1] = bg[1]; img[i * 3 + 2] = bg[2]; }
  // the view: an axonometric from the front-left, 30 degrees round, 28 down (the front is +z, the street side)
  const ya = -35 * Math.PI / 180, pa = 28 * Math.PI / 180;
  const cyw = Math.cos(ya), syw = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
  const view = (x, y, z) => { const X = x * cyw + z * syw, Z0 = -x * syw + z * cyw; return [X, y * cp - Z0 * sp, y * sp + Z0 * cp]; };
  const sun = (() => { const v = [-0.45, 0.8, 0.55], l = Math.hypot(...v); return v.map(t => t / l); })();
  // ONE SCALE FOR THE SHEET, so the size classes read as sizes; each house centred on its own projected box
  const pbox = a => { const b = a.bbox, r = [1e9, 1e9, -1e9, -1e9]; for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) { const v = view(x, y, z); r[0] = Math.min(r[0], v[0]); r[1] = Math.min(r[1], v[1]); r[2] = Math.max(r[2], v[0]); r[3] = Math.max(r[3], v[1]); } return r; };
  let ext = 0;
  for (const a of arch) { const r = pbox(a); ext = Math.max(ext, (r[2] - r[0]) / (TW - 2 * PAD), (r[3] - r[1]) / (TH - 2 * PAD)); }
  const k = 1 / ext;
  const text = (s, x0, y0, col, sc) => {
    let x = x0;
    for (const ch of String(s).toUpperCase()) {
      const gl = FONT[ch] || FONT[' '];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r * 5 + c] === '1')
        for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) { const px = x + c * sc + dx, py = y0 + r * sc + dy; if (px >= 0 && px < W && py >= 0 && py < H) { const q = (py * W + px) * 3; img[q] = col[0]; img[q + 1] = col[1]; img[q + 2] = col[2]; } }
      x += 6 * sc;
    }
  };
  text('TOWN KIT (G850): ' + arch.length + ' ARCHETYPES AT LOD 0, ONE SCALE, EACH IN ITS SAMPLED PAINT. ' + (o.subtitle || ''), 8, 6, [40, 40, 40], 2);
  arch.forEach((a, ai) => {
    const cx0 = (ai % cols) * TW, cy0 = 26 + Math.floor(ai / cols) * (TH + LABEL);
    const colr = roleColours(a), L = a.lods[o.lod || 0];
    const pb = pbox(a), ox = cx0 + TW / 2 - (pb[0] + pb[2]) / 2 * k, oy = cy0 + TH / 2 + (pb[1] + pb[3]) / 2 * k;
    const n = L.role.length, P2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = view(L.pos[i * 3], L.pos[i * 3 + 1], L.pos[i * 3 + 2]); P2[i * 3] = ox + v[0] * k; P2[i * 3 + 1] = oy - v[1] * k; P2[i * 3 + 2] = v[2]; }
    for (let t = 0; t < L.idx.length; t += 3) {
      const ia = L.idx[t], ib = L.idx[t + 1], ic = L.idx[t + 2];
      // the face's own normal (the flat look reads the construction)
      const ax = L.pos[ia * 3], ay = L.pos[ia * 3 + 1], az = L.pos[ia * 3 + 2];
      const ux = L.pos[ib * 3] - ax, uy = L.pos[ib * 3 + 1] - ay, uz = L.pos[ib * 3 + 2] - az;
      const vx = L.pos[ic * 3] - ax, vy = L.pos[ic * 3 + 1] - ay, vz = L.pos[ic * 3 + 2] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz); if (nl < 1e-12) continue;
      nx /= nl; ny /= nl; nz /= nl;
      const vn = view(nx, ny, nz);
      if (vn[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }          // double-sided: cloth and thin members
      const role = L.role[ia], base = colr[role];
      const ao = (L.ao[ia] + L.ao[ib] + L.ao[ic]) / 3;
      const lam = Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]);
      const sh = (0.42 + 0.62 * lam) * (0.35 + 0.65 * ao);
      const glass = loadGens().HG.BAGS[role] === 'glass' || loadGens().HG.BAGS[role] === 'pane';
      const cr = Math.min(255, ((base >> 16) & 255) * sh + (glass ? 20 : 0)), cg = Math.min(255, ((base >> 8) & 255) * sh + (glass ? 26 : 0)), cb = Math.min(255, (base & 255) * sh + (glass ? 34 : 0));
      const x0 = P2[ia * 3], y0 = P2[ia * 3 + 1], z0 = P2[ia * 3 + 2], x1 = P2[ib * 3], y1 = P2[ib * 3 + 1], z1 = P2[ib * 3 + 2], x2 = P2[ic * 3], y2 = P2[ic * 3 + 1], z2 = P2[ic * 3 + 2];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const bx0 = Math.max(cx0, Math.floor(Math.min(x0, x1, x2))), bx1 = Math.min(cx0 + TW - 1, Math.ceil(Math.max(x0, x1, x2)));
      const by0 = Math.max(cy0, Math.floor(Math.min(y0, y1, y2))), by1 = Math.min(cy0 + TH - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
        const sx = px + 0.5, sy = py + 0.5;
        const w0 = ((x1 - sx) * (y2 - sy) - (x2 - sx) * (y1 - sy)) / area, w1 = ((x2 - sx) * (y0 - sy) - (x0 - sx) * (y2 - sy)) / area, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * z0 + w1 * z1 + w2 * z2, q = py * W + px;
        if (zb[q] !== 0 && z <= zb[q]) continue;     // +z is toward the eye (0 = empty)
        zb[q] = z === 0 ? 1e-9 : z; img[q * 3] = cr; img[q * 3 + 1] = cg; img[q * 3 + 2] = cb;
      }
    }
    // the label: its id, its class, how many plots it stands for, what it was sampled from
    const kl = a.klass, ly = cy0 + TH + 2;
    text('#' + String(a.id).padStart(2, '0') + ' ' + kl.size + ' ' + kl.fam + ' ' + kl.storeys + 'ST ' + (a.P.water ? 'WATER' : kl.stance), cx0 + 6, ly, [30, 30, 30], 2);
    const src = a.split === 'out' ? 'OUTBUILDING' : a.src.preset ? 'PRESET ' + a.src.preset : 'SAMPLER ' + String(a.src.plot.id).split(':').slice(1).join(':');
    text(a.members.length + ' PLOTS  ' + a.tris[0] + '/' + a.tris[1] + ' TRIS  ' + src.slice(0, 24), cx0 + 6, ly + 17, [95, 90, 84], 1);
    // a hairline between tiles
    for (let x = cx0; x < cx0 + TW; x++) { const q = ((cy0 + TH + LABEL - 1) * W + x) * 3; img[q] = img[q + 1] = img[q + 2] = 205; }
    for (let y = cy0; y < cy0 + TH + LABEL; y++) { const q = (y * W + cx0) * 3; img[q] = img[q + 1] = img[q + 2] = 205; }
  });
  return pngOf(W, H, img);
}
// a minimal PNG writer: 8-bit RGB, one IDAT, the Sub filter (a flat-shaded sheet is long runs of one colour)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function pngOf(W, H, rgb) {
  const row = W * 3 + 1, raw = Buffer.alloc(row * H);
  for (let y = 0; y < H; y++) {
    raw[y * row] = 1;
    for (let x = 0; x < W * 3; x++) raw[y * row + 1 + x] = (rgb[y * W * 3 + x] - (x >= 3 ? rgb[y * W * 3 + x - 3] : 0)) & 255;
  }
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// the whole run
// ---------------------------------------------------------------------------
function run(opts) {
  const o = opts || {};
  const t0 = Date.now();
  const S = sow({ outbuildings: o.outbuildings });
  const tSow = Date.now() - t0;
  const arch = buildKit(S, o.k || 30);
  const tBuild = Date.now() - t0 - tSow;
  const finishSets = finishTable(S);
  const pack = encodePack(arch, finishSets, { sown: { houses: S.houses.length, outbuildings: S.outs.length }, k: o.k || 30 });
  const rows = assign(S, arch, finishSets);
  const inst = instanceFile(rows, S, pack.hash);
  return { S, arch, finishSets, pack, rows, inst, ms: { sow: tSow, build: tBuild, all: Date.now() - t0 } };
}
const MANIFEST = path.join(ROOT, 'src', 'core', 'townkit_pack.json');
function report(R) {
  const { S, arch, pack, rows, inst } = R;
  const town = t => S.houses.filter(s => s.town === t).length;
  console.log('SOWN   ' + S.houses.length + ' plots (Metlakatla ' + town('metlakatla') + ', the village ' + town('village') + ') + ' + S.outs.length + ' outbuildings, in ' + (R.ms.sow / 1000).toFixed(1) + ' s');
  const T = [0, 0, 0], V = [0, 0, 0];
  for (const a of arch) for (let l = 0; l < 3; l++) { T[l] += a.tris[l]; V[l] += a.verts[l]; }
  console.log('KIT    ' + arch.length + ' archetypes (' + arch.filter(a => a.split !== 'out').length + ' houses + ' + arch.filter(a => a.split === 'out').length + ' outbuildings), built in ' + (R.ms.build / 1000).toFixed(1) + ' s');
  console.log('       lod 0 ' + T[0] + ' tris / ' + V[0] + ' verts, lod 1 ' + T[1] + ' / ' + V[1] + ', box ' + T[2] + ' / ' + V[2]);
  console.log('PACK   ' + (pack.raw.length / 1048576).toFixed(2) + ' MB raw, ' + (pack.gz.length / 1048576).toFixed(2) + ' MB gz, sha256 ' + pack.hash.slice(0, 16) + '  (ARCH §1.3 est. ~26 MB GPU / ~7 MB gz for 30)');
  const miss = rows.filter(r => !r.a);
  console.log('TABLE  ' + inst.count + ' instances x ' + INST + ' B = ' + (inst.raw.length / 1024).toFixed(1) + ' KB (' + (inst.gz.length / 1024).toFixed(1) + ' KB gz); unplaced ' + miss.length);
  console.log('  id  split       class                   serves  lod0 tris  lod1  source');
  for (const a of arch) {
    const kl = a.klass;
    console.log('  ' + String(a.id).padStart(2) + '  ' + a.split.padEnd(10) + '  ' + (kl.size + ' ' + kl.fam + ' ' + kl.storeys + 'st ' + kl.stance).padEnd(22) + '  ' + String(a.members.length).padStart(5) + '  ' + String(a.tris[0]).padStart(9) + '  ' + String(a.tris[1]).padStart(5) + '  ' + a.name);
  }
}
function writeOut(R, dir, names) {
  fs.mkdirSync(dir, { recursive: true });
  const pk = path.join(dir, names.pack), it = path.join(dir, names.inst);
  fs.writeFileSync(pk, R.pack.gz); fs.writeFileSync(it, R.inst.gz);
  return [pk, it];
}
if (require.main === module) {
  const argv = process.argv.slice(2), arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const R = run({ k: +(arg('--k') || 30) });
  report(R);
  const h8 = R.pack.hash.slice(0, 12);
  const names = { pack: 'townkit_' + h8 + '.bin', inst: 'townkit_jolene_' + crypto.createHash('sha256').update(R.inst.gz).digest('hex').slice(0, 12) + '.bin' };
  if (arg('--out')) { const f = writeOut(R, path.resolve(arg('--out')), names); console.log('WROTE  ' + f.join('  ')); fs.writeFileSync(path.join(path.resolve(arg('--out')), 'townkit_sheet.png'), rasterSheet(R.arch, { subtitle: 'SOWN FROM JOLENE: ' + R.S.houses.length + ' PLOTS + ' + R.S.outs.length + ' OUTBUILDINGS' })); }
  if (argv.includes('--media')) {
    const dir = path.join(ROOT, 'media', 'townkit');
    // the baker prunes what it owns (GATE MEDIA: an orphan is a broken prune)
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/^townkit_.*\.bin$/.test(f) && f !== names.pack && f !== names.inst) fs.unlinkSync(path.join(dir, f));
    writeOut(R, dir, names);
    fs.writeFileSync(MANIFEST, JSON.stringify({ note: 'GENERATED by tools/town_kit.js --media - do not edit. Both files are one gzip stream; the format is in town_kit.js (PACK / INST).',
      v: 1, pack: { src: 'media/townkit/' + names.pack, sha256: R.pack.hash, bytes: R.pack.gz.length, archetypes: R.arch.length },
      instances: [{ id: 'jolene', src: 'media/townkit/' + names.inst, count: R.inst.count, stride: INST }] }, null, 1) + '\n');
    console.log('WROTE  media/townkit/' + names.pack + ', media/townkit/' + names.inst + ', src/core/townkit_pack.json');
  }
  if (arg('--sheet')) { fs.writeFileSync(path.resolve(arg('--sheet')), rasterSheet(R.arch, { subtitle: 'SOWN FROM JOLENE: ' + R.S.houses.length + ' PLOTS + ' + R.S.outs.length + ' OUTBUILDINGS' })); console.log('WROTE  ' + arg('--sheet')); }
}

module.exports = { loadGens, sow, feat, dist, splitOf, kMedoids, allot, FLOOR, pickArchetypes, canonP, stanceTop, buildArchetype, buildKit, takeLod, boxLod,
  encodePack, decodePack, encodeLod, decodeLod, octEnc, octDec, finishTable, finishOf, assign, fits, groundCorners, encodeInstances, decodeInstances,
  instanceFile, rasterSheet, run, report, MANIFEST, INST, VSTRIDE, STRETCH, LOD_DIST, DRESSING, SEA, zoneWater };
