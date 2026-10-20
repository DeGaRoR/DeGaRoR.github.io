#!/usr/bin/env node
// GATE CITYCOOK (CITY-A, G3400-G3414; futureDesigns/CITY-PACK-FORMAT.md §11) - the cooked town (tools/city_cook.js)
// against a fresh cook, the record, the kit and the town-OFF variant.
//
//   1  THE MANIFEST: src/core/city_packs.json names Metlakatla, v 1, every cell's file on disk; every MEANS map is a
//      shipped file (a re-shot texture is a stale mean).
//   2  DETERMINISM: two cooks in one process give the same raw cells, byte for byte, and the same hash.
//   3  FRESH: the committed manifest and cells equal a fresh cook (a red here is a STALE pack - the fixture, the places
//      cook, the kit or the cook moved: `node tools/city_cook.js --island jolene`, then commit media/city + the manifest).
//   4  COVERAGE: every plot of the town record (its prefix's zones, less the town-OFF record) is in exactly one cell, the
//      cell of its anchor; every town item and object in exactly one cell; nothing of the town-OFF record in the pack.
//   5  THE DRAWS: per cell 4 buckets in order, at most 2 draws, the shell at most 16 triangles a kit row and 10 a box,
//      every index in range, every vertex in the cell's box.
//   6  THE IDS: the kit section decodes through townkit.js's own decodeInstances (WORLD frame, the committed pack's sha);
//      every archetype id below the pack's count; a house row a house archetype, an outbuilding row an outbuilding one;
//      a row's finish of its archetype's roof kind; the plots name their rows; every prop key and owner in range.
//   7  TOWN_OFF INTACT: PREMISES_GEN.TOWN_OFF as the 'default' variant records it; the 'default' places re-hash to their
//      manifest hash from their own files; the cook leaves premises_packs.json and townkit_pack.json byte-identical.
//   8  NEGATIVE CONTROLS: a plot moved to another cell, a plot dropped, an archetype id past the pack and a third draw
//      are each caught by 4-6's own checks.
//
//   node tools/_citycook_check.js   -> "GATE CITYCOOK: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const CC = require('./city_cook.js');
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; return !!c; };
const done = () => { console.log('GATE CITYCOOK: ' + (fails ? 'FAIL' : 'PASS')); process.exit(fails ? 1 : 0); };
console.log('GATE CITYCOOK');
const T = CC.TOWNS[0];
const rd = f => fs.readFileSync(path.join(ROOT, ...f.split('/')));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const snap = () => [CC.OUT, path.join(ROOT, 'src', 'core', 'premises_packs.json'), path.join(ROOT, 'src', 'core', 'townkit_pack.json')].map(f => (fs.existsSync(f) ? sha(fs.readFileSync(f)) : null));
const before = snap();

// ---- 1. the manifest ---------------------------------------------------------------------------------------------
console.log('1. the manifest');
const MAN = fs.existsSync(CC.OUT) ? JSON.parse(fs.readFileSync(CC.OUT, 'utf8')) : null;
const MT = MAN && (MAN.towns || []).find(t => t.id === T.id && t.island === T.island);
if (!ok(!!MT && MAN.v === CC.V, 'src/core/city_packs.json names ' + T.island + '/' + T.id + ', v ' + (MAN && MAN.v) + ' (tools/city_cook.js --island ' + T.island + ')')) done();
ok(MT.cell === CC.S && MT.frame === 'world' && JSON.stringify(MT.lod) === JSON.stringify(CC.LOD), 'the grid (' + MT.cell + ' m, world) and the LOD distances are the format\'s');
ok(MT.cells.every(c => fs.existsSync(path.join(ROOT, ...c.src.split('/')))), MT.cells.length + ' cell files named, all on disk');
const staleMeans = Object.keys(CC.MEANS).filter(k => !fs.existsSync(path.join(ROOT, CC.meanFile(k))));
ok(!staleMeans.length, 'every MEANS map is a shipped file (' + Object.keys(CC.MEANS).length + ' maps' + (staleMeans.length ? '; missing ' + staleMeans.slice(0, 4).join(' ') : '') + ')');
const shipped = MT.cells.map(c => ({ m: c, raw: zlib.gunzipSync(rd(c.src)) }));

// ---- 2. determinism ----------------------------------------------------------------------------------------------
console.log('2. determinism');
const t0 = Date.now();
const R1 = CC.cookTown(T), t1 = Date.now(), R2 = CC.cookTown(T);
console.log('     cooked twice: ' + ((t1 - t0) / 1000).toFixed(1) + ' s (with the compose) + ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s');
ok(R1.hash === R2.hash && R1.cells.length === R2.cells.length && R1.cells.every((c, n) => c.key === R2.cells[n].key && c.raw.equals(R2.cells[n].raw)),
  'two cooks, the same ' + R1.cells.length + ' cells byte for byte (hash ' + R1.hash + ' / ' + R2.hash + ')');
