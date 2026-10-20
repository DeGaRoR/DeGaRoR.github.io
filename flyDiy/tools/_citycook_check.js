#!/usr/bin/env node
// GATE CITYCOOK (CITY-A, G3400-G3414; futureDesigns/CITY-PACK-FORMAT.md §12) - the cooked town (tools/city_cook.js, v2)
// against a fresh cook, the record, the kit, the village's own fences and the town-OFF variant.
//
//   1  THE MANIFEST: src/core/city_packs.json names Metlakatla, v 2, every cell's file and the lot kit on disk; every MEANS
//      map is a shipped file (a re-shot texture is a stale mean).
//   2  DETERMINISM: two cooks in one process give the same raw cells and lot kit, byte for byte, and the same hash.
//   3  FRESH: the committed manifest, cells and lot kit equal a fresh cook (a red here is a STALE pack - the fixture, the
//      places cook, the kit, the generators or the cook moved: `node tools/city_cook.js --island jolene`, then commit
//      media/city + the manifest).
//   4  COVERAGE: every plot of the town record (its prefix's zones, less the town-OFF record) is in exactly one cell, the
//      cell of its anchor, as a row of the kit TABLE (none assigned by the cook: re-sow with `town_kit.js --table`); every
//      town item and object in exactly one cell; nothing of the town-OFF record in the pack.
//   5  THE DRAW: per cell the 2 buckets in order and ONE draw; the owners' ranges tile each bucket; the shell within 14
//      triangles a kit row and 10 a box; every index in range.
//   6  THE IDS: the kit section through townkit.js's own decodeInstances (WORLD, the committed pack's sha); archetypes below
//      the pack's count, a house row on a house archetype, an outbuilding row on an outbuilding one, a row's finish of its
//      archetype's roof kind; the plots name their rows; every prop key and owner in range; every lot row's piece in the
//      lot kit, its owner in the cell.
//   7  THE LOTS: every bay stands between two posts; each owner's fences (bays, old stretches, gates' gaps) cover its plan's
//      fenced length, clipped to the land as VILLAGE_GEN clips it; every fence row on its plan's own edge (5 cm); every
//      row's ground corners on the composed ground (2 cm); no ground piece past 8 m, none a lawn (half a plot or more).
//   8  TOWN_OFF INTACT: PREMISES_GEN.TOWN_OFF as the 'default' variant records it; the 'default' places re-hash to their
//      manifest hash from their own files; the cook leaves premises_packs.json and townkit_pack.json byte-identical.
//   9  NEGATIVE CONTROLS: a plot moved, a plot dropped, an archetype id past the pack, a second draw, a lot row on a
//      missing piece and a fence bay taken out are each caught by 4-7's own checks.
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
if (!ok(!!MT && MAN.v === CC.V && CC.V === 2, 'src/core/city_packs.json names ' + T.island + '/' + T.id + ', v ' + (MAN && MAN.v) + ' (tools/city_cook.js --island ' + T.island + ')')) done();
ok(MT.cell === CC.S && MT.frame === 'world' && JSON.stringify(MT.lod) === JSON.stringify(CC.LOD) && MT.lod.nearIn === MT.lod.far - 50 && MT.lod.nearOut === MT.lod.far + 50,
  'the grid (' + MT.cell + ' m, world) and the LOD distances are the format\'s (far ' + MT.lod.far + ' m, the dial)');
ok(MT.cells.every(c => fs.existsSync(path.join(ROOT, ...c.src.split('/')))) && !!MT.lotKit && fs.existsSync(path.join(ROOT, ...MT.lotKit.src.split('/'))),
  MT.cells.length + ' cell files and the lot kit named, all on disk');
const staleMeans = Object.keys(CC.MEANS).filter(k => !fs.existsSync(path.join(ROOT, CC.meanFile(k))));
ok(!staleMeans.length, 'every MEANS map is a shipped file (' + Object.keys(CC.MEANS).length + ' maps' + (staleMeans.length ? '; missing ' + staleMeans.slice(0, 4).join(' ') : '') + ')');
const shipped = MT.cells.map(c => ({ m: c, raw: zlib.gunzipSync(rd(c.src)) }));
const kitShipped = zlib.gunzipSync(rd(MT.lotKit.src));

