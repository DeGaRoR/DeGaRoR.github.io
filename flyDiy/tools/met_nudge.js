// A throwaway measurement of Metlakatla's fabric: plots per zone, trees, and
// which streets get nothing. Not a gate; run it by hand.
const fs = require('fs'), path = require('path'), vm = require('vm');
const TOOLS = __dirname;
const PG = require(path.join(TOOLS, '..', 'src', 'core', '27_premises.js'));
function makeTHREE() {
  function Col(c) { this.hex = c; } Col.prototype.setHex = function (h) { this.hex = h; };
  Col.prototype.multiplyScalar = function () { return this; };
  function Mat(o) { Object.assign(this, { isMat: 1 }, o || {}); this.color = new Col((o && o.color) || 0); }
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = i; } computeVertexNormals() {} }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class Vec2 { constructor(x, y) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
  class Texture { constructor(img) { this.image = img; this.repeat = new Vec2(1, 1); } }
  return { BufferAttribute, BufferGeometry, Mesh, Texture, Vector2: Vec2, Color: Col,
           MeshLambertMaterial: Mat, MeshStandardMaterial: Mat, MeshBasicMaterial: Mat,
           DoubleSide: 2, FrontSide: 0, RepeatWrapping: 1000, SRGBColorSpace: 'srgb', LinearSRGBColorSpace: 'srgb-linear' };
}
const GENS = {};
const ctx = { window: GENS, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_sport_gen.js', '_marine_gen.js', '_shed_gen.js', '_hangar_gen.js', '_tower_gen.js', '_tram_gen.js', '_totem_gen.js', '_village_gen.js'])
  vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
const CAT = PG.collect(GENS);
const IW = require(path.join(TOOLS, 'island_node.js')).islandWorld('jolene', {});
const rec = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec;
// ---------------------------------------------------------------------------
// met_nudge — how far each of Metlakatla's hand-placed buildings must move to
// stop standing on a street, and in which direction. The civic buildings are
// placed from the registered close views to about +-10 m, and a church whose
// corner is two metres into the carriageway looks exactly as wrong as one ten
// metres out of place; `compose` says so ("stands on road ... set it back"),
// and this is what turns that complaint into a number the author can record.
// Run it, paste the block into metlakatla_author.py's NUDGE, re-run the author,
// run it again: it should print nothing.
//   node tools/met_nudge.js
// ---------------------------------------------------------------------------
const O = PG.compose(rec, IW, { catalogue: CAT, globals: GENS });
// THE COMPOSER'S OWN TEST, verbatim (27_premises.js, the sites stage), on the
// COMPOSED roads - the smoothed line, not the record's polyline - because a
// corner test of my own missed the second half of it and the nudges chased a
// complaint that was never the one being made: a road may run THROUGH a foot
// without either of the foot's corners being near its centreline.
const roads = O.roads.filter(r => !r.runway);
const byItem = new Map();
for (const st of rec.layers.sites) for (const q of (st.items || [])) byItem.set(st.id + '/' + q.id, q);
const fouls = it => {
  if (!it.foot) return null;
  // the composer excuses an item that DECLARES it belongs on the road
  const rit = byItem.get(String(it.id)) || {};
  if (rit.onRoad || rit.bottomOnRoad) return null;
  for (const rd of roads) {
    const rp = PG.polyRoad(rd.pts, rd.w);
    if (PG.roadInPoly(rp, it.foot).length || it.foot.some(q => PG.roadDist(rd, q[0], q[1]) < rd.w / 2)) return rd;
  }
  return null;
};
// how far a foot is from every street: the least corner clearance, negative when fouled
const MARGIN = 1.2;
const clearance = (it, dx, dz) => {
  const foot = it.foot.map(q => [q[0] + dx, q[1] + dz]);
  let m = 1e9;
  for (const rd of roads) {
    const rp = PG.polyRoad(rd.pts, rd.w);
    if (PG.roadInPoly(rp, foot).length) return -99;
    for (const q of foot) m = Math.min(m, PG.roadDist(rd, q[0], q[1]) - rd.w / 2);
  }
  return m;
};
const out = [];
for (const it of O.records.items) {
  const bad = fouls(it);
  if (!bad) continue;
  let best = null;
  for (let r = 0.5; r <= 16 && !best; r += 0.5)
    for (let a = 0; a < 72; a++) {
      const dx = Math.cos(a * Math.PI / 36) * r, dz = Math.sin(a * Math.PI / 36) * r;
      const c = clearance(it, dx, dz);
      if (c >= MARGIN && (!best || c > best.c)) best = { dx, dz, c };
    }
  const id = String(it.id).split('/')[0];
  if (!best) { console.log('    # ' + id + ': no offset within 16 m clears every street (' + bad.id + ')'); continue; }
  out.push([id, best.dx, best.dz, clearance(it, 0, 0), bad.id]);
}
for (const [id, dx, dz, c0, rid] of out)
  console.log("    '" + id + "': (" + (Math.round(dx * 10) / 10) + ", " + (Math.round(dz * 10) / 10) + "),   # " + c0.toFixed(1) + " m clear of " + rid);
console.log('# ' + out.length + ' item' + (out.length === 1 ? '' : 's') + ' foul a street');