ok(R1.cells.every(c => zlib.gzipSync(c.raw, { level: 9, mtime: 0 }).equals(zlib.gzipSync(c.raw, { level: 9, mtime: 0 }))), 'the gzip is a function of the raw bytes (level 9, mtime 0)');

// ---- 3. fresh ----------------------------------------------------------------------------------------------------
console.log('3. the pack is fresh');
ok(R1.hash === MT.hash, 'the hash as committed (' + R1.hash + ' / ' + MT.hash + ')');
let badC = 0;
for (const c of R1.cells) { const s = shipped.find(x => x.m.c[0] === c.i && x.m.c[1] === c.j); if (!s || !s.raw.equals(c.raw)) badC++; }
ok(badC === 0 && R1.cells.length === MT.cells.length, 'every cell as committed, byte for byte (' + R1.cells.length + ' cells, ' + badC + ' differ)');
for (const c of R1.cells) { const s = shipped.find(x => x.m.c[0] === c.i && x.m.c[1] === c.j); c.gz = s ? rd(s.m.src) : Buffer.alloc(0); }
const fresh = CC.manifestTown(R1, c => { const s = MT.cells.find(x => x.c[0] === c.i && x.c[1] === c.j); return s ? s.src : null; });
ok(JSON.stringify(fresh) === JSON.stringify(MT), 'the manifest entry as committed (inputs ' + Object.entries(R1.inputs).map(([k, v]) => k + ' ' + String(v).slice(0, 8)).join(', ') + ')');

// ---- the decoded pack (what 4-6 check, and 8 corrupts) -----------------------------------------------------------
const TK = require(path.join(ROOT, 'src', 'viewer', 'townkit.js'));
const K = CC.kitOf();
function decodeAll(raws) {
  return raws.map(raw => { const C = CC.decodeCell(raw); return Object.assign(C, { rows: TK.decodeInstances(C.kit), props: CC.decodeProps(C.props) }); });
}
const D = decodeAll(shipped.map(s => s.raw));
const PL = CC.placesOf(T.island, T.variant), BASE = CC.placesOf(T.island, T.base);
const baseIds = new Set(BASE.things.map(t => String(t.id)));
const C0 = CC.composedOf(T), pre = new RegExp('^' + T.prefix);
const recPlots = C0.O.records.plots.filter(p => pre.test(String(p.zone)) && !baseIds.has(String(p.id))).map(p => String(p.id)).sort();
const townThings = PL.things.filter(t => !baseIds.has(String(t.id)));
const anchorOf = new Map(townThings.map(t => [String(t.id), t.at ? [t.at[0], t.at[2]] : null]));