// ---- 2. determinism ----------------------------------------------------------------------------------------------
console.log('2. determinism');
const t0 = Date.now();
const R1 = CC.cookTown(T), t1 = Date.now(), R2 = CC.cookTown(T);
console.log('     cooked twice: ' + ((t1 - t0) / 1000).toFixed(1) + ' s (with the compose) + ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s');
ok(R1.hash === R2.hash && R1.cells.length === R2.cells.length && R1.cells.every((c, n) => c.key === R2.cells[n].key && c.raw.equals(R2.cells[n].raw)) && R1.lotKit.raw.equals(R2.lotKit.raw),
  'two cooks, the same ' + R1.cells.length + ' cells and lot kit byte for byte (hash ' + R1.hash + ' / ' + R2.hash + ')');

// ---- 3. fresh ----------------------------------------------------------------------------------------------------
console.log('3. the pack is fresh');
ok(R1.hash === MT.hash, 'the hash as committed (' + R1.hash + ' / ' + MT.hash + ')');
let badC = 0;
for (const c of R1.cells) { const s = shipped.find(x => x.m.c[0] === c.i && x.m.c[1] === c.j); if (!s || !s.raw.equals(c.raw)) badC++; }
ok(badC === 0 && R1.cells.length === MT.cells.length, 'every cell as committed, byte for byte (' + R1.cells.length + ' cells, ' + badC + ' differ)');
ok(R1.lotKit.raw.equals(kitShipped), 'the lot kit as committed, byte for byte (' + R1.lotKit.pieces.length + ' pieces, ' + R1.lotKit.raw.length + ' B)');
for (const c of R1.cells) { const s = shipped.find(x => x.m.c[0] === c.i && x.m.c[1] === c.j); c.gz = s ? rd(s.m.src) : Buffer.alloc(0); }
R1.lotKit.gz = rd(MT.lotKit.src);
const fresh = CC.manifestTown(R1, c => { const s = MT.cells.find(x => x.c[0] === c.i && x.c[1] === c.j); return s ? s.src : null; }, MT.lotKit.src);
ok(JSON.stringify(fresh) === JSON.stringify(MT), 'the manifest entry as committed (inputs ' + Object.entries(R1.inputs).map(([k, v]) => k + ' ' + String(v).slice(0, 8)).join(', ') + ')');

// ---- the decoded pack (what 4-7 check, and 9 corrupts) -----------------------------------------------------------
const TK = require(path.join(ROOT, 'src', 'viewer', 'townkit.js'));
const K = CC.kitOf();
const LKD = CC.decodeLotKit(kitShipped), PIECES = LKD.head.pieces;
function decodeAll(raws) {
  return raws.map(raw => { const C = CC.decodeCell(raw); return Object.assign(C, { rows: TK.decodeInstances(C.kit), props: CC.decodeProps(C.props), lotRows: CC.decodeLots(C.lots) }); });
}
const D = decodeAll(shipped.map(s => s.raw));
const PL = CC.placesOf(T.island, T.variant), BASE = CC.placesOf(T.island, T.base);
const baseIds = new Set(BASE.things.map(t => String(t.id)));
const C0 = CC.composedOf(T), O = C0.O, pre = new RegExp('^' + T.prefix);
const recPlots = O.records.plots.filter(p => pre.test(String(p.zone)) && !baseIds.has(String(p.id))).map(p => String(p.id)).sort();
const townThings = PL.things.filter(t => !baseIds.has(String(t.id)));
const thingOf = new Map(townThings.map(t => [String(t.id), t]));
const anchorOf = new Map(townThings.map(t => [String(t.id), t.at ? [t.at[0], t.at[2]] : null]));
const ground = (x, z) => { const w = O.frame.toWorld(x, z); return O.terrainAt(w[0], w[1]); };

