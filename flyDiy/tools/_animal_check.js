#!/usr/bin/env node
// _animal_check.js — GATE ANIMALS (2026-09-22): the animals said three times
// must agree — the DECLARED TABLE (tools/animals_table.py), the SHIPPED
// payload (src/animals/*_animal.js + animals_lods.js) and what the game
// actually does with them (src/viewer/animals.js + animal_run.js, run here
// against the real vendor/three.min.js under node).
//
//   1  the table is the payload: every row a manifest, in the table's order,
//      with its label, its credit, its kind and its declared length; nothing
//      shipped that is not declared
//   2  every skin DECODES: the joint tree closes, every skin index is a
//      joint, every weight set sums to 1, and the REST MESH MEASURES the
//      declared length along the declared axis, within 1 %
//   3  every declared clip is there, on a uniform grid, its channels a
//      subset of the tree; a gait's `dir` is the row's `forward`; a gait's
//      measured ground speed is an animal's, not a cartoon's
//   4  THE LADDER: every level stands in for a real animal, wears only that
//      animal's maps, is under its predecessor's triangle count, stands in
//      from farther, and is THE SAME ANIMAL - its posed box within 4 % of
//      the rest box along the length axis ("a similar volume", asserted)
//   5  every media file the payload names is on disk
//   6  THE BEHAVIOURS RUN: 3600 steps of a herd, a pod and a flock on a
//      synthetic island - no NaN, nobody under the terrain or in the sea,
//      nobody outside the hotspot, the clip machine reaches every state it
//      has clips for, the pod surfaces and dives, the flock crosses
//   7  THE RECORD: an `animal` object composes, validates, and survives a
//      save/load round trip; a hotspot outside the premises' extent still
//      composes (a whale lives 8 km out)
//  10  THE MAP marks every hotspot (the record's, not the individuals'),
//      its shape by where the animal lives and its radius when it has pixels
//   9  the WATER FIELD is asked for: a surfaced animal near the eye sets
//      WATER.field.ask and app.js honours it for half a second, so a
//      LANDPLANE low over a pod gets the wake and the splash too
//   8  THE PLUME is the village chimney's own recipe, to the digit
//      (src/viewer/plume.js vs tools/_house_gen.js) — a generalisation that
//      moved the village's smoke would be a regression, not a feature
//
// Usage: node tools/_animal_check.js       (prints GATE ANIMALS: PASS|FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;
const ROOT = path.join(TOOLS, '..');
const fail = [];
const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- 1: the table, read out of the python source ---------------------------
const py = fs.readFileSync(path.join(TOOLS, 'animals_table.py'), 'utf8');
const rows = [];
for (const m of py.matchAll(/dict\(key='([a-z]+)', label='([^']+)', kind='([a-z]+)',/g))
  rows.push({ key: m[1], label: m[2], kind: m[3] });
for (const r of rows) {
  const blk = py.slice(py.indexOf("key='" + r.key + "'"));
  const L = /length=([0-9.]+)/.exec(blk), A = /axis='([xyz])'/.exec(blk), F = /forward=\[(-?\d+), (-?\d+)\]/.exec(blk);
  r.length = L ? +L[1] : null;
  r.axis = A ? A[1] : 'z';
  r.forward = F ? [+F[1], +F[2]] : null;
  const SP = /spread=([0-9.]+)/.exec(blk);
  r.spread = SP ? +SP[1] : 0;
}
check(rows.length >= 5, 'table: fewer than five rows read from animals_table.py', String(rows.length));
const SHEET = (() => {
  const m = /^SHEET = \{([\s\S]*?)^\}/m.exec(py);
  const out = {};
  if (m) for (const line of m[1].split('\n')) {
    const r = /'(\w+)':\s*\[(.*?)\],?\s*(#.*)?$/.exec(line);
    if (r) out[r[1]] = r[2].trim() ? JSON.parse('[' + r[2] + ']') : [];
  }
  return out;
})();
check(Object.keys(SHEET).length === 3, 'table: the SHEET must name all three kinds', Object.keys(SHEET).join(','));

// ---- the payload -----------------------------------------------------------
const CORE = require(path.join(TOOLS, 'flight_core.js'));
const SRC = path.join(ROOT, 'src', 'animals');
const REG = { animals: {}, order: [] };
const PACK = { props: {}, order: [], texs: {}, groups: [] };
if (check(fs.existsSync(path.join(SRC, 'animals_index.json')), 'payload: no src/animals/animals_index.json (run python tools/animal_prep.py)')) {
  const sb = { registerAnimal: a => { REG.animals[a.key] = a; REG.order.push(a.key); },
               registerPropPack: p => { Object.assign(PACK.props, p.props); PACK.order.push(...p.order); Object.assign(PACK.texs, p.texs); PACK.groups.push(...p.groups); },
               console, FLYDIY_ASSET_BASE: '' };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(path.join(SRC, 'animals_index.json'), 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sb, { filename: f });
  const pf = path.join(SRC, 'animals_packs.json');
  if (fs.existsSync(pf)) for (const f of JSON.parse(fs.readFileSync(pf, 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sb, { filename: f });
}
check(REG.order.join(',') === rows.map(r => r.key).join(','),
  '1 the shipped manifests are the table, in the table order', REG.order.join(',') + ' vs ' + rows.map(r => r.key).join(','));
for (const r of rows) {
  const a = REG.animals[r.key];
  if (!check(!!a, '1 no manifest for the declared row ' + r.key)) continue;
  check(a.label === r.label, '1 ' + r.key + ': the label is not the table\'s', a.label + ' vs ' + r.label);
  check(a.kind === r.kind, '1 ' + r.key + ': the kind is not the table\'s', a.kind + ' vs ' + r.kind);
  check(a.length === r.length, '1 ' + r.key + ': the declared length is not the table\'s', a.length + ' vs ' + r.length);
  check(!!a.credit && a.credit.length > 20, '1 ' + r.key + ': no credit line in the manifest');
  check(a.spread === r.spread, '1 ' + r.key + ': the declared `spread` is not in the manifest', a.spread + ' vs ' + r.spread);
  check(String(a.forward) === String(r.forward), '1 ' + r.key + ': `forward` is not the table\'s', a.forward + ' vs ' + r.forward);
}

// ---- 2: every skin decodes, and measures its declared length ---------------
const bytes = rel => fs.readFileSync(path.join(ROOT, rel));
const DEC = {}, CLIPS = {};
for (const key of REG.order) {
  const a = REG.animals[key];
  let dec = null, clips = null;
  try {
    const b = bytes(a.bin);
    dec = CORE.decodeAnimal(a, new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
    const cb = bytes(a.clipBin);
    clips = CORE.decodeAnimalClips(a, new Uint8Array(cb.buffer, cb.byteOffset, cb.byteLength));
  } catch (e) { check(false, '2 ' + key + ': the payload does not decode', e.message); continue; }
  DEC[key] = dec; CLIPS[key] = clips;
  // the tree closes: every parent is a node, every root is in `scene`
  let treeOk = true;
  a.nodes.forEach((n, i) => { if (n.p >= a.nodes.length || n.p === i) treeOk = false; });
  check(treeOk, '2 ' + key + ': the node tree does not close');
  check(a.joints.every(j => j >= 0 && j < a.nodes.length), '2 ' + key + ': a joint is not a node');
  let badW = 0, badJ = 0;
  for (const m of dec.meshes) {
    if (!m.skin) continue;
    for (let i = 0; i < m.nv; i++) {
      let s = 0;
      for (let k = 0; k < 4; k++) { s += m.wt[i * 4 + k]; if (m.jt[i * 4 + k] >= a.joints.length) badJ++; }
      if (Math.abs(s - 1) > 1e-3) badW++;
    }
  }
  check(badJ === 0, '2 ' + key + ': ' + badJ + ' skin indices past the joint list');
  check(badW === 0, '2 ' + key + ': ' + badW + ' vertices whose weights do not sum to 1');
  // the rest mesh, measured through the tool that poses it
  const AX = { x: 0, y: 1, z: 2 }[a.axis];
  const span = a.dim[AX];
  check(near(span, a.length, a.length * 0.01),
    '2 ' + key + ': the rest mesh is ' + span.toFixed(3) + ' m along ' + a.axis + ', not the declared ' + a.length);
  check(a.kind !== 'land' || Math.abs(a.bb[1]) < 0.05,
    '2 ' + key + ': a land animal stands ON the ground (bb.y0 = ' + a.bb[1] + ')');
  check(!!a.pivot && a.pivot.length === 3, '2 ' + key + ': no pivot');
}

// ---- 3: the clips ----------------------------------------------------------
const SPEED_OK = { walk: [0.2, 3.0], trot: [1.5, 12] };
for (const key of REG.order) {
  const a = REG.animals[key], clips = CLIPS[key];
  if (!clips) continue;
  check(a.clips.length > 0, '3 ' + key + ': no clip at all');
  const roles = new Set(a.clips.map(c => c.role));
  check(a.kind !== 'land' || (roles.has('idle') && roles.has('walk')), '3 ' + key + ': a land animal needs idle and walk');
  check(a.kind !== 'sea' || roles.has('swim'), '3 ' + key + ': a sea animal needs swim');
  check(a.kind !== 'air' || roles.has('flap'), '3 ' + key + ': a bird needs flap');
  for (const c of a.clips) {
    const v = clips[c.key];
    if (!check(!!v, '3 ' + key + ': clip ' + c.key + ' does not decode')) continue;
    check(c.frames >= 2 && near(c.dur, (c.frames - 1) / c.fps, 1e-3), '3 ' + key + '/' + c.key + ': the grid is not uniform');
    const all = c.nt.concat(c.nr, c.ns);
    check(all.every(n => n >= 0 && n < a.nodes.length), '3 ' + key + '/' + c.key + ': a channel names no node');
    check(v.data.length === c.frames * v.stride, '3 ' + key + '/' + c.key + ': the slab is not frames x stride');
    let nan = 0;
    for (let i = 0; i < v.data.length; i++) if (!Number.isFinite(v.data[i])) nan++;
    check(nan === 0, '3 ' + key + '/' + c.key + ': ' + nan + ' non-finite numbers in the slab');
    // a rotation channel is a unit quaternion, every frame
    let bad = 0;
    for (let f = 0; f < c.frames; f++) {
      let o = f * v.stride + 3 * c.nt.length;
      for (let j = 0; j < c.nr.length; j++, o += 4) {
        const n2 = Math.hypot(v.data[o], v.data[o + 1], v.data[o + 2], v.data[o + 3]);
        if (Math.abs(n2 - 1) > 2e-3) bad++;
      }
    }
    check(bad === 0, '3 ' + key + '/' + c.key + ': ' + bad + ' rotations are not unit quaternions');
    const lim = SPEED_OK[c.role];
    if (lim && c.speed) check(c.speed >= lim[0] && c.speed <= lim[1],
      '3 ' + key + '/' + c.key + ': ' + c.speed.toFixed(2) + ' m/s is not a ' + c.role + ' (' + lim.join('..') + ')');
    if (c.dir && (c.role === 'walk' || c.role === 'trot')) {
      const dot = c.dir[0] * a.forward[0] + c.dir[1] * a.forward[1];
      check(dot > 0.96, '3 ' + key + '/' + c.key + ': it travels ' + JSON.stringify(c.dir) + ', the animal faces ' + JSON.stringify(a.forward));
    }
  }
}

// ---- 4: the ladder ---------------------------------------------------------
const levelsOf = key => PACK.order.map(k => PACK.props[k]).filter(p => p.lodOf === key).sort((x, y) => x.lodDist - y.lodDist);
for (const key of REG.order) {
  const a = REG.animals[key];
  const want = (SHEET[a.kind] || []).length;
  const got = levelsOf(key);
  check(got.length <= want, '4 ' + key + ': ' + got.length + ' levels for a sheet of ' + want);
  const maps = new Set();
  for (const m of a.mats) for (const f of ['map', 'arm', 'nor', 'emisMap']) if (m[f]) maps.add(m[f]);
  let prev = a.nt, prevD = 0;
  const AX = { x: 0, y: 1, z: 2 }[a.axis];
  for (const l of got) {
    check(l.nt < prev, '4 ' + l.key + ': ' + l.nt + ' triangles is not under ' + prev);
    check(l.lodDist > prevD, '4 ' + l.key + ': stands in from ' + l.lodDist + ' m, not past ' + prevD);
    check(l.place === 'mount', '4 ' + l.key + ': a level must keep the animal\'s own origin (place=mount)');
    check(String(l.pivot) === String(a.pivot), '4 ' + l.key + ': its pivot is not the animal\'s');
    const lm = new Set();
    for (const m of l.mats) for (const f of ['map', 'arm', 'nor', 'emisMap']) if (m[f]) lm.add(m[f]);
    check([...lm].every(t => maps.has(t)), '4 ' + l.key + ': wears a map the animal does not');
    check(lm.size === maps.size, '4 ' + l.key + ': wears ' + lm.size + ' maps, the animal ' + maps.size);
    // A SIMILAR VOLUME, asserted: the level is posed, the animal measured at
    // rest, so the limbs may be anywhere - but the LENGTH is the animal's
    check(near(l.dim[AX], a.dim[AX], a.dim[AX] * 0.04),
      '4 ' + l.key + ': ' + l.dim[AX].toFixed(2) + ' m long, the animal ' + a.dim[AX].toFixed(2));
    check(l.srcNt === a.nt, '4 ' + l.key + ': srcNt ' + l.srcNt + ', the animal has ' + a.nt);
    prev = l.nt; prevD = l.lodDist;
  }
}

// ---- 5: the media is on disk ----------------------------------------------
let missing = 0;
for (const key of REG.order) {
  const a = REG.animals[key];
  for (const rel of [a.bin, a.clipBin].concat(Object.values(a.texs)))
    if (!fs.existsSync(path.join(ROOT, rel))) { missing++; fail.push('5 missing media: ' + rel); }
}
for (const k of PACK.order) if (!fs.existsSync(path.join(ROOT, PACK.props[k].bin))) { missing++; fail.push('5 missing media: ' + PACK.props[k].bin); }
check(missing === 0, '5 every media file the payload names is on disk', String(missing));

// ---- 9: the app honours the animals' ask for the water field --------------
{
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  check(/WATER\.field\.ask && performance\.now\(\) - WATER\.field\.ask < 500/.test(app),
    '9 app.js honours WATER.field.ask (with an expiry), so a landplane low over a pod gets the wake');
  check(/sim\.hydro \|\| WATER\.field\.force \|\| wAsk/.test(app),
    '9 the ask is one of the three ways the interaction field turns on');
  check(/const wAsk = window\.WATER &&/.test(app),
    '9 the ask is read off window.WATER - a bare WATER throws where the water layer is absent');
  const rp = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  check(/wantWater: \(\) => \{ if \(window\.WATER && WATER\.field\) WATER\.field\.ask = performance\.now\(\); \}/.test(rp),
    '9 the premises host is what sets the ask');
}

// ---- 10: the hotspots are on the MAP --------------------------------------
{
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const dm = app.slice(app.indexOf('function drawMap('), app.indexOf('function drawMap(') + 12000);
  check(/OVm\.records && OVm\.records\.animals/.test(dm),
    '10 drawMap reads the hotspots of the COMPOSED record, not the live individuals');
  check(/for \(const h of HOT\)/.test(dm) && /Fm\.toWorld\(h\.x, h\.z\)/.test(dm),
    '10 each hotspot is put on the map through the premises frame');
  check(/kind === 'sea'/.test(dm) && /kind === 'air'/.test(dm),
    '10 the shape of a mark says where that animal lives');
  check(/if \(rr > 5 \* mk\)/.test(dm), '10 the radius of a hotspot is drawn once it is worth pixels');
  check(/if \(mapBig\) labPut\(sx, sy, \(h\.n \|\| 1\) \+ ' ' \+ \(a \? a\.label : h\.key\)/.test(dm),
    '10 the species and the count are labelled once the map is big');
  // ONE ledger for every label on the map: Jolene crowds four aerodromes and eight hotspots into
  // a few hundred pixels, and a name written half over another name is worse than no name
  check(/const LAB = \[\];/.test(dm) && /const labFits = /.test(dm) && /const labPut = /.test(dm),
    '10 the map has ONE label ledger');
  check(/labPut\(sx, sy, a\.name,/.test(dm),
    '10 the aerodrome names go through it too, so an animal never writes over one');
  check(/for \(const \[x, y\] of spots\)/.test(dm) && /return false;/.test(dm),
    '10 a label that fits nowhere is DROPPED rather than overlapped');
}

// ---- 8: the plume is the chimney's recipe ---------------------------------
{
  const hg = fs.readFileSync(path.join(TOOLS, '_house_gen.js'), 'utf8');
  const pl = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'plume.js'), 'utf8');
  const R0 = /SMOKE_R0 = ([0-9.]+), SMOKE_R1 = ([0-9.]+)/.exec(hg);
  const rec = /R0: ([0-9.]+), R1: ([0-9.]+)/.exec(pl);
  check(!!R0 && !!rec && R0[1] === rec[1] && R0[2] === rec[2],
    '8 the plume\'s R0/R1 are the chimney\'s', R0 && rec ? R0.slice(1) + ' vs ' + rec.slice(1) : 'not found');
  check(/color: 0xb9b5ae/.test(hg) && /colour: 0xb9b5ae/.test(pl), '8 the plume\'s colour is the chimney\'s');
  for (const law of ['(0.85 + 0.25 * n) * uSmokeLit', 'sNoise(q) * 0.6 + sNoise(q * 2.3 + 7.0) * 0.4'])
    check(hg.indexOf(law) >= 0 && pl.indexOf(law) >= 0, '8 both emitters carry the law `' + law + '`');
  check(/uTime \* 0\.35/.test(hg) && /uTime \* 0\.35/.test(pl), '8 both scroll the noise at 0.35');
}

// ---- 6 and 7 need three.js and the viewer layer ---------------------------
function viewerContext() {
  const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  const g = {};
  for (const k of Object.keys(CORE)) g[k] = CORE[k];
  g.THREE = THREE;
  g.console = console;
  g.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
  g.Image = function () { return { addEventListener() {}, set src(v) {}, complete: false }; };
  g.FLYDIY_ASSET_BASE = '';
  const ctx = vm.createContext(g);
  vm.runInContext('var window = globalThis; window.window = window;', ctx);
  // ASSET_FETCH off the disk: the same bytes the page would fetch
  g.ASSET_FETCH = rel => Promise.resolve(new Uint8Array(fs.readFileSync(path.join(ROOT, rel))));
  // props.js FIRST: the animals land on the prop library's one material factory
  for (const f of ['props.js', 'plume.js', 'animals.js', 'animal_run.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8'), ctx, { filename: f });
  // the payload, into this context's own registries
  for (const f of JSON.parse(fs.readFileSync(path.join(SRC, 'animals_index.json'), 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  for (const f of JSON.parse(fs.readFileSync(path.join(SRC, 'animals_packs.json'), 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  return { ctx, g, THREE };
}

// a synthetic island: a hill on land, the sea below y = 0
const GROUND = (x, z) => Math.max(0.5, 30 + 8 * Math.sin(x / 140) + 6 * Math.cos(z / 190) - Math.hypot(x, z) / 90);
const WATERY = (x, z) => 0;

async function behaviours() {
  const { g, THREE } = viewerContext();
  const AN = g.ANIMALS, AR = g.ANIMAL_RUN;
  if (!check(!!AN && !!AR, '6 the viewer layer did not load')) return;
  await Promise.all(REG.order.map(k => AN.warm(k)));
  const scene = new THREE.Group();
  const stamps = [], sprays = [];
  let asks = 0;
  const eye = { x: 0, y: 200, z: 0 };
  const R = AR.make(THREE, {
    scene, ground: GROUND, waterH: WATERY, eye: () => eye,
    stamp: (...a) => { stamps.push(a); return true; },
    spray: (...a) => { sprays.push(a); },
    wantWater: () => { asks++; },
    lit: () => 1, wind: () => [3, 0],
  });
  const land = REG.order.filter(k => REG.animals[k].kind === 'land');
  const sea = REG.order.filter(k => REG.animals[k].kind === 'sea');
  const air = REG.order.filter(k => REG.animals[k].kind === 'air');
  const spots = [];
  land.forEach((k, i) => spots.push({ id: 'h' + i, key: k, x: 60 + i * 200, z: 0, n: 3, r: 80 }));
  // the pod's radius is deliberately SMALL here (the circuit is `r`, and the eye
  // parks at the centre): an animal must come within 150 m of it for rule 9
  sea.forEach((k, i) => spots.push({ id: 's' + i, key: k, x: -1500 - i * 300, z: 900, n: 2, r: 90 }));
  air.forEach((k, i) => spots.push({ id: 'f' + i, key: k, x: 0, z: -300, n: 5, r: 150, dy: 60 }));
  R.sync(spots);
  check(R.stats.animals === spots.reduce((s, q) => s + q.n, 0), '6 the herds are the hotspots\' own counts', R.stats.animals + ' of ' + spots.reduce((s, q) => s + q.n, 0));
  // the eye follows the sea hotspot for a while, so the pod is stepped too
  const states = new Set(), clips = new Set();
  let minDepth = 1e9, maxDepth = -1e9, nan = 0, under = 0, outside = 0, wet = 0;
  for (let i = 0; i < 3600; i++) {
    eye.x = i < 1800 ? 60 : -1500;
    eye.z = i < 1800 ? 0 : 900;
    R.tick(1 / 30);
    for (const o of R.list()) {
      if (!Number.isFinite(o.x) || !Number.isFinite(o.y) || !Number.isFinite(o.z) || !Number.isFinite(o.hd)) nan++;
      if (!o.shown) continue;
      if (o.clip) clips.add(o.key + '/' + o.clip);
      if (o.kind === 'land') {
        states.add(o.key + '/' + o.state);
        if (o.y < GROUND(o.x, o.z) - 0.6) under++;
        if (GROUND(o.x, o.z) <= WATERY(o.x, o.z) + 0.2) wet++;
        const sp = spots.find(q => q.id === o.id);
        if (sp && Math.hypot(o.x - sp.x, o.z - sp.z) > sp.r * 1.4) outside++;
      }
      if (o.kind === 'sea') { minDepth = Math.min(minDepth, o.depth); maxDepth = Math.max(maxDepth, o.depth); }
    }
  }
  check(nan === 0, '6 nothing goes non-finite over 3600 steps', String(nan));
  check(under === 0, '6 no land animal sinks under the terrain', String(under));
  check(wet === 0, '6 no land animal walks into the water', String(wet));
  check(outside === 0, '6 no land animal leaves its hotspot', String(outside));
  for (const k of land) {
    const mine = [...states].filter(s => s.startsWith(k + '/')).map(s => s.split('/')[1]);
    check(mine.indexOf('idle') >= 0 && mine.indexOf('walk') >= 0,
      '6 ' + k + ': the clip machine reached idle and walk', mine.join(','));
  }
  for (const k of sea) {
    const S = REG.animals[k].sea;
    check(minDepth < S.float + 0.5, '6 ' + k + ': the pod never comes up (min depth ' + minDepth.toFixed(2) + ')');
    check(maxDepth > S.depth * 0.8, '6 ' + k + ': the pod never goes down (max depth ' + maxDepth.toFixed(2) + ')');
  }
  // a herd of animals all one size is a tell, and a POD is not meant to be uniform at all
  for (const k of land.concat(sea)) {
    const sp = REG.animals[k].spread;
    if (!sp) continue;
    const sz = R.list().filter(o => o.key === k).map(o => o.size);
    check(new Set(sz).size > 1, '6 ' + k + ': every individual is the same size (spread ' + sp + ')', sz.join(','));
    check(sz.every(v => Math.abs(v - 1) <= sp + 1e-6), '6 ' + k + ': an individual is outside the declared spread', sz.join(','));
  }
  check(stamps.length > 0, '6 a surfacing pod stamps the water field');
  check(stamps.some(s => s[5] === 'press') && stamps.some(s => s[5] === 'ring'), '6 the pod presses the surface and rings it when it breaks out',
    [...new Set(stamps.map(s => s[5]))].join(','));
  check(sprays.length > 0, '6 breaking the surface throws spray');
  check(asks > 0, '6 a surfaced animal near the eye ASKS for the water field');
  for (const k of air) check([...clips].some(c => c.startsWith(k + '/flap')), '6 ' + k + ': the flock flaps');
  // THE AMBIENT FLOCKS: born outside the ring, crossing, retired past it
  R.ambient(2, air[0]);
  for (let i = 0; i < 400; i++) { eye.x += 0.6; R.tick(1 / 30); }
  const amb = R.list().filter(o => o.id === 'ambient');
  check(amb.length > 0, '6 the ambient flocks are alive');
  check(amb.every(o => Number.isFinite(o.x) && o.y > GROUND(o.x, o.z)), '6 an ambient bird is above the ground');
  R.dispose();
}

// ---- 7: the record ---------------------------------------------------------
function record() {
  const PG = CORE.PREMISES_GEN;
  const rec = PG.DEF();
  rec.frame.extent = { x0: -200, z0: -200, x1: 200, z1: 200 };
  rec.layers.objects.push({ id: 'a1', kind: 'animal', key: 'elk', x: 40, z: -20, yaw: 0.3, n: 5, r: 90, dy: 0 });
  rec.layers.objects.push({ id: 'a2', kind: 'animal', key: 'whale', x: -8600, z: 2400, yaw: 0, n: 1, r: 450, dy: 0 });
  const world = { id: 'test', terrainH: GROUND, waterH: WATERY, bounds: { x0: -12000, z0: -12000, x1: 12000, z1: 12000 }, SURFACE: PG.SURFACE };
  const iss = PG.issues(rec);
  check(iss.length === 0, '7 a well-formed animal record raises no issue', iss[0]);
  let O = null;
  try { O = PG.compose(rec, world, { catalogue: { entries: new Map(), keys: () => [], byTag: () => [], byCat: () => [] } }); }
  catch (e) { check(false, '7 the record composes', e.message); }
  if (O) {
    check(!!O.records.animals && O.records.animals.length === 2, '7 both hotspots compose', O.records.animals ? String(O.records.animals.length) : 'none');
    const far = O.records.animals.find(q => q.id === 'a2');
    check(!!far && Number.isFinite(far.y), '7 a hotspot 8 km outside the extent still composes');
    const one = O.records.animals[0];
    check(one.n === 5 && one.r === 90, '7 the count and the radius ride through compose');
  }
  const bad = PG.normalise(JSON.parse(JSON.stringify(rec)));
  bad.layers.objects[0].key = '';
  check(PG.issues(bad).some(s => /animal a1: no species/.test(s)), '7 an animal with no species is refused');
  const bad2 = PG.normalise(JSON.parse(JSON.stringify(rec)));
  bad2.layers.objects[0].n = 99;
  check(PG.issues(bad2).some(s => /animal a1: 99/.test(s)), '7 a herd of ninety-nine is refused');
  // the round trip
  const txt = PG.envelope('test', rec, null, null);
  const back = PG.unwrap(txt);
  const got = back.rec.layers.objects.filter(o => o.kind === 'animal');
  check(got.length === 2 && got[0].n === 5 && got[0].key === 'elk', '7 the hotspots survive save and load');
  // the fixture the island actually ships
  const fx = path.join(TOOLS, 'fixtures', 'island_jolene.json');
  if (fs.existsSync(fx)) {
    const J = JSON.parse(fs.readFileSync(fx, 'utf8'));
    const A = (J.layers.objects || []).filter(o => o.kind === 'animal');
    check(A.length >= 4, '7 Jolene carries its hotspots', String(A.length));
    check(A.every(o => REG.animals[o.key]), '7 every Jolene hotspot names a baked species',
      A.filter(o => !REG.animals[o.key]).map(o => o.key).join(','));
    check(A.some(o => REG.animals[o.key] && REG.animals[o.key].kind === 'sea'), '7 Jolene has something in the water');
  }
}

(async () => {
  record();
  try { await behaviours(); } catch (e) { check(false, '6 the behaviours threw', e && (e.stack || e.message)); }
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('  ' + REG.order.length + ' animals, ' + PACK.order.length + ' levels, ' +
    REG.order.reduce((s, k) => s + REG.animals[k].clips.length, 0) + ' clips, ' +
    REG.order.reduce((s, k) => s + REG.animals[k].nt, 0).toLocaleString() + ' base triangles');
  // the verdict line is EXACTLY what run_gates.js matches (^GATE ID: PASS$)
  console.log('GATE ANIMALS: ' + (fail.length ? 'FAIL' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
})();