function coverage(D, say) {
  let bad = 0;
  const seen = new Map(), wrong = [];
  for (const C of D) for (const p of C.head.plots) {
    seen.set(p[0], (seen.get(p[0]) || 0) + 1);
    const a = anchorOf.get(p[0]); if (a) { const [i, j] = CC.cellOf(a[0], a[1]); if (i !== C.head.cell[0] || j !== C.head.cell[1]) wrong.push(p[0]); }
  }
  const missing = recPlots.filter(id => seen.get(id) !== 1), extra = Array.from(seen.keys()).filter(id => recPlots.indexOf(id) < 0);
  if (!say(!missing.length && !extra.length, 'every plot of the record in exactly one cell (' + recPlots.length + ' plots; ' + missing.length + ' missing or twice, ' + extra.length + ' not the record\'s' + (missing.length ? ': ' + missing.slice(0, 3).join(' ') : '') + ')')) bad++;
  if (!say(!wrong.length, 'each plot in the cell of its anchor (' + wrong.length + ' elsewhere)')) bad++;
  const ids = k => { const m = new Map(); for (const C of D) for (const u of C.head[k]) m.set(u[0], (m.get(u[0]) || 0) + 1); return m; };
  const U = ids('uniques'), O = ids('objects');
  const wantU = townThings.filter(t => t.kind === 'item').map(t => String(t.id)), wantO = townThings.filter(t => t.kind === 'object').map(t => String(t.id));
  if (!say(wantU.every(id => U.get(id) === 1) && U.size === wantU.length && wantO.every(id => O.get(id) === 1) && O.size === wantO.length,
    'every town item (' + wantU.length + ', the uniques) and object (' + wantO.length + ', props) in exactly one cell')) bad++;
  const leak = [];
  for (const C of D) for (const id of C.head.plots.map(p => p[0]).concat(C.head.uniques.map(u => u[0]), C.head.objects.map(o => o[0]))) if (baseIds.has(id)) leak.push(id);
  if (!say(!leak.length, 'nothing of the town-OFF record in the pack (' + baseIds.size + ' default things; ' + leak.length + ' leaked' + (leak.length ? ': ' + leak.slice(0, 3).join(' ') : '') + ')')) bad++;
  return bad;
}
function draws(D, say) {
  let bad = 0, worst = 0, maxD = 0;
  const errs = [];
  for (const C of D) {
    const H = C.head, F = H.far, key = H.cell.join(',');
    if (F.buckets.length !== 4 || F.buckets.some((b, n) => b.id !== n || b.name !== CC.BUCKETS[n])) errs.push(key + ': the buckets');
    let at = 0; for (const b of F.buckets) { if (b.first !== at) errs.push(key + ': bucket ' + b.name + ' not contiguous'); at += b.count; }
    if (at !== F.tris * 3) errs.push(key + ': the buckets do not cover the index');
    if (F.draws.length > 2) errs.push(key + ': ' + F.draws.length + ' draws');
    maxD = Math.max(maxD, F.draws.length);
    const shell = (F.buckets[0].count + F.buckets[1].count) / 3, boxes = H.uniques.length + H.plots.filter(p => p[4] & 2).length;
    const cap = 16 * H.kit.rows + 10 * (boxes + H.uniques.length);
    if (shell > cap) errs.push(key + ': shell ' + shell + ' tris > ' + cap);
    worst = Math.max(worst, F.tris);
    const wide = F.index === 32, n = F.tris * 3;
    for (let k = 0; k < n; k++) { const v = wide ? C.ib.readUInt32LE(k * 4) : C.ib.readUInt16LE(k * 2); if (v >= F.verts) { errs.push(key + ': index ' + v + ' past ' + F.verts); break; } }
    if (C.vb.length !== F.verts * CC.VSTRIDE) errs.push(key + ': the vertex buffer\'s length');
    for (let v = 0; v < F.verts; v++) if (C.vb[v * 12 + 11] > 3) { errs.push(key + ': a bucket id past 3'); break; }
    if (F.tris > 20000) errs.push(key + ': ' + F.tris + ' far triangles (ceiling 20 000)');
  }
  if (!say(!errs.length, 'per cell: 4 buckets in order, contiguous; at most 2 draws (max ' + maxD + ', town ' + D.reduce((a, C) => a + C.head.far.draws.length, 0) + ' far draws over ' + D.length + ' cells); the shell within 16 tris a kit row / 10 a box; indices in range; at most ' + worst + ' far tris a cell' + (errs.length ? ' - ' + errs.slice(0, 3).join('; ') : ''))) bad++;
  return bad;
}
function idsOk(D, say) {
  let bad = 0;
  const N = K.H.archetypes.length, errs = [];
  if (MT.archetypes !== N) errs.push('the manifest says ' + MT.archetypes + ' archetypes, the pack ' + N);
  let rows = 0, props = 0;
  for (const C of D) {
    const H = C.head, key = H.cell.join(','), R = C.rows;
    if (R.head.magic !== 'TKIN' || R.head.frame !== 'world' || R.head.pack !== K.man.pack.sha256) errs.push(key + ': the kit head');
    if (R.rows.length !== H.kit.rows || R.head.count !== H.kit.rows) errs.push(key + ': the kit row count');
    R.rows.forEach((r, n) => {
      rows++;
      if (!(r.arch < N)) { errs.push(key + ': row ' + n + ' archetype ' + r.arch + ' past ' + N); return; }
      const A = K.H.archetypes[r.arch], out = !!(r.flags & 1);
      if (out !== (A.split === 'out') || out !== r.out) errs.push(key + ': row ' + n + ' is ' + (out ? 'an outbuilding' : 'a house') + ' on archetype ' + r.arch + ' (' + A.split + ')');
      const fs0 = K.H.finishSets[r.finish];
      if (!fs0 || fs0.roofKind !== A.roofKind) errs.push(key + ': row ' + n + ' finish ' + r.finish + ' not of archetype ' + r.arch + '\'s roof kind');
    });
    H.plots.forEach(p => {
      for (const [k, o] of [[2, 0], [3, 1]]) if (p[k] >= 0) { const r = R.rows[p[k]]; if (!r || r.plot !== p[0] || r.out !== !!o || r.seed !== p[1]) errs.push(key + ': plot ' + p[0] + ' names row ' + p[k] + ' wrongly'); }
      if ((p[4] & 1) && p[2] < 0) errs.push(key + ': kit plot ' + p[0] + ' without a house row');
    });
    for (const q of C.props) {
      props++;
      if (!(q.key < MT.propKeys.length)) errs.push(key + ': a prop key ' + q.key);
      const lim = q.kind === 3 ? H.objects.length : q.kind === 4 ? H.uniques.length : H.plots.length;
      if (!(q.owner < lim)) errs.push(key + ': a prop owner ' + q.owner + ' (kind ' + q.kind + ')');
    }
  }
  if (!say(!errs.length, rows + ' kit rows through townkit.js decodeInstances (WORLD, pack ' + K.man.pack.sha256.slice(0, 12) + '): archetypes < ' + N + ', houses / outbuildings on their kind, finishes of the roof kind, the plots naming their rows; ' + props + ' props, keys and owners in range' + (errs.length ? ' - ' + errs.slice(0, 3).join('; ') : ''))) bad++;
  return bad;
}