function coverage(D, say) {
  let bad = 0;
  const seen = new Map(), wrong = [];
  let assigned = 0;
  for (const C of D) for (const p of C.head.plots) {
    seen.set(p[0], (seen.get(p[0]) || 0) + 1);
    if (p[4] & 8) assigned++;
    const a = anchorOf.get(p[0]); if (a) { const [i, j] = CC.cellOf(a[0], a[1]); if (i !== C.head.cell[0] || j !== C.head.cell[1]) wrong.push(p[0]); }
  }
  const missing = recPlots.filter(id => seen.get(id) !== 1), extra = Array.from(seen.keys()).filter(id => recPlots.indexOf(id) < 0);
  if (!say(!missing.length && !extra.length, 'every plot of the record in exactly one cell (' + recPlots.length + ' plots; ' + missing.length + ' missing or twice, ' + extra.length + ' not the record\'s' + (missing.length ? ': ' + missing.slice(0, 3).join(' ') : '') + ')')) bad++;
  if (!say(!wrong.length, 'each plot in the cell of its anchor (' + wrong.length + ' elsewhere)')) bad++;
  const kit = D.reduce((a, C) => a + C.head.plots.filter(p => (p[4] & 1) && !(p[4] & 8)).length, 0);
  if (!say(!assigned && kit === recPlots.length, 'every plot a row of the kit TABLE (' + kit + ' of ' + recPlots.length + '; ' + assigned + ' assigned by the cook - re-sow: node tools/town_kit.js --table)')) bad++;
  const ids = k => { const m = new Map(); for (const C of D) for (const u of C.head[k]) m.set(u[0], (m.get(u[0]) || 0) + 1); return m; };
  const U = ids('uniques'), Ob = ids('objects');
  const wantU = townThings.filter(t => t.kind === 'item').map(t => String(t.id)), wantO = townThings.filter(t => t.kind === 'object').map(t => String(t.id));
  if (!say(wantU.every(id => U.get(id) === 1) && U.size === wantU.length && wantO.every(id => Ob.get(id) === 1) && Ob.size === wantO.length,
    'every town item (' + wantU.length + ', the uniques) and object (' + wantO.length + ', props) in exactly one cell')) bad++;
  const leak = [];
  for (const C of D) for (const id of C.head.plots.map(p => p[0]).concat(C.head.uniques.map(u => u[0]), C.head.objects.map(o => o[0]))) if (baseIds.has(id)) leak.push(id);
  if (!say(!leak.length, 'nothing of the town-OFF record in the pack (' + baseIds.size + ' default things; ' + leak.length + ' leaked' + (leak.length ? ': ' + leak.slice(0, 3).join(' ') : '') + ')')) bad++;
  return bad;
}
function draws(D, say) {
  let bad = 0, worst = 0;
  const errs = [];
  for (const C of D) {
    const H = C.head, F = H.far, key = H.cell.join(',');
    if (F.buckets.length !== 2 || F.buckets.some((b, n) => b.id !== n || b.name !== CC.BUCKETS[n])) errs.push(key + ': the buckets');
    let at = 0; for (const b of F.buckets) { if (b.first !== at) errs.push(key + ': bucket ' + b.name + ' not contiguous'); at += b.count; }
    if (at !== F.tris * 3) errs.push(key + ': the buckets do not cover the index');
    if (F.draws.length !== (F.tris ? 1 : 0) || (F.tris && (F.draws[0].first !== 0 || F.draws[0].count !== F.tris * 3))) errs.push(key + ': ' + F.draws.length + ' draws');
    // the owners tile each bucket, in order, each a plot or a unique of the cell
    for (const b of F.buckets) {
      let pos = b.first;
      for (const o of F.owners.filter(o => o[2] === b.id)) {
        if (o[3] !== pos) errs.push(key + ': an owner range out of order in ' + b.name);
        if (!(o[1] < (o[0] === 0 ? H.plots.length : H.uniques.length))) errs.push(key + ': an owner past the cell');
        pos += o[4];
      }
      if (pos !== b.first + b.count) errs.push(key + ': the owners leave ' + b.name + ' uncovered');
    }
    const shell = (F.buckets[0].count + F.buckets[1].count) / 3, boxes = H.uniques.length * 2 + H.plots.filter(p => p[4] & 2).length * 2;
    if (shell > 14 * H.kit.rows + 10 * boxes) errs.push(key + ': shell ' + shell + ' tris > ' + (14 * H.kit.rows + 10 * boxes));
    worst = Math.max(worst, F.tris);
    const wide = F.index === 32, n = F.tris * 3;
    for (let k = 0; k < n; k++) { const v = wide ? C.ib.readUInt32LE(k * 4) : C.ib.readUInt16LE(k * 2); if (v >= F.verts) { errs.push(key + ': index ' + v + ' past ' + F.verts); break; } }
    if (C.vb.length !== F.verts * CC.VSTRIDE) errs.push(key + ': the vertex buffer\'s length');
    for (let v = 0; v < F.verts; v++) if (C.vb[v * 12 + 11] > 1) { errs.push(key + ': a bucket id past 1'); break; }
  }
  if (!say(!errs.length, 'per cell: walls + roofs in order, ONE draw (' + D.reduce((a, C) => a + C.head.far.draws.length, 0) + ' far draws over ' + D.length + ' cells), the owners\' ranges tiling each bucket; the shell within 14 tris a kit row / 10 a box; indices in range; at most ' + worst + ' far tris a cell' + (errs.length ? ' - ' + errs.slice(0, 3).join('; ') : ''))) bad++;
  return bad;
}
function idsOk(D, say) {
  let bad = 0;
  const N = K.H.archetypes.length, errs = [];
  if (MT.archetypes !== N) errs.push('the manifest says ' + MT.archetypes + ' archetypes, the pack ' + N);
  let rows = 0, props = 0, lots = 0;
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
    if (C.lotRows.length !== H.lots.rows) errs.push(key + ': the lot row count');
    for (const r of C.lotRows) {
      lots++;
      const P = PIECES[r.piece];
      if (!P) { errs.push(key + ': a lot row on piece ' + r.piece + ', past the kit\'s ' + PIECES.length); continue; }
      if (!(r.owner < (r.flags & 128 ? H.uniques.length : H.plots.length))) errs.push(key + ': a lot owner ' + r.owner);
      if ((P.kind === 'ground') !== !!(r.flags & 2) || (P.kind === 'old') !== !!(r.flags & 4)) errs.push(key + ': a lot row\'s flags against its piece ' + P.name);
      if (P.kind !== 'ground' && P.kind !== 'old' && !(P.vb && LKD.meshes[r.piece] && LKD.meshes[r.piece].idx.length)) errs.push(key + ': piece ' + P.name + ' has no mesh');
    }
  }
  if (!PIECES.every(p => p.kind !== 'old' || MT.propKeys[p.prop] === 'fence_old')) errs.push('the old fence piece does not name fence_old');
  if (!PIECES.every(p => p.kind !== 'bay' || (PIECES[p.lod1] && PIECES[p.lod1].len === p.len))) errs.push('a bay without its lod 1');
  if (!say(!errs.length, rows + ' kit rows through townkit.js decodeInstances (WORLD, pack ' + K.man.pack.sha256.slice(0, 12) + '): archetypes < ' + N + ', houses / outbuildings on their kind, finishes of the roof kind, the plots naming their rows; ' + props + ' props, keys and owners in range; ' + lots + ' lot rows on the ' + PIECES.length + ' pieces of the lot kit' + (errs.length ? ' - ' + errs.slice(0, 3).join('; ') : ''))) bad++;
  return bad;
}
// ---- the lots: each owner's plan, clipped to the land as VILLAGE_GEN clips it
const VG = C0.GENS.VILLAGE_GEN, TKA = require('./town_kit.js');
const zones = new Map(((C0.rec.layers && C0.rec.layers.zones) || []).map(z => [z.id, z]));
const Tof = zone => ({ h: ground, waterY: zones.has(zone) ? TKA.zoneWater(C0.PG, C0.W, O.frame, zones.get(zone)) : TKA.SEA, size: 20000 });
function planOf(C, r) {
  if (r.flags & 128) { const t = thingOf.get(C.head.uniques[r.owner][0]); return t && t.plan ? { plan: t.plan, zone: null } : null; }
  const t = thingOf.get(C.head.plots[r.owner][0]); return t ? { plan: t.plot, zone: t.plot.zone } : null;
}
function lotsOk(D, say) {
  let bad = 0;
  const yawDir = y => [Math.cos(y), -Math.sin(y)];     // rotY's +x in the world
  const kind = r => PIECES[r.piece].kind;
  let bays = 0, unposted = 0, offEdge = 0, offGround = 0, worstG = 0, tooBig = 0, lawns = 0, owners = 0, short = 0, over = 0, wantM = 0, gotM = 0;
  const shortList = [];
  for (const C of D) {
    const byOwner = new Map();
    for (const r of C.lotRows) { const k = (r.flags & 128 ? 'u' : 'p') + r.owner; (byOwner.get(k) || byOwner.set(k, []).get(k)).push(r); }
    for (const [, rows] of byOwner) {
      const pl = planOf(C, rows[0]); if (!pl) continue;
      const T = Tof(pl.zone), plan = pl.plan;
      owners++;
      // every bay between two posts (a post at its start and at its end, 2 cm)
      const posts = rows.filter(r => kind(r) === 'post');
      for (const r of rows.filter(r => kind(r) === 'bay')) {
        bays++;
        const d = yawDir(r.yaw), e = [r.x + d[0] * r.len, r.z + d[1] * r.len];
        const at = (x, z) => posts.some(p => Math.hypot(p.x - x, p.z - z) < 0.02);
        if (!at(r.x, r.z) || !at(e[0], e[1])) unposted++;
      }
      // every fence row on one of its plan's edges (5 cm)
      const segs = (plan.fences || []).map(s => ({ a: s.a, b: s.b }));
      const onEdge = (x, z) => segs.some(s => { const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L2 = dx * dx + dz * dz; const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / L2)) : 0; return Math.hypot(x - s.a[0] - dx * t, z - s.a[1] - dz * t) < 0.05; });
      for (const r of rows) if (['post', 'bay', 'gatepost', 'old', 'gate'].indexOf(kind(r)) >= 0 && !onEdge(r.x, r.z)) offEdge++;
      // the coverage: the bays, the old stretches and the gates' gaps against the plan's fenced edges, clipped to the land
      let want = 0, got = 0;
      for (const s0 of plan.fences || []) {
        const s = VG.clipToLand(T, s0); if (!s) continue;
        const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
        if (s.style !== 'old' && L < 1.0) continue;
        const g = s.gap && (s.style === 'old' || (s.gap[1] > 0.3 && s.gap[0] < L - 0.3)) ? (s.style === 'old' ? Math.min(L, s.gap[1]) - Math.max(0, s.gap[0]) : Math.min(L - 0.3, s.gap[1]) - Math.max(0.3, s.gap[0])) : 0;
        want += L - g;
      }
      for (const r of rows) if (kind(r) === 'bay' || kind(r) === 'old') got += r.len;
      wantM += want; gotM += got;
      if (got < want - 1.6 - 0.02 * rows.length / 10) { short++; if (shortList.length < 3) shortList.push((rows[0].flags & 128 ? C.head.uniques : C.head.plots)[rows[0].owner][0] + ' ' + got.toFixed(1) + '/' + want.toFixed(1)); }
      if (got > want + 0.05 + 0.01 * rows.length) over++;
      // the ground under every corner (2 cm) - a fence piece's ends, an old stretch's middle (3 cm under), a ground piece's four
      for (const r of rows) {
        const d = yawDir(r.yaw), n = [-d[1], d[0]], k = kind(r);
        const pts = k === 'ground' ? [[0, -r.width / 2, 0], [r.len, -r.width / 2, 1], [r.len, r.width / 2, 2], [0, r.width / 2, 3]]
          : k === 'bay' ? [[0, 0, 0], [r.len, 0, 1]] : [[0, 0, 0]];
        for (const [u, v, c] of pts) {
          const x = r.x + d[0] * u + n[0] * v, z = r.z + d[1] * u + n[1] * v, e = Math.abs(r.y + r.g[c] + (k === 'old' ? 0.03 : 0) - ground(x, z));
          worstG = Math.max(worstG, e); if (e > 0.02) offGround++;
        }
        if (k === 'ground') {
          if (r.len > CC.PIECE_MAX + 0.01 || r.width > CC.PIECE_MAX + 0.01) tooBig++;
          if (!(r.flags & 128) && plan.poly && plan.poly.length >= 3) {
            let A = 0; for (let i = 0; i < plan.poly.length; i++) { const p = plan.poly[i], q = plan.poly[(i + 1) % plan.poly.length]; A += p[0] * q[1] - q[0] * p[1]; }
            if (r.len * r.width >= 0.5 * Math.abs(A) / 2) lawns++;
          }
        }
      }
    }
  }
  if (!say(!unposted, bays + ' bays, each between two posts (' + unposted + ' not)')) bad++;
  if (!say(!short && !over, owners + ' owners\' fences cover their plans\' fenced edges, clipped to the land (' + gotM.toFixed(0) + ' of ' + wantM.toFixed(0) + ' m; ' + short + ' short, ' + over + ' over' + (shortList.length ? ': ' + shortList.join(', ') : '') + ')')) bad++;
  if (!say(!offEdge, 'every fence row on its plan\'s own edge, 5 cm (' + offEdge + ' off)')) bad++;
  if (!say(!offGround, 'every lot row\'s corners on the composed ground, 2 cm (worst ' + (worstG * 100).toFixed(2) + ' cm, ' + offGround + ' off)')) bad++;
  if (!say(!tooBig && !lawns, 'no ground piece past ' + CC.PIECE_MAX + ' m (' + tooBig + '), none a lawn: half a plot or more (' + lawns + ') - the terrain is the lot')) bad++;
  return bad;
}

