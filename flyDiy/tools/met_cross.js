// ---------------------------------------------------------------------------
// met_cross — how a town's road network actually meets itself.
//
//   node tools/met_cross.js [--all] [--town mk_]
//
// A record's roads are authored one at a time and nothing has ever looked at
// what they do to EACH OTHER. Four faults, and all four are visible from the
// air before any of them is visible in a diff:
//
//   DOUBLE      two roads running side by side for a long way - the same street
//               traced twice, which on the ground is two carriageways through
//               somebody's garden. This is what the user's red pen was about.
//   SLIVER      a crossing at a very shallow angle: the two ribbons overlap for
//               tens of metres and the paint, the band and the guardrails all
//               fight inside that lens.
//   STUB        an end that stops in the open - not on another road, not at a
//               site, not at the water. A street that goes nowhere.
//   NEAR MISS   an end that stops 1-12 m short of another road. On the ground
//               that is a junction the network does not have: the traffic, the
//               pole line and the plot sower all treat them as unconnected.
//
// It reads the composed roads (so it sees the fillet, contract v1.20, and any
// trim the author applied), not the record's raw polylines.
// ---------------------------------------------------------------------------
const fs = require('fs'), path = require('path'), vm = require('vm');
const TOOLS = __dirname;
const PG = require(path.join(TOOLS, '..', 'src', 'core', '27_premises.js'));
const ARG = process.argv.slice(2);
const PREFIX = (ARG.includes('--town') ? ARG[ARG.indexOf('--town') + 1] : 'mk_');
const ALL = ARG.includes('--all');

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
const O = PG.compose(rec, IW, { catalogue: CAT, globals: GENS });

const roads = O.roads.filter(r => !r.runway && (ALL || String(r.id).indexOf(PREFIX) === 0));
console.log(roads.length + ' roads (' + (ALL ? 'the whole record' : 'prefix "' + PREFIX + '"') + ')');

// ---- the sampling -----------------------------------------------------------
const STEP = 8;
const samp = new Map();
let total = 0;
for (const r of roads) {
  const S = [];
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / STEP));
    for (let k = 0; k < n; k++) S.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  S.push(r.pts[r.pts.length - 1]);
  samp.set(r.id, S);
  total += S.length;
}
const dist = (r, x, z) => PG.roadDist(r, x, z);
const tangentAt = (S, i) => {
  const a = S[Math.max(0, i - 2)], b = S[Math.min(S.length - 1, i + 2)];
  const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / L, d[1] / L];
};

// ---- 1. DOUBLES and 2. SLIVERS ----------------------------------------------
const doubles = [], slivers = [];
for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
  const A = roads[i], B = roads[j], SA = samp.get(A.id), SB = samp.get(B.id);
  const reach = (A.w + B.w) / 2 + 9;          // two ribbons this close share ground
  let near = 0, aligned = 0, cross = [];
  for (let k = 0; k < SA.length; k++) {
    const d = dist(B, SA[k][0], SA[k][1]);
    if (d > reach) continue;
    near++;
    // the angle between them here
    let bi = 0, bd = 1e9;
    for (let m = 0; m < SB.length; m++) { const q = Math.hypot(SB[m][0] - SA[k][0], SB[m][1] - SA[k][1]); if (q < bd) { bd = q; bi = m; } }
    const ta = tangentAt(SA, k), tb = tangentAt(SB, bi);
    const ang = Math.acos(Math.max(-1, Math.min(1, Math.abs(ta[0] * tb[0] + ta[1] * tb[1])))) * 180 / Math.PI;
    if (ang < 22) aligned++;
    else cross.push([SA[k], ang]);
  }
  if (!near) continue;
  const runA = aligned * STEP;
  if (runA >= 60) doubles.push([A, B, runA, aligned / SA.length]);
  else if (cross.length) {
    // a crossing: its shallowest angle, and how long the ribbons overlap there
    let worst = 90;
    for (const [, a] of cross) worst = Math.min(worst, a);
    const lens = cross.length * STEP;
    if (worst < 28 && lens > 18) slivers.push([A, B, worst, lens, cross[0][0]]);
  }
}

// ---- 3. STUBS and 4. NEAR MISSES --------------------------------------------
const items = O.records.items || [];
const stubs = [], misses = [];
for (const r of roads) {
  const S = samp.get(r.id);
  for (const [name, p] of [['start', S[0]], ['end', S[S.length - 1]]]) {
    let best = null;
    for (const q of roads) {
      if (q.id === r.id) continue;
      const d = dist(q, p[0], p[1]) - q.w / 2;
      if (best === null || d < best.d) best = { d, id: q.id };
    }
    if (best && best.d <= 1.0) continue;                          // it meets the network
    if (O.terrainAt(p[0], p[1]) <= 1.5) continue;                 // it ends at the water
    const site = items.some(it => Math.hypot(it.x - p[0], it.z - p[1]) < 40);
    if (best && best.d < 12) misses.push([r, name, best.id, best.d, p]);
    else if (!site) stubs.push([r, name, p, best ? best.d : Infinity]);
  }
}

// ---- the report -------------------------------------------------------------
const f = v => (Math.round(v * 10) / 10).toFixed(1);
const at = p => '(' + Math.round(p[0]) + ', ' + Math.round(p[1]) + ')';
console.log(total + ' samples at ' + STEP + ' m\n');

console.log('DOUBLES — two roads side by side (' + doubles.length + ')');
doubles.sort((a, b) => b[2] - a[2]);
for (const [A, B, run, share] of doubles)
  console.log('  ' + A.id + ' / ' + B.id + '  ' + Math.round(run) + ' m together, ' + Math.round(share * 100) + ' % of ' + A.id);
if (!doubles.length) console.log('  none');

console.log('\nSLIVER CROSSINGS — under 28 deg, overlapping over 18 m (' + slivers.length + ')');
slivers.sort((a, b) => a[2] - b[2]);
for (const [A, B, ang, len, p] of slivers)
  console.log('  ' + A.id + ' x ' + B.id + '  ' + f(ang) + ' deg over ' + Math.round(len) + ' m at ' + at(p));
if (!slivers.length) console.log('  none');

console.log('\nNEAR MISSES — an end 1-12 m short of another road (' + misses.length + ')');
misses.sort((a, b) => a[3] - b[3]);
for (const [r, which, id, d, p] of misses)
  console.log('  ' + r.id + ' ' + which + ' is ' + f(d) + ' m off ' + id + ' at ' + at(p));
if (!misses.length) console.log('  none');

console.log('\nSTUBS — an end in the open, no road, no site, no water (' + stubs.length + ')');
stubs.sort((a, b) => a[3] - b[3]);
for (const [r, which, p, d] of stubs)
  console.log('  ' + r.id + ' ' + which + ' at ' + at(p) + (isFinite(d) ? '  nearest road ' + Math.round(d) + ' m' : ''));
if (!stubs.length) console.log('  none');

// junction census, for scale
let junc = 0;
for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
  const SA = samp.get(roads[i].id);
  let hit = false;
  for (const p of SA) if (dist(roads[j], p[0], p[1]) < (roads[i].w + roads[j].w) / 2) { hit = true; break; }
  if (hit) junc++;
}
console.log('\n' + junc + ' road pairs touch at all (the junction count, roughly)');