// ---- 4-6 ---------------------------------------------------------------------------------------------------------
console.log('4. coverage');
ok(recPlots.length > 300, 'the town record has its plots (' + recPlots.length + ' in the ' + T.prefix + ' zones, less the town-OFF record)');
coverage(D, ok);
console.log('5. the draws');
draws(D, ok);
console.log('6. the ids');
idsOk(D, ok);
{
  // the box a vertex is quantized in holds the cell's geometry: decode one vertex per cell, inside the box
  let inBox = 0; for (const C of D) { const b = C.head.box; if (!C.head.far.verts) { inBox++; continue; } const x = b[0] + C.vb.readUInt16LE(0) / 65535 * (b[3] - b[0]); if (x >= b[0] && x <= b[3]) inBox++; }
  ok(inBox === D.length, 'every cell\'s far vertices decode inside its box');
}

// ---- 7. TOWN_OFF -------------------------------------------------------------------------------------------------
console.log('7. TOWN_OFF intact');
{
  const PP = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'premises_packs.json'), 'utf8')), I = PP.islands.find(w => w.id === T.island);
  const Vd = I.variants.find(v => v.name === T.base), TO = C0.TOWN_OFF;
  ok(!!TO && JSON.stringify(Array.from(TO.drop)) === JSON.stringify(Vd.drop) && JSON.stringify(Array.from(TO.keep)) === JSON.stringify(Vd.keep),
    'PREMISES_GEN.TOWN_OFF is the default variant\'s (drop ' + JSON.stringify(Vd.drop) + ', keep ' + JSON.stringify(Vd.keep) + ')');
  const h = crypto.createHash('sha256'), cells = I.places.variants[T.base].cells.map(c => ({ key: c.c === null ? '*' : c.c.join(','), buf: zlib.gunzipSync(rd(c.src)) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const c of cells) h.update(c.key + ':').update(c.buf);
  ok(h.digest('hex').slice(0, 16) === I.places.variants[T.base].hash, 'the default places re-hash to their manifest hash from their own ' + cells.length + ' files (' + I.places.variants[T.base].hash + ')');
  const keepHit = [];
  for (const C of D) for (const id of C.head.plots.map(p => p[0]).concat(C.head.uniques.map(u => u[0]))) if (TO.keep.some(k => id === k || id.startsWith(k + '/') || id.startsWith(k + ':'))) keepHit.push(id);
  ok(!keepHit.length, 'none of the kept seaplane base (' + TO.keep.join(', ') + ') is in the pack');
  const after = snap();
  ok(after[1] === before[1] && after[2] === before[2] && after[0] === before[0], 'the cooks left premises_packs.json, townkit_pack.json and city_packs.json byte-identical');
  ok(!/premises_packs|townkit_pack/.test(fs.readFileSync(path.join(ROOT, 'tools', 'city_cook.js'), 'utf8').split('\n').filter(l => /writeFileSync|writeMedia/.test(l)).join('\n')), 'the cook writes neither premises_packs.json nor townkit_pack.json (its writes: media/city, city_packs.json)');
}

// ---- 8. negative controls ----------------------------------------------------------------------------------------
console.log('8. negative controls');
{
  const quiet = () => true, catches = (f, D) => { let n = 0; f(D, (c) => { if (!c) n++; return c; }); return n > 0; };
  const clone = () => decodeAll(shipped.map(s => s.raw));
  const a = clone(); { const p = a[0].head.plots.pop(); a[1].head.plots.push(p); }
  const b = clone(); b[2].head.plots.shift();
  const c = clone(); { const C = c[0]; C.kit = Buffer.from(C.kit); const hl = C.kit.readUInt32LE(0), at = 8 + hl + ((4 - ((8 + hl) & 3)) & 3); C.kit[at + 14] = 99; C.rows = TK.decodeInstances(C.kit); }
  const d = clone(); d[0].head.far.draws.push({ mat: 'extra', first: 0, count: 0 });
  ok(catches(coverage, a) && catches(coverage, b) && catches(idsOk, c) && catches(draws, d) && !catches(coverage, clone()) && quiet(),
    'a plot moved, a plot dropped, an archetype id past the pack and a third draw are each caught; the pack as shipped is not');
}
done();