// ---- 4-7 ---------------------------------------------------------------------------------------------------------
console.log('4. coverage');
ok(recPlots.length > 300, 'the town record has its plots (' + recPlots.length + ' in the ' + T.prefix + ' zones, less the town-OFF record)');
coverage(D, ok);
console.log('5. the draw');
draws(D, ok);
console.log('6. the ids');
idsOk(D, ok);
{
  let inBox = 0; for (const C of D) { const b = C.head.box; if (!C.head.far.verts) { inBox++; continue; } const x = b[0] + C.vb.readUInt16LE(0) / 65535 * (b[3] - b[0]); if (x >= b[0] && x <= b[3]) inBox++; }
  ok(inBox === D.length, 'every cell\'s far vertices decode inside its box');
}
console.log('7. the lots');
lotsOk(D, ok);
{
  const by = {}; for (const C of D) for (const r of C.lotRows) { const k = PIECES[r.piece].kind; by[k] = (by[k] || 0) + 1; }
  console.log('     ' + D.reduce((a, C) => a + C.lotRows.length, 0) + ' lot rows: ' + Object.entries(by).map(e => e[0] + ' ' + e[1]).join(', '));
}

// ---- 8. TOWN_OFF -------------------------------------------------------------------------------------------------
console.log('8. TOWN_OFF intact');
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

