// kit_lot.js - METLAKATLA ON THE KIT: A KIT PLOT'S LOT, GENERATED (C3c of QUEUE-C, G860-G864; ARCH-2026-09-27 §5).
//
// With the town on (?town=1, G590), a plot Metlakatla's zones SOWED (an `mk_` zone's plot, not a site's landmark) whose
// id and seed are in the town kit's instance table (tools/town_kit.js, C3a's format) is a KIT PLOT: its house and its
// outbuilding are instances of the kit (src/viewer/townkit.js, C3b's host - no HOUSE_GEN build, no geometry of their
// own), and this file generates the rest of the lot the way the unique house's lot is generated - on the page's thread
// or in the house worker (C2a), through premises_build.js's own builder:
//   THE PLAN BUILD. VILLAGE_GEN.placeHouse on the plot exactly as tools/town_kit.js sowed it (the zone's rules, the
//   pick's preset, the plot's seed) and HOUSE_GEN.build at LOD 1 - the generator's far mesh, ~15 % of the lod-0 build
//   and no voxel AO bake of the house's lod 0 - read for its PLAN only: the stair, the stoop and the front (finishPlot:
//   the path, the fences, the outbuilding, the car and the boat), the ground occluders (the lot patch), the pier
//   (its modules and its boats), the people, the yard and the lamps (their props). The house's own bags are DROPPED
//   (the kit draws the house); kept are
//     the pier's piles        (`pile`: buildPierPiles alone writes it - the stretch down to the seabed under a module)
//     the jetty               (the landing the stair comes down to over the water: `deck` + `post` cut to its box -
//                              the user: "I loved the ability to draw piers with boats"; the jetty is drawn with the pier)
//   THE TIDE. The house stands against ITS ZONE'S water (PREMISES_GEN.zoneWaterY, the sower's rule G434/G434.1 - the
//   kit's sowing reads the same), not world.waterH(0, 0): on Jolene that is the world origin, dry land, -Infinity, and
//   every waterfront house of the unique path walked out to its plot's depth limit with no landing and no pier (G850).
//   Metlakatla's plots only: the village and the editor's places keep the unique path as it is.
//   THE DRESSING is premises_build.js genDress, unchanged (the fence, the outbuilding at lod 1 - drawn only when the
//   table's outbuilding is not the one this lot planned, render_premises decides - and the lot patch).
// The result has the unique house's result's SHAPE (kind 'house', lod1 null), so premises_build.js packs and unpacks it
// for the worker as it does a house; the worker's job kind is 'kit' (its own cache key).
//
//   KIT_LOT.gen(B, plot)      -> the result (B: a premises_build.js builder)
//   KIT_LOT.extend(B)         -> B, answering the worker's 'kit' jobs (find / gen)
//   KIT_LOT.zoneWater(C, zid) -> the zone's water (cached per composition)
//   KIT_LOT.KEEP              the bags a kit lot keeps whole
'use strict';
(function () {
const ROOT = typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis);
const KEEP = ['pile'];
const JETTY_BAGS = ['deck', 'post'];
// the sea where a zone reads none (Jolene's datum, GATE PREMISES 14; tools/town_kit.js SEA)
const SEA = 0;

// ---- the zone's water, once per composition ----
const ZW = new WeakMap();
function zoneWater(C, zid) {
  const O = C.O, PG = C.PG, world = C.world;
  let M = ZW.get(O); if (!M) ZW.set(O, M = new Map());
  if (M.has(zid)) return M.get(zid);
  const z = ((C.rec && C.rec.layers && C.rec.layers.zones) || []).find(q => q.id === zid);
  const F = O.frame;
  let v = world && PG.zoneWaterY ? PG.zoneWaterY(world, F, z, -Infinity) : -Infinity;
  if (!isFinite(v)) { const at = world && world.waterH ? world.waterH(F.anchor.x, F.anchor.z) : -Infinity; v = isFinite(at) ? at : SEA; }
  M.set(zid, v);
  return v;
}

// ---- a bag cut to the triangles inside a box (the jetty's), its vertices compacted; every channel rides along ----
function cutBag(HK, bag, inside) {
  const r = bag.raw(), out = HK.Bag(bag.name), q = out.raw(), map = new Map();
  for (let t = 0; t < r.idx.length; t += 3) {
    const a = r.idx[t], b = r.idx[t + 1], c = r.idx[t + 2];
    if (!inside((r.pos[a * 3] + r.pos[b * 3] + r.pos[c * 3]) / 3, (r.pos[a * 3 + 1] + r.pos[b * 3 + 1] + r.pos[c * 3 + 1]) / 3, (r.pos[a * 3 + 2] + r.pos[b * 3 + 2] + r.pos[c * 3 + 2]) / 3)) continue;
    for (const i of [a, b, c]) {
      let j = map.get(i);
      if (j === undefined) {
        j = q.pos.length / 3; map.set(i, j);
        q.pos.push(r.pos[i * 3], r.pos[i * 3 + 1], r.pos[i * 3 + 2]); q.uv.push(r.uv[i * 2], r.uv[i * 2 + 1]);
        q.ao.push(r.ao[i]); q.lit.push(r.lit[i]); q.win.push(r.win[i * 3], r.win[i * 3 + 1], r.win[i * 3 + 2]);
        if (r.nOv.has(i)) q.nOv.set(j, r.nOv.get(i));
      }
      q.idx.push(j);
    }
  }
  return out;
}

// ---- the lot ----
function gen(B, plot) {
  const C = B.C, g = C.G, PG = C.PG, VG = g.VILLAGE_GEN, HG = g.HOUSE_GEN, HK = g.HOUSE_KIT, PB = g.PREMISES_BUILD, O = C.O, rec = C.rec;
  if (!VG || !HG || !HK || !PB) return null;
  // render_premises.js buildHouse's recipe (premises_build.js genHouse), the tide the zone's
  const Tv = { h: (lx, lz) => O.localH(lx, lz), waterY: zoneWater(C, plot.zone), size: C.size() };
  const rules = Object.assign({}, PG.ZONE_RULES, (rec.layers.zones.find(z => z.id === plot.zone) || {}).rules || {});
  const V = Object.assign({}, VG.VDEF, { plotDepth: rules.plotDepth, riparian: rules.riparian, seed: rec.seed });
  const rnd = PG.mulberry32(plot.seed);
  let preset;
  if (plot.pick && plot.pick !== 'sampler') { const e = PG.collect(g).entries.get(plot.pick); if (e && e.gen === 'HOUSE_GEN') preset = e.preset; }
  const house = VG.placeHouse(Tv, V, plot, plot.seed % 100000, rnd, preset);
  if (!B.S.spread && HG.makeSpread) B.S.spread = HG.makeSpread();
  if (B.S.spread) house.P.spread = B.S.spread;
  const F = HG.makeFinish();
  HG.applyFinish(house.P, F);
  const u0 = PB.uniSnap(F);
  // THE PLAN BUILD (lod 1): its stats are the plan; its bags go but the pier's piles and the jetty - and no voxel AO
  // bake (P.ao 0: the bake is most of a lod-1 build, and the house it would shade is the kit's)
  const built = HG.build(Object.assign({}, house.P, { ao: 0 }), 1, F);
  built.BAGS = HG.BAGS;
  const fin = PB.uniDiff(u0, F);
  const jt = built.stats.jetty;
  // the landing's box (buildDeck: jw x 1.5 m at the stair's foot, its piles and bollards inside, its level a hand over
  // the tide): what is lower than a bollard's top inside it - never the house's deck, which stands a storey up
  const jin = jt && isFinite(jt.z0) ? (x, y, z) => Math.abs(x - jt.x) <= jt.w / 2 + 0.2 && z >= jt.z0 - 0.2 && z <= jt.z1 + 0.2 && y <= jt.y + 0.7 : null;
  let keptTris = 0;
  for (const k of Object.keys(built.bags)) {
    const bag = built.bags[k];
    if (KEEP.indexOf(k) >= 0) { keptTris += bag.tris; continue; }
    if (jin && JETTY_BAGS.indexOf(k) >= 0) { built.bags[k] = cutBag(HK, bag, jin); keptTris += built.bags[k].tris; continue; }
    built.bags[k] = HK.Bag(k);
  }
  built.stats.kitLot = { planTris: built.stats.tris, keptTris };
  built.stats.tris = keptTris;
  const dress = B.genDress(plot, house, built, V, Tv);
  return { kind: 'house', kit: true, house, built, lod1: null, F, fin, dress, Tv, V };
}

// the worker's jobs: kind 'kit' finds its plot as a house does and generates the lot
function extend(B) {
  if (B.kitLot) return B;
  const find0 = B.find, gen0 = B.gen;
  B.find = j => find0(j && j.kind === 'kit' ? Object.assign({}, j, { kind: 'house' }) : j);
  B.gen = (j, x) => (j && j.kind === 'kit' ? gen(B, x) : gen0(j, x));
  B.kitLot = true;
  return B;
}

const API = { gen, extend, zoneWater, cutBag, KEEP, JETTY_BAGS, SEA };
ROOT.KIT_LOT = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
