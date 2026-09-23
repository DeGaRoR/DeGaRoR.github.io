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
const POOL = [{ key: 'a|tall', size: 1, sink: 0, proportion: 1, h: 16 }, { key: 'b|small', size: 1, sink: 0, proportion: 1, h: 8 }];
const t0 = Date.now();
const O = PG.compose(rec, IW, { catalogue: CAT, globals: GENS, pool: POOL });
console.log('composed in ' + (Date.now() - t0) + ' ms; issues ' + O.records.issues.length);
for (const i of O.records.issues.slice(0, 8)) console.log('  ! ' + i);
const byZone = new Map();
for (const p of O.records.plots) {
  const k = p.zone + (p.pick ? '' : ' (EMPTY)');
  byZone.set(k, (byZone.get(k) || 0) + 1);
}
console.log('plots ' + O.records.plots.length);
for (const k of [...byZone.keys()].sort()) console.log('   ' + k + '  ' + byZone.get(k));
const gard = O.records.trees.filter(t => t.garden).length;
console.log('trees ' + O.records.trees.length + '  (garden ' + gard + ', forest zones ' + (O.records.trees.length - gard) + ')');
// the streets with nothing on them
const town = rec.layers.roads.filter(r => /^mk_/.test(r.id));
const have = new Set(O.records.plots.map(p => p.road));
const bare = town.filter(r => !have.has(r.id));
console.log('town roads ' + town.length + '; with no plot at all ' + bare.length);
console.log('  ' + bare.slice(0, 14).map(r => r.id).join(' '));
// the ttype stamp: what the belt actually moved
{
  const before = new Map();
  const g = IW.island && IW.island.grid, T = IW.island && IW.island.ttype;
  if (g && T) {
    const box = [-4900, -1900, -9600, -7200];
    const cnt = () => { const c = {}; for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { const x = g.x0 + i * g.cell, z = g.z0 + j * g.cell; if (x < box[0] || x > box[1] || z < box[2] || z > box[3]) continue; const v = T[j * g.w + i]; c[v] = (c[v] || 0) + 1; } return c; };
    const a = cnt();
    const undo = O.stampTtype(IW.island);
    const b = cnt();
    console.log('ttype round the town, before -> after (10 m cells):');
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if ((a[k] || 0) !== (b[k] || 0)) console.log('   code ' + k + '  ' + (a[k] || 0) + ' -> ' + (b[k] || 0));
    if (undo) undo();
    const c = cnt();
    console.log('undo exact: ' + Object.keys(a).every(k => a[k] === c[k]));
  } else console.log('no ttype grid');
}