// ---- 9. negative controls ----------------------------------------------------------------------------------------
console.log('9. negative controls');
{
  const catches = (f, D) => { let n = 0; f(D, c => { if (!c) n++; return c; }); return n > 0; };
  const clone = () => decodeAll(shipped.map(s => s.raw));
  const big = cl => cl.slice().sort((x, y) => y.lotRows.length - x.lotRows.length)[0];
  const a = clone(); { const p = a[0].head.plots.pop(); a[1].head.plots.push(p); }
  const b = clone(); b[2].head.plots.shift();
  const c = clone(); { const C = c[0]; C.kit = Buffer.from(C.kit); const hl = C.kit.readUInt32LE(0), at = 8 + hl + ((4 - ((8 + hl) & 3)) & 3); C.kit[at + 14] = 99; C.rows = TK.decodeInstances(C.kit); }
  const d = clone(); d[0].head.far.draws.push({ mat: 'extra', first: 0, count: 0 });
  const e = clone(); big(e).lotRows[0].piece = 250;
  const f = clone(); { const C = big(f), i = C.lotRows.findIndex(r => PIECES[r.piece].kind === 'bay'); C.lotRows.splice(i, 1); C.head.lots.rows--; }
  ok(catches(coverage, a) && catches(coverage, b) && catches(idsOk, c) && catches(draws, d) && catches(idsOk, e) && catches(lotsOk, f) && !catches(coverage, clone()) && !catches(lotsOk, clone()),
    'a plot moved, a plot dropped, an archetype id past the pack, a second draw, a lot row on a missing piece and a bay taken out are each caught; the pack as shipped is not');
}
done();
